import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.NODE_ENV = "test";
process.env.DEV_DATABASE_PATH = "memory://";
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
process.env.BYOK_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const { handle } = await import("../packages/backend/api.mjs");
const { query, db } = await import("../packages/backend/store.mjs");
const { paperTick, paperFill } = await import("../packages/backend/paper.mjs");
let owner,
  other,
  bid = 100,
  ask = 101,
  size = 1000;
const originalFetch = globalThis.fetch;
async function request(path, body, user = owner, key) {
  const r = await handle(
    new Request(process.env.APP_ORIGIN + "/api/v1/" + path, {
      method:
        body === undefined
          ? "GET"
          : path.startsWith("paper-protection/")
            ? "PATCH"
            : "POST",
      headers: {
        origin: process.env.APP_ORIGIN,
        "content-type": "application/json",
        cookie: user?.cookie ?? "",
        "x-csrf-token": user?.csrf ?? "",
        ...(key ? { "idempotency-key": key } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
const order = (extra = {}) => ({
  venue: "binance",
  market: "spot",
  symbol: "BTCUSDT",
  timeframe: "1h",
  direction: "LONG",
  quantity: 2,
  ...extra,
});
before(async () => {
  for (const email of ["paper@example.com", "other-paper@example.com"]) {
    const reg = await request("auth/register", {
      email,
      password: "paper-test-password-1234",
      consent: true,
    });
    assert.equal(reg.status, 201);
    const me = await request("auth/me", undefined, { cookie: reg.cookie });
    const u = {
      cookie: reg.cookie,
      csrf: me.data.csrfToken,
      id: me.data.user.id,
    };
    if (!owner) owner = u;
    else other = u;
  }
  globalThis.fetch = async (url) => {
    if (String(url).includes("/depth"))
      return Response.json({
        bids: [[String(bid), String(size)]],
        asks: [[String(ask), String(size)]],
      });
    if (String(url).includes("/ticker/24hr"))
      return Response.json([
        {
          symbol: "BTCUSDT",
          lastPrice: String(bid),
          priceChangePercent: "0",
          quoteVolume: "100000",
        },
      ]);
    throw new Error("Unexpected test network request: " + url);
  };
});
beforeEach(async () => {
  bid = 100;
  ask = 101;
  size = 1000;
  await query("DELETE FROM paper_orders");
  await query(
    "UPDATE paper_accounts SET balance=10000,initial_balance=10000,peak_equity=10000",
  );
  await query("UPDATE users SET settings=$1 WHERE id=$2", [{}, owner.id]);
});
after(async () => {
  globalThis.fetch = originalFetch;
  await (await db()).close();
});
test("limit reserves collateral, cannot fill beyond its price, cancellation refunds exactly once and stays tenant scoped", async () => {
  const r = await request(
    "paper/orders",
    order({
      orderType: "limit",
      limitPrice: 99,
      stopLoss: 95,
      takeProfit: 110,
    }),
    owner,
    "limit-reserve-1",
  );
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.status, "pending");
  await paperTick();
  let a = (await request("paper/account")).data;
  assert.equal(a.orders[0].status, "pending");
  assert.equal(a.reserved, 198.198);
  assert.equal(a.equity, 10000);
  assert.equal(a.stats.openPositions, 0);
  assert.equal(
    (await request("paper-cancel/" + r.data.id, {}, other)).status,
    404,
  );
  assert.equal((await request("paper-cancel/" + r.data.id, {})).status, 200);
  assert.equal((await request("paper-cancel/" + r.data.id, {})).status, 200);
  a = (await request("paper/account")).data;
  assert.equal(+a.account.balance, 10000);
  assert.equal(a.reserved, 0);
  assert.equal(a.stats.closedTrades, 0);
});
test("limit fills full size only with executable depth and returns unused reservation", async () => {
  const r = await request(
    "paper/orders",
    order({ orderType: "limit", limitPrice: 100 }),
    owner,
    "limit-depth-1",
  );
  ask = 99;
  size = 1;
  await paperTick();
  assert.equal(
    (await request("paper/account")).data.orders[0].status,
    "pending",
  );
  size = 10;
  await Promise.all([paperTick(), paperTick()]);
  const a = (await request("paper/account")).data;
  assert.equal(a.orders[0].status, "filled");
  assert.equal(+a.orders[0].fill_price, 99);
  assert.equal(+a.account.balance, 9801.802);
  assert.equal(a.reserved, 0);
  assert.equal(a.engineActive, true);
});
test("partial exits allocate entry fees, retain SL/TP, replay safely and reconcile to full account balance", async () => {
  const r = await request(
    "paper/orders",
    order({ stopLoss: 95, takeProfit: 120 }),
    owner,
    "partial-entry-1",
  );
  assert.equal(r.status, 200);
  bid = 110;
  ask = 111;
  const responses = await Promise.all([
    request(
      "paper-close/" + r.data.id,
      { quantity: 1 },
      owner,
      "partial-close-1",
    ),
    request(
      "paper-close/" + r.data.id,
      { quantity: 1 },
      owner,
      "partial-close-1",
    ),
  ]);
  assert.ok(responses.every((r) => r.status === 200));
  assert.equal(responses[0].data.id, responses[1].data.id);
  let a = (await request("paper/account")).data;
  assert.equal(a.orders[0].status, "filled");
  assert.equal(+a.orders[0].quantity, 1);
  assert.equal(+a.orders[0].stop_loss, 95);
  assert.equal(a.exits.length, 1);
  assert.ok(Math.abs(a.stats.realizedPnl - 8.789) < 1e-8);
  assert.equal(a.stats.closedTrades, 0);
  assert.equal(
    (
      await request(
        "paper-close/" + r.data.id,
        { quantity: 2 },
        owner,
        "oversize-close",
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("paper-close/" + r.data.id, {}, owner, "final-close-1"))
      .status,
    200,
  );
  a = (await request("paper/account")).data;
  assert.equal(a.stats.closedTrades, 1);
  assert.equal(a.exits.length, 2);
  assert.ok(Math.abs(+a.account.balance - 10017.578) < 1e-8);
  assert.ok(Math.abs(a.stats.realizedPnl - 17.578) < 1e-8);
});
test("protection changes reject invalid levels and stale versions; stop executes at real gap price exactly once", async () => {
  const r = await request(
    "paper/orders",
    order({ stopLoss: 95, takeProfit: 120 }),
    owner,
    "stop-entry-1",
  );
  assert.equal(
    (
      await request("paper-protection/" + r.data.id, {
        version: r.data.version,
        stopLoss: 102,
        takeProfit: 120,
      })
    ).status,
    400,
  );
  const changed = await request("paper-protection/" + r.data.id, {
    version: r.data.version,
    stopLoss: 96,
    takeProfit: 120,
  });
  assert.equal(changed.status, 200);
  assert.equal(
    (
      await request("paper-protection/" + r.data.id, {
        version: r.data.version,
        stopLoss: 95,
        takeProfit: 120,
      })
    ).status,
    409,
  );
  bid = 90;
  ask = 91;
  await paperTick();
  await paperTick();
  const a = (await request("paper/account")).data;
  assert.equal(a.orders[0].status, "closed");
  assert.equal(+a.orders[0].close_price, 90);
  assert.equal(a.orders[0].close_reason, "stop_loss");
  assert.equal(a.exits.length, 1);
  assert.ok(Math.abs(a.stats.realizedPnl - -22.382) < 1e-8);
});
test("short take profit uses asks and protective trigger remains latched after a liquidity failure", async () => {
  const r = await request(
    "paper/orders",
    order({ direction: "SHORT", stopLoss: 110, takeProfit: 95 }),
    owner,
    "short-target-1",
  );
  assert.equal(r.status, 200);
  bid = 93;
  ask = 94;
  size = 1;
  await paperTick();
  let a = (await request("paper/account")).data;
  assert.equal(a.orders[0].pending_exit, "take_profit");
  assert.equal(a.orders[0].status, "filled");
  bid = 97;
  ask = 98;
  size = 100;
  await paperTick();
  a = (await request("paper/account")).data;
  assert.equal(a.orders[0].status, "closed");
  assert.equal(+a.orders[0].close_price, 98);
  assert.equal(a.orders[0].close_reason, "take_profit");
});
test("pending fills recheck daily loss guard and refund; invalid or stale quotes never fill", async () => {
  const r = await request(
    "paper/orders",
    order({ orderType: "limit", limitPrice: 100 }),
    owner,
    "guard-limit-1",
  );
  await query("UPDATE users SET settings=$1 WHERE id=$2", [
    { dailyLossLimit: 0.1 },
    owner.id,
  ]);
  const trade = await request(
    "paper/orders",
    order({ quantity: 1 }),
    owner,
    "guard-market-1",
  );
  assert.equal(trade.status, 200);
  await request("paper-close/" + trade.data.id, {}, owner, "guard-exit-1");
  ask = 99;
  await paperTick();
  const a = (await request("paper/account")).data;
  assert.equal(a.orders.find((o) => o.id === r.data.id).status, "cancelled");
  assert.equal(a.reserved, 0);
  for (const timestamp of [Date.now() - 11000, Date.now() + 100000, NaN])
    assert.throws(
      () =>
        paperFill({ timestamp, bids: [[100, 1]], asks: [[101, 1]] }, "LONG", 1),
      /stale_quote/,
    );
});
test("idempotency rejects changed input and concurrent distinct close commands cannot spend collateral twice", async () => {
  const r = await request("paper/orders", order(), owner, "replay-entry-1");
  assert.equal(r.status, 200);
  assert.equal(
    (await request("paper/orders", order(), owner, "replay-entry-1")).data.id,
    r.data.id,
  );
  assert.equal(
    (
      await request(
        "paper/orders",
        order({ quantity: 3 }),
        owner,
        "replay-entry-1",
      )
    ).status,
    409,
  );
  bid = 110;
  const results = await Promise.all([
    request("paper-close/" + r.data.id, {}, owner, "concurrent-exit-a"),
    request("paper-close/" + r.data.id, {}, owner, "concurrent-exit-b"),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409).length, 1);
  const a = (await request("paper/account")).data;
  assert.equal(a.exits.length, 1);
  assert.ok(Math.abs(+a.account.balance - 10017.578) < 1e-8);
});
test("stops can move into profit against current market, protection is removable and partial requests require replay keys", async () => {
  const r = await request(
    "paper/orders",
    order({ stopLoss: 95, takeProfit: 120 }),
    owner,
    "profit-stop-entry",
  );
  bid = 110;
  ask = 111;
  let changed = await request("paper-protection/" + r.data.id, {
    version: r.data.version,
    stopLoss: 105,
    takeProfit: 120,
  });
  assert.equal(changed.status, 200);
  assert.equal(
    (await request("paper-close/" + r.data.id, { quantity: 1 })).status,
    400,
  );
  changed = await request("paper-protection/" + r.data.id, {
    version: changed.data.version,
    stopLoss: null,
    takeProfit: null,
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.stop_loss, null);
  assert.equal(changed.data.take_profit, null);
  assert.equal(
    (
      await request(
        "paper/orders",
        order({ quantity: 1e-12 }),
        owner,
        "tiny-invalid-entry",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        "paper-close/" + r.data.id,
        { quantity: 2 - 1e-9 },
        owner,
        "dust-exit-request",
      )
    ).status,
    400,
  );
});
