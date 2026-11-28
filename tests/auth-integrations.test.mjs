import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.NODE_ENV = "test";
process.env.DEV_DATABASE_PATH = "memory://";
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
process.env.BYOK_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const { handle } = await import("../packages/backend/api.mjs"),
  { query, db } = await import("../packages/backend/store.mjs"),
  { saveService } = await import("../packages/backend/integrations.mjs");
let owner, other;
const original = globalThis.fetch;
async function request(
  path,
  body,
  user = owner,
  method = body === undefined ? "GET" : "POST",
  key,
) {
  const r = await handle(
    new Request(process.env.APP_ORIGIN + "/api/v1/" + path, {
      method,
      headers: {
        origin: process.env.APP_ORIGIN,
        "content-type": "application/json",
        ...(user
          ? { cookie: user.cookie, "x-csrf-token": user.csrf || "" }
          : {}),
        ...(key ? { "idempotency-key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
before(async () => {
  for (const email of ["auth-owner@example.com", "auth-other@example.com"]) {
    const r = await request(
      "auth/register",
      { email, password: "fixture-password-1234", consent: true },
      null,
    );
    assert.equal(r.status, 201);
    const me = await request("auth/me", undefined, { cookie: r.cookie });
    const user = {
      cookie: r.cookie,
      csrf: me.data.csrfToken,
      id: me.data.user.id,
      email,
    };
    if (!owner) owner = user;
    else other = user;
  }
  await query("UPDATE users SET role='admin' WHERE id=$1", [owner.id]);
});
beforeEach(async () => {
  for (const key of [
    "SMTP_URL",
    "EMAIL_FROM",
    "RESEND_API_KEY",
    "TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ])
    delete process.env[key];
  await query(
    "UPDATE service_integrations SET enabled=false,config='{}',key_envelope=NULL,version=1",
  );
  await query("DELETE FROM api_rate_limits");
  await query("DELETE FROM analyses");
  await query("DELETE FROM daily_budgets");
  globalThis.fetch = original;
});
after(async () => {
  globalThis.fetch = original;
  await (await db()).close();
});
const resend = {
  enabled: true,
  version: 1,
  config: { from: "noreply@cryptosight.tech" },
  secret: "re_fixture_private_secret",
};
test("integration writes require administrator and CSRF, encrypt secrets and keep read metadata write-only", async () => {
  assert.equal(
    (await request("admin/integrations/resend", resend, other, "PUT")).status,
    403,
  );
  assert.equal(
    (
      await request(
        "admin/integrations/resend",
        resend,
        { ...owner, csrf: "" },
        "PUT",
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("admin/integrations/resend", resend, owner, "PUT")).status,
    200,
  );
  const raw = (
    await query(
      "SELECT key_envelope FROM service_integrations WHERE name='resend'",
    )
  ).rows[0];
  assert.ok(!JSON.stringify(raw).includes(resend.secret));
  const view = await request("admin/integrations");
  assert.equal(view.status, 200);
  assert.ok(!JSON.stringify(view.data).includes(resend.secret));
  assert.equal(view.data.find((v) => v.name === "resend").hasSecret, true);
  assert.ok(
    !JSON.stringify((await request("auth/me")).data).includes(resend.secret),
  );
  assert.equal(
    (await request("admin/integrations/resend", resend, owner, "PUT")).status,
    409,
  );
  assert.equal(
    (
      await request(
        "admin/integrations/resend",
        { ...resend, version: 2, secret: undefined },
        owner,
        "PUT",
      )
    ).status,
    200,
  );
});
test("configured production registration sends verification and only enables login after the emailed link", async () => {
  await saveService(owner, "resend", resend);
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push(JSON.parse(options.body));
    return Response.json({ id: "fixture-production-mail" });
  };
  process.env.NODE_ENV = "production";
  process.env.ALLOW_LOCAL_DB = "true";
  try {
    const r = await request(
      "auth/register",
      {
        email: "production-flow@example.com",
        password: "production-fixture-password-1234",
        consent: true,
      },
      null,
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.verification_required, true);
    assert.equal(
      (
        await request(
          "auth/login",
          {
            email: "production-flow@example.com",
            password: "production-fixture-password-1234",
          },
          null,
        )
      ).data.code,
      "email_verification_required",
    );
    const token = sent[0].text.match(/verify=([a-f0-9]{64})/)[1];
    assert.equal((await request("auth/verify", { token }, null)).status, 200);
    assert.equal((await request("auth/verify", { token }, null)).status, 400);
    assert.equal(
      (
        await request(
          "auth/login",
          {
            email: "production-flow@example.com",
            password: "production-fixture-password-1234",
          },
          null,
        )
      ).status,
      200,
    );
  } finally {
    process.env.NODE_ENV = "test";
    delete process.env.ALLOW_LOCAL_DB;
  }
});
test("mail test endpoint requires an administrator and sends only the explicit requested recipient", async () => {
  await saveService(owner, "resend", resend);
  let sent = 0;
  globalThis.fetch = async (url, options) => {
    sent++;
    assert.deepEqual(JSON.parse(options.body).to, [
      "test-recipient@example.com",
    ]);
    return Response.json({ id: "test-message" });
  };
  assert.equal(
    (
      await request(
        "admin/integrations/resend/test",
        { email: "test-recipient@example.com" },
        other,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request("admin/integrations/resend/test", {
        email: "test-recipient@example.com",
      })
    ).status,
    200,
  );
  assert.equal(sent, 1);
});
test("missing mail reports unavailable consistently and provider failures cannot leak the provider body or key", async () => {
  for (const email of [owner.email, "missing@example.com"])
    assert.equal(
      (await request("auth/reset-request", { email }, null)).data.code,
      "email_not_configured",
    );
  await saveService(owner, "resend", resend);
  globalThis.fetch = async () =>
    Response.json(
      { message: "private provider diagnostics " + resend.secret },
      { status: 403 },
    );
  const r = await request("auth/reset-request", { email: owner.email }, null);
  assert.equal(r.status, 503);
  assert.equal(r.data.code, "email_delivery_failed");
  assert.ok(!JSON.stringify(r).includes(resend.secret));
});
test("password recovery sends a real reset URL through Resend, consumes all reset links, verifies email and revokes sessions", async () => {
  await saveService(owner, "resend", resend);
  const sent = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.headers.authorization, "Bearer " + resend.secret);
    sent.push(JSON.parse(options.body));
    return Response.json({ id: "fixture-email" });
  };
  await query("UPDATE users SET email_verified=false WHERE id=$1", [other.id]);
  assert.equal(
    (await request("auth/reset-request", { email: other.email }, null)).status,
    200,
  );
  const token = sent[0].text.match(/reset=([a-f0-9]{64})/)[1];
  await request("auth/reset-request", { email: other.email }, null);
  const stale = sent[1].text.match(/reset=([a-f0-9]{64})/)[1];
  assert.equal(
    (
      await request(
        "auth/reset",
        { token, password: "a-new-fixture-password-1234" },
        null,
      )
    ).status,
    200,
  );
  assert.equal((await request("journal", undefined, other)).status, 401);
  assert.equal(
    (
      await request(
        "auth/reset",
        { token: stale, password: "another-password-1234" },
        null,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "auth/login",
        { email: other.email, password: "a-new-fixture-password-1234" },
        null,
      )
    ).status,
    200,
  );
  // Restore fixture identity for later ownership checks.
  const login = await request(
    "auth/login",
    { email: other.email, password: "a-new-fixture-password-1234" },
    null,
  );
  const me = await request("auth/me", undefined, { cookie: login.cookie });
  other = { ...other, cookie: login.cookie, csrf: me.data.csrfToken };
});
test("Turnstile rejects absent, wrong-host, wrong-action and reused tokens before account creation; failure is closed", async () => {
  await saveService(owner, "turnstile", {
    enabled: true,
    version: 1,
    config: { siteKey: "public-fixture-site-key" },
    secret: "private-fixture-turnstile-secret",
  });
  const body = {
    email: "captcha-fixture@example.com",
    password: "captcha-fixture-password-123",
    consent: true,
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({
      success: true,
      hostname: "localhost",
      action: "register",
    });
  };
  assert.equal(
    (await request("auth/register", body, null)).data.code,
    "captcha_required",
  );
  assert.equal(calls, 0);
  for (const reply of [
    { success: true, hostname: "evil.example", action: "register" },
    { success: true, hostname: "localhost", action: "login" },
    { success: false, "error-codes": ["timeout-or-duplicate"] },
  ]) {
    globalThis.fetch = async () => Response.json(reply);
    assert.equal(
      (
        await request(
          "auth/register",
          { ...body, turnstileToken: "fixture-token" },
          null,
        )
      ).data.code,
      "captcha_failed",
    );
  }
  globalThis.fetch = async () => {
    throw new Error("private upstream error");
  };
  assert.equal(
    (
      await request(
        "auth/register",
        { ...body, turnstileToken: "fixture-token" },
        null,
      )
    ).data.code,
    "captcha_unavailable",
  );
  await query("DELETE FROM api_rate_limits");
  globalThis.fetch = async () =>
    Response.json({ success: true, hostname: "localhost", action: "register" });
  assert.equal(
    (
      await request(
        "auth/register",
        { ...body, turnstileToken: "fixture-token" },
        null,
      )
    ).status,
    201,
  );
});
test("watchlist scans enqueue deep analyses on each distinct timeframe, replay safely and preserve per-frame status and ownership", async () => {
  await request("credentials", {
    provider: "openai",
    key: "fixture-provider-key",
  });
  await request("watchlist", {
    symbol: "BTCUSDT",
    venue: "binance",
    market: "spot",
    timeframe: "1h",
  });
  await request("watchlist", {
    symbol: "BTCUSDT",
    venue: "binance",
    market: "perpetual",
    timeframe: "1h",
  });
  const input = {
    provider: "openai",
    model: "fixture",
    locale: "en",
    venue: "binance",
    market: "spot",
    timeframes: ["15m", "1h", "4h"],
  };
  const batch = await request(
    "scanner",
    input,
    owner,
    "POST",
    "multi-frame-fixture-1",
  );
  assert.equal(batch.status, 202, JSON.stringify(batch.data));
  assert.equal(batch.data.enqueued, 3);
  assert.deepEqual(
    batch.data.jobs.map((j) => j.timeframe),
    input.timeframes,
  );
  const stored = (
    await query("SELECT mode,request_config FROM analyses WHERE user_id=$1", [
      owner.id,
    ])
  ).rows;
  assert.ok(
    stored.every(
      (r) => r.mode === "deep" && r.request_config.market === "spot",
    ),
  );
  const replay = await request(
    "scanner",
    input,
    owner,
    "POST",
    "multi-frame-fixture-1",
  );
  assert.deepEqual(
    replay.data.jobs.map((j) => j.id),
    batch.data.jobs.map((j) => j.id),
  );
  const rows = await request("scanner?mode=ai&venue=binance&market=spot");
  assert.equal(rows.data.length, 3);
  assert.ok(rows.data.every((r) => r.status === "queued"));
  assert.equal(
    (await request("scanner?mode=ai", undefined, other)).data.length,
    0,
  );
  assert.equal(
    (
      await request(
        "scanner",
        { ...input, timeframes: ["1h", "1h"] },
        owner,
        "POST",
        "invalid-repeat-frames",
      )
    ).status,
    400,
  );
});
test("quota failures and an empty watchlist are explicit, rather than reporting a successful enqueue", async () => {
  const input = {
    provider: "openai",
    model: "fixture",
    locale: "en",
    timeframes: ["15m", "1h"],
    venue: "okx",
    market: "spot",
  };
  assert.deepEqual(
    (await request("scanner", input, owner, "POST", "empty-scan-fixture")).data
      .jobs,
    [],
  );
  await query(
    "UPDATE platform_settings SET config=jsonb_set(config,'{free_daily_limit}','0') WHERE id=1",
  );
  const r = await request(
    "scanner",
    { ...input, venue: "binance", model: "quota-fixture" },
    owner,
    "POST",
    "quota-scan-fixture",
  );
  assert.equal(r.data.enqueued, 0);
  assert.ok(
    r.data.jobs.every(
      (j) => j.status === "failed" && j.error === "daily_limit",
    ),
  );
});
