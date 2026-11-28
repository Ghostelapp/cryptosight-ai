import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.DEV_DATABASE_PATH = "memory://";
process.env.NODE_ENV = "test";
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.BYOK_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
const { handle } = await import("../packages/backend/api.mjs");
const { query, db } = await import("../packages/backend/store.mjs");
const { totpBegin, totpEnable, checkTotp } =
  await import("../packages/backend/auth.mjs");
const { TOTP } = await import("@otplib/totp");
const { NodeCryptoPlugin } = await import("@otplib/plugin-crypto-node");
const { ScureBase32Plugin } = await import("@otplib/plugin-base32-scure");
const fixtureAgent = "a16a6a16-1234-4234-8234-123456789abc";
let alice, bob;
async function request(
  path,
  {
    method = "GET",
    body,
    cookie,
    csrf,
    origin = "http://localhost:3000",
    headers = {},
  } = {},
) {
  const r = await handle(
    new Request("http://localhost:3000/api/v1/" + path, {
      method,
      headers: {
        origin,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...(csrf ? { "x-csrf-token": csrf } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return {
    status: r.status,
    data: r.headers.get("content-type")?.includes("json")
      ? await r.json()
      : null,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
before(async () => {
  for (const email of ["alice@example.com", "bob@example.com"]) {
    const reg = await request("auth/register", {
      method: "POST",
      body: {
        email,
        password: "test-password-12345",
        locale: "en",
        consent: true,
      },
    });
    assert.equal(reg.status, 201, JSON.stringify(reg.data));
    const me = await request("auth/me", { cookie: reg.cookie });
    const u = {
      cookie: reg.cookie,
      csrf: me.data.csrfToken,
      id: me.data.user.id,
    };
    if (email.startsWith("alice")) alice = u;
    else bob = u;
  }
});
after(async () => {
  await (await db()).close();
});

test("public risk API accepts an optional target and validates its direction", async () => {
  const body = {
    account: 10000,
    riskPct: 1,
    entry: 100,
    stop: 95,
    leverage: 1,
    direction: "LONG",
    target: 110,
    feeBps: 10,
    slippageBps: 5,
  };
  const result = await request("risk", { method: "POST", body });
  assert.equal(result.status, 200);
  assert.equal(result.data.target, 110);
  assert.ok(result.data.netProfit > 0);
  assert.ok(result.data.rewardRisk < 2);
  assert.equal(
    (await request("risk", { method: "POST", body: { ...body, target: 90 } }))
      .status,
    400,
  );
  const { target, ...withoutTarget } = body;
  assert.equal(
    (await request("risk", { method: "POST", body: withoutTarget })).data
      .netProfit,
    null,
  );
});
test("migrations create application tables and OHLC integrity constraints", async () => {
  const tables = (
    await query(
      "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public'",
    )
  ).rows[0].count;
  assert.ok(tables >= 28);
  await assert.rejects(
    query(
      "INSERT INTO candles(venue,market,symbol,timeframe,open_time,open,high,low,close,volume,closed) VALUES('binance','spot','BTCUSDT','1h',now(),100,90,80,100,1,true)",
    ),
  );
});
test("private endpoints reject anonymous requests, forged Origin and missing CSRF", async () => {
  assert.equal((await request("journal")).status, 401);
  assert.equal(
    (
      await request("journal", {
        method: "POST",
        cookie: alice.cookie,
        body: {},
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("journal", {
        method: "POST",
        cookie: alice.cookie,
        csrf: alice.csrf,
        origin: "https://evil.example",
        body: {},
      })
    ).status,
    403,
  );
});
test("journal and drawings remain tenant-scoped and optimistic versions prevent lost writes", async () => {
  const r = await request("journal", {
    method: "POST",
    ...alice,
    body: {
      symbol: "BTCUSDT",
      side: "LONG",
      entry: 100,
      exit: 110,
      quantity: 1,
      fees: 1,
      notes: "test",
    },
  });
  assert.equal(r.status, 200);
  assert.equal((await request("journal", bob)).data.length, 0);
  const id = crypto.randomUUID(),
    payload = {
      name: "segment",
      points: [
        { timestamp: 1, value: 100 },
        { timestamp: 2, value: 110 },
      ],
    },
    body = {
      venue: "binance",
      market: "spot",
      symbol: "BTCUSDT",
      timeframe: "1h",
      kind: "segment",
      payload,
      version: 0,
    };
  const a = await request("drawings/" + id, { method: "PUT", ...alice, body });
  assert.equal(a.status, 200, JSON.stringify(a.data));
  const conflict = await request("drawings/" + id, {
    method: "PUT",
    ...alice,
    body,
  });
  assert.equal(conflict.status, 409);
  assert.equal((await request("drawings?symbol=BTCUSDT", bob)).data.length, 0);
  const unauthorized = await request("drawings/" + id, {
    method: "PUT",
    ...bob,
    body,
  });
  assert.notEqual(unauthorized.status, 200);
});
test("BYOK endpoint returns only metadata and deletes are tenant-scoped", async () => {
  const r = await request("credentials", {
    method: "POST",
    ...alice,
    body: { provider: "openai", key: "sk-test-sensitive-secret" },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const list = (await request("credentials", alice)).data;
  assert.equal(list.length, 1);
  assert.ok(!JSON.stringify(list).includes("sensitive"));
  assert.ok(!JSON.stringify(list).includes("ciphertext"));
  await request("credentials/" + list[0].id, {
    method: "DELETE",
    ...bob,
    body: {},
  });
  assert.equal((await request("credentials", alice)).data.length, 1);
});
test("TOTP enables only with a valid code, authenticates and rejects invalid codes", async () => {
  const u = { id: alice.id, email: "alice@example.com" },
    b = totpBegin(u),
    totp = new TOTP({
      crypto: new NodeCryptoPlugin(),
      base32: new ScureBase32Plugin(),
      secret: b.secret,
    }),
    code = await totp.generate();
  await totpEnable(u, b.secret, code);
  const saved = (await query("SELECT * FROM users WHERE id=$1", [alice.id]))
    .rows[0];
  assert.equal(await checkTotp(saved, code), true);
  assert.equal(await checkTotp(saved, "000000"), false);
  await assert.rejects(totpEnable(u, b.secret, "000000"));
});
test("risk API validates finite inputs and blocks invalid direction", async () => {
  const good = await request("risk", {
    method: "POST",
    body: {
      account: 10000,
      riskPct: 1,
      entry: 100,
      stop: 90,
      leverage: 1,
      direction: "LONG",
    },
  });
  assert.equal(good.status, 200);
  const bad = await request("risk", {
    method: "POST",
    body: {
      account: 10000,
      riskPct: 1,
      entry: 100,
      stop: 110,
      leverage: 1,
      direction: "LONG",
    },
  });
  assert.equal(bad.status, 400);
});
test("unsupported HTTP methods cannot mutate resources", async () => {
  assert.equal(
    (await request("journal", { method: "PATCH", ...alice, body: {} })).status,
    405,
  );
  assert.equal((await request("auth/logout", { ...alice })).status, 405);
  assert.equal((await request("missing-path", { ...alice })).status, 404);
});
test("analysis quotas reserve atomically and abandoned jobs settle once without replay", async () => {
  const { queueAnalysis, recoverAbandonedJobs } =
    await import("../packages/backend/jobs.mjs");
  const user = (await query("SELECT * FROM users WHERE id=$1", [alice.id]))
    .rows[0];
  await query(
    "INSERT INTO platform_agents(id,name,provider,model,enabled) VALUES($1,'Quota fixture','openai','fixture',true) ON CONFLICT DO NOTHING",
    [fixtureAgent],
  );
  const config = {
    agentId: fixtureAgent,
    venue: "binance",
    market: "spot",
    symbol: "BTCUSDT",
    timeframe: "1h",
    provider: "openai",
    model: "fixture",
    locale: "en",
    mode: "quick",
  };
  const job = await queueAnalysis(user, config, "quota-fixture-key");
  const repeat = await queueAnalysis(user, config, "quota-fixture-key");
  assert.equal(repeat.id, job.id);
  await query(
    "UPDATE analyses SET status='running',started_at=now()-interval '31 minutes' WHERE id=$1",
    [job.id],
  );
  await recoverAbandonedJobs();
  await recoverAbandonedJobs();
  const saved = (await query("SELECT * FROM analyses WHERE id=$1", [job.id]))
    .rows[0];
  assert.equal(saved.status, "failed");
  assert.equal(saved.error_code, "worker_interrupted");
  const budget = (
    await query(
      "SELECT * FROM daily_budgets WHERE user_id=$1 AND day=CURRENT_DATE",
      [alice.id],
    )
  ).rows[0];
  assert.equal(+budget.reserved, 0);
  assert.equal(+budget.used, 0.5);
});
test("chat/review budget accounting also reserves and settles failed provider calls", async () => {
  const { withAIBudget } = await import("../packages/backend/jobs.mjs");
  const user = (await query("SELECT * FROM users WHERE id=$1", [alice.id]))
    .rows[0];
  await assert.rejects(
    withAIBudget(
      user,
      { agentId: fixtureAgent, provider: "openai", model: "fixture" },
      async () => {
        throw new Error("recorded_provider_failure");
      },
    ),
  );
  const budget = (
    await query(
      "SELECT * FROM daily_budgets WHERE user_id=$1 AND day=CURRENT_DATE",
      [alice.id],
    )
  ).rows[0];
  assert.equal(+budget.reserved, 0);
  assert.equal(+budget.used, 1);
});
test("invalid JSON is a client error, rather than a service failure", async () => {
  const r = await handle(
    new Request("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: "{broken",
    }),
  );
  assert.equal(r.status, 400);
  assert.equal((await r.json()).code, "invalid_json");
});
test("paper short close safely settles a gap beyond collateral and cannot settle twice", async () => {
  const originalFetch = globalThis.fetch;
  let ask = 101;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /binance\.com\/api\/v3\/depth/);
    return Response.json({
      bids: [["100", "1000"]],
      asks: [[String(ask), "1000"]],
    });
  };
  try {
    const entry = await request("paper/orders", {
      ...alice,
      method: "POST",
      headers: { "idempotency-key": "paper-short-gap-fixture" },
      body: {
        venue: "binance",
        market: "spot",
        symbol: "BTCUSDT",
        timeframe: "1h",
        direction: "SHORT",
        quantity: 10,
      },
    });
    assert.equal(entry.status, 200, JSON.stringify(entry.data));
    ask = 300;
    const close = await request("paper-close/" + entry.data.id, {
      ...alice,
      method: "POST",
      body: {},
    });
    assert.equal(close.status, 200, JSON.stringify(close.data));
    assert.equal(close.data.collateral_exhausted, true);
    const account = (await request("paper/account", alice)).data;
    assert.equal(+account.account.balance, 8999);
    assert.equal(+account.orders[0].pnl, -1001);
    assert.equal(account.orders[0].status, "closed");
    assert.equal(account.stats.closedTrades, 1);
    assert.equal(account.stats.realizedPnl, -1001);
    assert.equal(account.stats.winRate, 0);
    assert.equal(account.stats.profitFactor, 0);
    assert.equal(account.stats.openPositions, 0);
    assert.equal(account.stats.unrealizedPnl, 0);
    assert.equal(account.equity, 8999);
    assert.equal(
      (
        await request("paper-close/" + entry.data.id, {
          ...alice,
          method: "POST",
          body: {},
        })
      ).status,
      409,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
