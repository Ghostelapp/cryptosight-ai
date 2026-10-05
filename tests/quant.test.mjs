import { test } from "node:test";
import assert from "node:assert/strict";
import { indicators, heikinAshi } from "../packages/quant/indicators.mjs";
import {
  positionSize,
  evaluateSetup,
  backtest,
  correlation,
} from "../packages/quant/research.mjs";
import {
  normalizeRows,
  nextTime,
  parseStream,
  providerFrame,
} from "../packages/market/providers.mjs";
export const candles = Array.from({ length: 250 }, (_, j) => ({
  timestamp: Date.UTC(2026, 0, 1) + j * 3600000,
  open: 100 + j,
  close: 101 + j,
  high: 102 + j,
  low: 99 + j,
  volume: 10,
  closed: true,
}));
test("indicator reference vectors and forming-candle exclusion", () => {
  const r = indicators(candles);
  assert.equal(r.SMA[20], 340.5);
  assert.equal(r.RSI, 100);
  assert.equal(r.ATR, 3);
  assert.ok(r.ADX.adx > 90);
  assert.ok(Number.isFinite(r.Supertrend.value));
  assert.equal(r.bars, 250);
  const changed = indicators([
    ...candles,
    { ...candles.at(-1), timestamp: 1e15, close: 10000000, closed: false },
  ]);
  assert.deepEqual(changed, r);
  assert.equal(indicators(candles.slice(0, 5)).RSI, null);
  assert.equal(r.CVD.value, null);
});
test("Heikin Ashi is recursive and bounds body", () => {
  const r = heikinAshi(candles.slice(0, 3));
  assert.equal(r[0].close, 100.5);
  assert.equal(r[1].open, 100.5);
  assert.ok(r.every((b) => b.high >= b.open && b.low <= b.close));
});
test("position risk includes costs, caps collateral and rejects wrong stops", () => {
  const r = positionSize({
    account: 10000,
    riskPct: 1,
    entry: 100,
    stop: 95,
    leverage: 1,
  });
  assert.ok(r.maxLoss <= 100 + 1e-8);
  assert.equal(r.liquidationPrice, null);
  assert.throws(() =>
    positionSize({ account: 10000, riskPct: 1, entry: 100, stop: 105 }),
  );
  assert.throws(() =>
    positionSize({ account: 0, riskPct: 1, entry: 100, stop: 95 }),
  );
});
const setup = {
  direction: "LONG",
  entry: { type: "limit", price: 100 },
  stop_loss: 90,
  take_profits: [{ price: 120, size_pct: 100 }],
};
test("signal evaluator never assumes TP before SL in an ambiguous bar", () => {
  const r = evaluateSetup(
    setup,
    [
      { timestamp: 1, open: 105, high: 110, low: 100 },
      { timestamp: 2, open: 110, high: 121, low: 89 },
    ],
    { publishedAt: 1, expiresAt: 10 },
  );
  assert.equal(r.status, "ambiguous");
});
test("signal evaluator treats entry and exit in same bar as ambiguous", () =>
  assert.equal(
    evaluateSetup(setup, [{ timestamp: 1, open: 105, high: 121, low: 100 }], {
      publishedAt: 1,
      expiresAt: 10,
    }).status,
    "ambiguous",
  ));
test("signal evaluator ignores bars before publication and evaluates partial targets", () => {
  const r = evaluateSetup(
    setup,
    [
      { timestamp: 0, open: 100, high: 150, low: 50 },
      { timestamp: 1, open: 105, high: 110, low: 100 },
      { timestamp: 2, open: 110, high: 121, low: 105 },
    ],
    { publishedAt: 1, expiresAt: 10 },
  );
  assert.equal(r.status, "tp");
  assert.ok(r.pnl > 0);
});
test("backtest fills only after closed-bar signal, respects fees and leaves open trades explicit", () => {
  const oscillating = candles.map((b, j) => ({
    ...b,
    open: 100 + Math.sin(j / 6) * 10,
    close: 100 + Math.sin(j / 6) * 10,
  }));
  const a = backtest(oscillating, {
      fast: 5,
      slow: 10,
      feeBps: 0,
      slippageBps: 0,
    }),
    b = backtest(oscillating, {
      fast: 5,
      slow: 10,
      feeBps: 20,
      slippageBps: 10,
    });
  assert.ok(a.trades.length > 0);
  assert.ok(b.equity < a.equity);
  assert.throws(() => backtest(candles, { fast: 50, slow: 20 }));
});
test("aligned-return correlation has sample counts and no invented values", () => {
  const r = correlation({ A: candles, B: candles, C: candles.slice(0, 10) });
  assert.equal(r[0].values[1].value, 1);
  assert.equal(r[0].values[2].value, null);
});
test("providers normalize reversed rows, monthly rollover and websocket candle formats", () => {
  const rows = [
    [2, "2", "3", "1", "2.5", "10"],
    [1, "1", "2", ".5", "1.5", "5"],
  ];
  assert.deepEqual(
    normalizeRows("bybit", rows, "1m", 1e9).map((c) => c.timestamp),
    [1, 2],
  );
  assert.equal(nextTime(Date.UTC(2026, 0, 1), "1M"), Date.UTC(2026, 1, 1));
  assert.equal(providerFrame("okx", "1d"), "1Dutc");
  assert.equal(
    parseStream("binance", {
      k: { t: 1, o: "1", h: "2", l: ".5", c: "1.5", v: "5", x: true },
    }).closed,
    true,
  );
  assert.equal(
    parseStream("bybit", {
      topic: "kline.5.BTCUSDT",
      data: [
        {
          start: 1,
          open: "1",
          high: "2",
          low: ".5",
          close: "1.5",
          volume: "5",
          confirm: true,
        },
      ],
    }).close,
    1.5,
  );
});
test("candle-close triggers cannot fill before the next bar", () => {
  const conditional = {
    ...setup,
    entry: { type: "market", price: 100 },
    trigger: { type: "candle_close_above", price: 105, timeframe: "1h" },
  };
  const r = evaluateSetup(
    conditional,
    [
      { timestamp: 1, open: 100, high: 130, low: 99, close: 106 },
      { timestamp: 2, open: 107, high: 110, low: 106, close: 109 },
      { timestamp: 3, open: 110, high: 121, low: 108, close: 120 },
    ],
    { publishedAt: 1, expiresAt: 10 },
  );
  assert.equal(r.status, "tp");
});
test("paper settlement never spends other positions collateral after an extreme short move", async () => {
  const { settlePaperPosition } =
    await import("../packages/quant/research.mjs");
  const short = settlePaperPosition({
    direction: "SHORT",
    entry: 100,
    exit: 300,
    quantity: 10,
    entryFees: 1,
  });
  assert.equal(short.collateralExhausted, true);
  assert.equal(short.returnedCollateral, 0);
  assert.equal(short.pnl, -1001);
  const long = settlePaperPosition({
    direction: "LONG",
    entry: 100,
    exit: 110,
    quantity: 2,
    entryFees: 0.2,
  });
  assert.ok(Math.abs(long.pnl - 19.58) < 1e-9);
  assert.ok(Math.abs(long.returnedCollateral - 219.78) < 1e-9);
});
