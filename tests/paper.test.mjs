import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
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
test("futures leverage reserves margin plus full notional fees and releases proportional margin on partial exits", async () => {
  const r = await request(
    "paper/orders",
    order({ market: "perpetual", leverage: 10 }),
    owner,
    "leveraged-entry",
  );
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.leverage, 10);
  let a = (await request("paper/account")).data;
  assert.ok(Math.abs(+a.account.balance - 9979.598) < 1e-8);
  assert.equal(a.exposure[0].collateral, 20.2);
  assert.ok(a.equity < 10000 && a.equity > 9997);
  assert.equal(
    (
      await request(
        "paper/orders",
        order({ market: "perpetual", leverage: 10 }),
        owner,
        "leveraged-entry",
      )
    ).data.id,
    r.data.id,
  );
  assert.equal(
    (
      await request(
        "paper/orders",
        order({ market: "perpetual", leverage: 5 }),
        owner,
        "leveraged-entry",
      )
    ).status,
    409,
  );
  bid = 110;
  assert.equal(
    (
      await request(
        "paper-close/" + r.data.id,
        { quantity: 1 },
        owner,
        "leveraged-partial",
      )
    ).status,
    200,
  );
  a = (await request("paper/account")).data;
  assert.ok(Math.abs(+a.account.balance - 9998.588) < 1e-8);
  assert.equal(a.exposure[0].collateral, 10.1);
  assert.equal(
    (await request("paper-close/" + r.data.id, {}, owner, "leveraged-final"))
      .status,
    200,
  );
  a = (await request("paper/account")).data;
  assert.ok(Math.abs(+a.account.balance - 10017.578) < 1e-8);
  assert.equal(a.orders[0].status, "closed");
});
test("leveraged limit reservation refunds cancellation once and price improvement releases excess margin", async () => {
  const pending = order({
    market: "perpetual",
    leverage: 5,
    orderType: "limit",
    limitPrice: 99,
  });
  let r = await request("paper/orders", pending, owner, "margin-limit-cancel");
  assert.equal(r.status, 200);
  assert.ok(Math.abs(+r.data.reserved - 39.798) < 1e-8);
  await request("paper-cancel/" + r.data.id, {});
  await request("paper-cancel/" + r.data.id, {});
  assert.equal(+(await request("paper/account")).data.account.balance, 10000);
  r = await request("paper/orders", pending, owner, "margin-limit-fill");
  bid = 97;
  ask = 98;
  assert.equal((await paperTick()).failures, 0);
  const a = (await request("paper/account")).data;
  assert.equal(a.orders.find((o) => o.id === r.data.id).status, "filled");
  assert.ok(Math.abs(+a.account.balance - 9960.604) < 1e-8);
  assert.equal(a.reserved, 0);
});
test("leveraged long and short margin exhaustion closes without spending free cash or another position's margin", async () => {
  for (const direction of ["LONG", "SHORT"]) {
    await query("DELETE FROM paper_orders");
    await query("UPDATE paper_accounts SET balance=10000");
    const r = await request(
      "paper/orders",
      order({ market: "perpetual", leverage: 10, direction }),
      owner,
      "liquidation-" + direction,
    );
    const other = await request(
      "paper/orders",
      order({ quantity: 1 }),
      owner,
      "other-margin-" + direction,
    );
    const balance = +(await request("paper/account")).data.account.balance;
    if (direction === "LONG") {
      bid = 80;
      ask = 81;
    } else {
      bid = 130;
      ask = 131;
    }
    assert.equal((await paperTick()).failures, 0);
    const a = (await request("paper/account")).data,
      o = a.orders.find((o) => o.id === r.data.id);
    assert.equal(o.status, "closed");
    assert.equal(o.close_reason, "liquidation");
    assert.equal(o.collateral_exhausted, true);
    assert.equal(+a.account.balance, balance);
    assert.equal(a.orders.find((o) => o.id === other.data.id).status, "filled");
    bid = 100;
    ask = 101;
  }
});
test("spot leverage and invalid leverage values are rejected before creating any order", async () => {
  for (const extra of [
    { leverage: 2 },
    { market: "perpetual", leverage: 0 },
    { market: "perpetual", leverage: 21 },
    { market: "perpetual", leverage: 1.5 },
  ])
    assert.equal(
      (
        await request(
          "paper/orders",
          order(extra),
          owner,
          "invalid-leverage-" + JSON.stringify(extra),
        )
      ).status,
      400,
    );
  assert.equal((await request("paper/account")).data.orders.length, 0);
});
test("concurrent leveraged entries cannot reserve the same available margin twice", async () => {
  const results = await Promise.all([
    request(
      "paper/orders",
      order({ market: "perpetual", leverage: 10, quantity: 600 }),
      owner,
      "concurrent-margin-a",
    ),
    request(
      "paper/orders",
      order({ market: "perpetual", leverage: 10, quantity: 600 }),
      owner,
      "concurrent-margin-b",
    ),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  const a = (await request("paper/account")).data;
  assert.equal(a.orders.length, 1);
  assert.ok(Math.abs(+a.account.balance - 3879.4) < 1e-8);
  const migration = await readFile(
    new URL("../db/008_paper_leverage.sql", import.meta.url),
    "utf8",
  );
  await (await db()).exec(migration);
  await (await db()).exec(migration);
  assert.equal((await request("paper/account")).data.orders[0].leverage, 10);
});

test("reapplying the paper migration preserves partial exits and backfills legacy trades once", async () => {
  const entry = await request(
    "paper/orders",
    order(),
    owner,
    "migration-entry",
  );
  assert.equal(entry.status, 200);
  bid = 110;
  assert.equal(
    (
      await request(
        "paper-close/" + entry.data.id,
        { quantity: 1 },
        owner,
        "migration-partial",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "paper-close/" + entry.data.id,
        {},
        owner,
        "migration-final",
      )
    ).status,
    200,
  );
  const before = (await request("paper/account")).data;
  assert.equal(before.exits.length, 2);
  const legacy = (
    await query(
      "INSERT INTO paper_orders(account_id,venue,market,symbol,direction,quantity,initial_quantity,status,order_type,fill_price,close_price,fees,pnl,closed_at,idempotency_key) VALUES($1,'binance','spot','BTCUSDT','LONG',1,1,'closed','market',100,110,0.1,9.79,now(),'legacy-migration') RETURNING id",
      [before.account.id],
    )
  ).rows[0];
  const migration = await readFile(
    new URL("../db/006_paper_trading.sql", import.meta.url),
    "utf8",
  );
  await (await db()).exec(migration);
  await (await db()).exec(migration);
  const after = (await request("paper/account")).data;
  assert.equal(after.exits.length, 3);
  assert.equal(
    after.exits.filter((exit) => exit.order_id === entry.data.id).length,
    2,
  );
  assert.equal(
    after.exits.filter((exit) => exit.order_id === legacy.id).length,
    1,
  );
  assert.ok(
    Math.abs(after.stats.realizedPnl - before.stats.realizedPnl - 9.79) < 1e-8,
  );
  assert.equal(after.account.balance, before.account.balance);
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
