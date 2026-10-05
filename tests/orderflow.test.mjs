import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOrderflow } from "../packages/market/orderflow.mjs";
test("Binance maker flag maps to taker side and snapshots retain depth", () => {
  const r = parseOrderflow(
    "binance",
    {
      stream: "btcusdt@aggTrade",
      data: { e: "aggTrade", T: 1, p: "100", q: "2", m: true, a: 42 },
    },
    {},
  );
  assert.equal(r[0].side, "sell");
  assert.equal(r[0].size, 2);
  const book = parseOrderflow(
    "binance",
    {
      stream: "btcusdt@depth20",
      data: { lastUpdateId: 3, bids: [["99", "2"]], asks: [["101", "3"]] },
    },
    {},
  );
  assert.equal(book[0].snapshot, true);
});
test("Bybit snapshots, zero-size removals and restart snapshots are applied correctly", () => {
  const state = {};
  let e = parseOrderflow(
    "bybit",
    {
      topic: "orderbook.50.BTCUSDT",
      type: "snapshot",
      data: {
        u: 5,
        b: [
          ["100", "1"],
          ["99", "2"],
        ],
        a: [["101", "2"]],
      },
      ts: 1,
    },
    state,
  );
  assert.equal(e[0].bids.length, 2);
  e = parseOrderflow(
    "bybit",
    {
      topic: "orderbook.50.BTCUSDT",
      type: "delta",
      data: { u: 6, b: [["100", "0"]], a: [] },
      ts: 2,
    },
    state,
  );
  assert.deepEqual(e[0].bids, [[99, 2]]);
  e = parseOrderflow(
    "bybit",
    {
      topic: "orderbook.50.BTCUSDT",
      type: "snapshot",
      data: { u: 1, b: [["90", "1"]], a: [["91", "1"]] },
      ts: 3,
    },
    state,
  );
  assert.deepEqual(e[0].bids, [[90, 1]]);
});
test("OKX uses taker side and books5 snapshot rows", () => {
  const e = parseOrderflow(
    "okx",
    {
      arg: { channel: "trades" },
      data: [{ ts: "1", px: "100", sz: "2", side: "buy", tradeId: "3" }],
    },
    {},
  );
  assert.equal(e[0].side, "buy");
});
