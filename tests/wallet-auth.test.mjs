import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Wallet } from "ethers";
process.env.NODE_ENV = "test";
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.DEV_DATABASE_PATH = "memory://";
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
process.env.BYOK_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const { handle } = await import("../packages/backend/api.mjs");
const { db, query } = await import("../packages/backend/store.mjs");
const { totpBegin, totpEnable, hash } =
  await import("../packages/backend/auth.mjs");
const { TOTP } = await import("@otplib/totp");
const { NodeCryptoPlugin } = await import("@otplib/plugin-crypto-node");
const { ScureBase32Plugin } = await import("@otplib/plugin-base32-scure");
const owner = Wallet.createRandom(),
  other = Wallet.createRandom();
let walletUser;
async function request(
  path,
  {
    body,
    method = body ? "POST" : "GET",
    cookie = "",
    csrf = "",
    origin = process.env.APP_ORIGIN,
  } = {},
) {
  const r = await handle(
    new Request(process.env.APP_ORIGIN + "/api/v1/" + path, {
      method,
      headers: {
        origin,
        "content-type": "application/json",
        cookie,
        "x-csrf-token": csrf,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function challenge(
  wallet,
  {
    purpose = "auth",
    cookie = "",
    csrf = "",
    locale = "en",
    chainId = 8453,
  } = {},
) {
  const r = await request("auth/wallet/challenge", {
    body: { address: wallet.address, chainId, purpose, locale },
    cookie,
    csrf,
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { ...r.data, cookie: [cookie, r.cookie].filter(Boolean).join("; ") };
}
async function proof(c, wallet = owner, extra = {}) {
  return {
    challengeId: c.challengeId,
    message: c.message,
    signature: await wallet.signMessage(c.message),
    ...extra,
  };
}
before(async () => {
  await db();
});
beforeEach(async () => {
  await query("DELETE FROM api_rate_limits WHERE bucket LIKE 'wallet-ip:%'");
});
after(async () => {
  await (await db()).close();
});
test("wallet registration uses a real SIWE signature, explicit consent and no fabricated email", async () => {
  const c = await challenge(owner, { locale: "pl" });
  let p = await proof(c);
  const denied = await request("auth/wallet/verify", {
    body: p,
    cookie: c.cookie,
  });
  assert.equal(denied.status, 403);
  const r = await request("auth/wallet/verify", {
    body: { ...p, consent: true },
    cookie: c.cookie,
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.registered, true);
  const me = await request("auth/me", { cookie: r.cookie });
  assert.equal(me.data.user.email, null);
  assert.equal(me.data.user.wallet_address, owner.address.toLowerCase());
  assert.equal(me.data.user.locale, "pl");
  assert.equal(me.data.consentAccepted, true);
  walletUser = {
    cookie: r.cookie,
    csrf: me.data.csrfToken,
    id: me.data.user.id,
  };
  assert.equal((await request("paper/account", walletUser)).status, 200);
  assert.equal((await request("wallets", walletUser)).data.length, 1);
  assert.equal(
    (
      await request("auth/wallet/verify", {
        body: { ...p, consent: true },
        cookie: c.cookie,
      })
    ).status,
    401,
  );
});
test("wallet login reuses the account and invalid proof cannot consume another browser nonce", async () => {
  const c = await challenge(owner);
  const p = await proof(c);
  assert.equal(
    (
      await request("auth/wallet/verify", {
        body: p,
        cookie: "cryptosight-wallet=" + randomBytes(32).toString("hex"),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("auth/wallet/verify", {
        body: await proof(c, other),
        cookie: c.cookie,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("auth/wallet/verify", {
        body: {
          ...p,
          message: c.message.replace("localhost:3000", "evil.example"),
        },
        cookie: c.cookie,
      })
    ).status,
    401,
  );
  const r = await request("auth/wallet/verify", { body: p, cookie: c.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.data.registered, false);
  assert.equal(
    (await request("auth/me", { cookie: r.cookie })).data.user.id,
    walletUser.id,
  );
});
test("expired, unsupported-chain, cross-origin and concurrent replay requests are blocked", async () => {
  assert.equal(
    (
      await request("auth/wallet/challenge", {
        body: { address: owner.address, chainId: 999999 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("auth/wallet/challenge", {
        body: { address: owner.address, chainId: 1 },
        origin: "https://evil.example",
      })
    ).status,
    403,
  );
  const old = await challenge(owner);
  await query(
    "UPDATE wallet_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",
    [old.challengeId],
  );
  assert.equal(
    (
      await request("auth/wallet/verify", {
        body: await proof(old),
        cookie: old.cookie,
      })
    ).status,
    401,
  );
  const c = await challenge(other);
  const p = await proof(c, other, { consent: true });
  const results = await Promise.all([
    request("auth/wallet/verify", { body: p, cookie: c.cookie }),
    request("auth/wallet/verify", { body: p, cookie: c.cookie }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
});
test("linking needs account CSRF and ownership, and the last login wallet cannot be removed", async () => {
  assert.equal(
    (
      await request("auth/wallet/challenge", {
        body: { address: other.address, chainId: 1, purpose: "link" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("auth/wallet/challenge", {
        body: { address: other.address, chainId: 1, purpose: "link" },
        cookie: walletUser.cookie,
      })
    ).status,
    403,
  );
  const hijack = await challenge(other, { ...walletUser, purpose: "link" });
  assert.equal(
    (
      await request("auth/wallet/verify", {
        body: await proof(hijack, other),
        cookie: hijack.cookie,
        csrf: walletUser.csrf,
      })
    ).status,
    409,
  );
  const unlink = await challenge(owner, { ...walletUser, purpose: "unlink" });
  assert.equal(
    (
      await request("auth/wallet/verify", {
        body: await proof(unlink),
        cookie: unlink.cookie,
        csrf: walletUser.csrf,
      })
    ).data.code,
    "wallet_last_login_method",
  );
  const second = Wallet.createRandom(),
    link = await challenge(second, { ...walletUser, purpose: "link" });
  assert.equal(
    (
      await request("auth/wallet/verify", {
        body: await proof(link, second),
        cookie: link.cookie,
        csrf: walletUser.csrf,
      })
    ).status,
    200,
  );
  const remove = await challenge(second, { ...walletUser, purpose: "unlink" });
  assert.equal(
    (
      await request("auth/wallet/verify", {
        body: await proof(remove, second),
        cookie: remove.cookie,
        csrf: walletUser.csrf,
      })
    ).status,
    200,
  );
  assert.equal((await request("auth/me", walletUser)).data.user, null);
});
test("wallet login enforces existing TOTP, and passwordless users can disable it with a valid code", async () => {
  const user = (await query("SELECT * FROM users WHERE id=$1", [walletUser.id]))
      .rows[0],
    setup = totpBegin(user),
    totp = new TOTP({
      secret: setup.secret,
      crypto: new NodeCryptoPlugin(),
      base32: new ScureBase32Plugin(),
    }),
    code = await totp.generate();
  await totpEnable(user, setup.secret, code);
  const c = await challenge(owner);
  let p = await proof(c);
  assert.equal(
    (await request("auth/wallet/verify", { body: p, cookie: c.cookie })).data
      .code,
    "wallet_totp_required",
  );
  const r = await request("auth/wallet/verify", {
    body: { ...p, totp: code },
    cookie: c.cookie,
  });
  assert.equal(r.status, 200);
  const me = await request("auth/me", { cookie: r.cookie });
  assert.equal(
    (
      await request("totp", {
        method: "DELETE",
        cookie: r.cookie,
        csrf: me.data.csrfToken,
        body: { code },
      })
    ).status,
    200,
  );
});
test("Google completion gates 2FA with a single-use pending browser cookie", async () => {
  const { finishOAuthSignIn, oauthMfaCookie } =
    await import("../packages/backend/oauth.mjs");
  const user = (await query("SELECT * FROM users WHERE id=$1", [walletUser.id]))
      .rows[0],
    setup = totpBegin(user),
    totp = new TOTP({
      secret: setup.secret,
      crypto: new NodeCryptoPlugin(),
      base32: new ScureBase32Plugin(),
    }),
    code = await totp.generate();
  await totpEnable(user, setup.secret, code);
  const gated = await finishOAuthSignIn(
    (await query("SELECT * FROM users WHERE id=$1", [user.id])).rows[0],
  );
  assert.match(gated.headers.get("location"), /oauthMfa=1/);
  const cookie = gated.headers.get("set-cookie").split(";")[0];
  assert.match(cookie, new RegExp("^" + oauthMfaCookie + "="));
  assert.equal((await request("auth/me", { cookie })).data.user, null);
  const good = await request("auth/oauth/verify-totp", {
    body: { code },
    cookie,
  });
  assert.equal(good.status, 200);
  assert.equal(
    (await request("auth/oauth/verify-totp", { body: { code }, cookie }))
      .status,
    400,
  );
});
