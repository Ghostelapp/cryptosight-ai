import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
process.env.DEV_DATABASE_PATH = "memory://";
process.env.NODE_ENV = "test";
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
process.env.BYOK_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const { handle } = await import("../packages/backend/api.mjs");
const { query, db } = await import("../packages/backend/store.mjs");
const { hash, totpBegin, totpEnable } =
  await import("../packages/backend/auth.mjs");
const { TOTP } = await import("@otplib/totp");
const { NodeCryptoPlugin } = await import("@otplib/plugin-crypto-node");
const { ScureBase32Plugin } = await import("@otplib/plugin-base32-scure");
let owner, other;
async function request(
  path,
  {
    method = "GET",
    body,
    user,
    token,
    origin = process.env.APP_ORIGIN,
    csrf = true,
  } = {},
) {
  const response = await handle(
    new Request(process.env.APP_ORIGIN + "/api/v1/" + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(origin ? { origin } : {}),
        ...(user
          ? {
              cookie: user.cookie,
              ...(csrf ? { "x-csrf-token": user.csrf } : {}),
            }
          : {}),
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
before(async () => {
  for (const name of ["owner", "other"]) {
    const registered = await request("auth/register", {
      method: "POST",
      body: {
        email: name + "-mobile@example.com",
        password: "mobile-fixture-password-123",
        consent: true,
      },
    });
    assert.equal(registered.status, 201);
    const me = await request("auth/me", {
      user: { cookie: registered.cookie },
    });
    const user = {
      cookie: registered.cookie,
      csrf: me.data.csrfToken,
      id: me.data.user.id,
    };
    if (name === "owner") owner = user;
    else other = user;
  }
});
after(async () => {
  await (await db()).close();
});
async function start() {
  const verifier = randomBytes(32).toString("base64url"),
    state = randomBytes(32).toString("hex");
  const result = await request("auth/mobile/start", {
    method: "POST",
    body: {
      codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
      state,
    },
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return { ...result.data, verifier, state };
}
async function authorize(flow, user = owner, extra = {}) {
  return request("auth/mobile/authorize", {
    method: "POST",
    user,
    body: { requestId: flow.requestId, ...extra },
  });
}
function exchange(flow, redirect, overrides = {}) {
  const code = new URL(redirect).searchParams.get("code");
  return request("auth/mobile/exchange", {
    method: "POST",
    body: {
      requestId: flow.requestId,
      code,
      codeVerifier: flow.verifier,
      ...overrides,
    },
  });
}
test("native PKCE handoff requires browser consent and issues a hashed session once", async () => {
  const flow = await start();
  assert.equal(new URL(flow.authorizeUrl).origin, process.env.APP_ORIGIN);
  const metadata = await request("auth/mobile/request/" + flow.requestId);
  assert.equal(metadata.status, 200);
  assert.equal(metadata.data.user_id, undefined);
  assert.equal(metadata.data.code_hash, undefined);
  assert.equal((await authorize(flow)).status, 200);
  const repeated = await authorize(flow);
  assert.equal(repeated.status, 409);
});
test("PKCE exchange rejects a wrong proof without consuming the valid code", async () => {
  const flow = await start(),
    approved = await authorize(flow);
  assert.equal(approved.status, 200);
  assert.equal(
    (
      await exchange(flow, approved.data.redirectUrl, {
        codeVerifier: randomBytes(32).toString("base64url"),
      })
    ).status,
    401,
  );
  assert.equal(
    (await exchange(flow, approved.data.redirectUrl, { code: "0".repeat(64) }))
      .status,
    401,
  );
  const result = await exchange(flow, approved.data.redirectUrl);
  assert.equal(result.status, 200);
  assert.match(result.data.accessToken, /^m_[a-f0-9]{64}$/);
  assert.equal(result.cookie, undefined);
  assert.ok(!approved.data.redirectUrl.includes(result.data.accessToken));
  const stored = (
    await query("SELECT token_hash FROM sessions WHERE token_hash=$1", [
      hash(result.data.accessToken),
    ])
  ).rows[0];
  assert.equal(stored.token_hash, hash(result.data.accessToken));
  assert.equal((await exchange(flow, approved.data.redirectUrl)).status, 400);
});
test("approval keeps cookie Origin/CSRF protection and cannot be overwritten by another account", async () => {
  const flow = await start();
  assert.equal(
    (
      await request("auth/mobile/authorize", {
        method: "POST",
        body: { requestId: flow.requestId },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("auth/mobile/authorize", {
        method: "POST",
        user: owner,
        csrf: false,
        body: { requestId: flow.requestId },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("auth/mobile/authorize", {
        method: "POST",
        user: owner,
        origin: "https://other.example",
        body: { requestId: flow.requestId },
      })
    ).status,
    403,
  );
  const first = await authorize(flow);
  assert.equal(first.status, 200);
  assert.equal((await authorize(flow, other)).status, 409);
  assert.equal((await exchange(flow, first.data.redirectUrl)).status, 200);
});
test("native sessions retain tenant isolation, cookie sessions remain CSRF-protected, and logout revokes the bearer", async () => {
  const flow = await start(),
    approved = await authorize(flow),
    logged = await exchange(flow, approved.data.redirectUrl);
  const token = logged.data.accessToken;
  const me = await request("auth/me", { token });
  assert.equal(me.data.user.id, owner.id);
  assert.equal(me.data.csrfToken, null);
  const row = await request("journal", {
    method: "POST",
    token,
    body: {
      symbol: "BTCUSDT",
      side: "LONG",
      entry: 100,
      exit: 110,
      quantity: 1,
      fees: 1,
      notes: "native fixture",
    },
  });
  assert.equal(row.status, 200);
  assert.equal((await request("journal", { user: other })).data.length, 0);
  assert.equal(
    (
      await request("journal", {
        method: "DELETE",
        token,
        origin: "https://other.example",
      })
    ).status,
    405,
  );
  assert.equal(
    (
      await request("journal/" + row.data.id, {
        method: "DELETE",
        token,
        origin: "https://other.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("auth/me", { user: { cookie: "cryptosight=" + token } }))
      .data.user,
    null,
  );
  assert.equal(
    (await request("auth/me", { token: owner.cookie.split("=")[1] })).data.user,
    null,
  );
  assert.equal(
    (
      await request("journal", {
        method: "POST",
        user: owner,
        csrf: false,
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("auth/logout", { method: "POST", token, body: {} })).status,
    200,
  );
  assert.equal((await request("journal", { token })).status, 401);
});
test("expiry, arbitrary redirect input and unapproved codes are rejected", async () => {
  const flow = await start();
  assert.equal(
    (
      await request("auth/mobile/start", {
        method: "POST",
        body: {
          codeChallenge: "a".repeat(43),
          state: "a".repeat(64),
          redirectUri: "https://evil.example",
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("auth/mobile/exchange", {
        method: "POST",
        body: {
          requestId: flow.requestId,
          code: "0".repeat(64),
          codeVerifier: flow.verifier,
        },
      })
    ).status,
    401,
  );
  await query(
    "UPDATE mobile_login_requests SET expires_at=now()-interval '1 second' WHERE id=$1",
    [flow.requestId],
  );
  assert.equal((await authorize(flow)).status, 400);
  assert.equal(
    (await request("auth/mobile/request/" + flow.requestId)).status,
    400,
  );
});
test("new native sessions require a fresh second factor when the account has TOTP", async () => {
  const flow = await start();
  const secret = totpBegin({
    id: owner.id,
    email: "owner-mobile@example.com",
  }).secret;
  const totp = new TOTP({
    crypto: new NodeCryptoPlugin(),
    base32: new ScureBase32Plugin(),
  });
  const code = await totp.generate({ secret });
  await totpEnable({ id: owner.id }, secret, code);
  assert.equal((await authorize(flow)).status, 400);
  const approved = await authorize(flow, owner, { totp: code });
  assert.equal(approved.status, 200);
  assert.equal((await exchange(flow, approved.data.redirectUrl)).status, 200);
  await query("UPDATE users SET totp_envelope=NULL WHERE id=$1", [owner.id]);
});
test("suspension prevents exchange and native sessions expire server-side", async () => {
  const flow = await start(),
    approved = await authorize(flow);
  await query("UPDATE users SET suspended=true WHERE id=$1", [owner.id]);
  assert.equal((await exchange(flow, approved.data.redirectUrl)).status, 401);
  await query("UPDATE users SET suspended=false WHERE id=$1", [owner.id]);
  const result = await exchange(flow, approved.data.redirectUrl);
  assert.equal(result.status, 200);
  await query(
    "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
    [hash(result.data.accessToken)],
  );
  assert.equal(
    (await request("journal", { token: result.data.accessToken })).status,
    401,
  );
});
