import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCandidate,
  confirmationFrame,
} from "../packages/quant/candidates.mjs";
import { collectCandidates } from "../packages/backend/candidate-scanner.mjs";
import { intervalMs } from "../packages/market/providers.mjs";

function bars(timeframe = "1h", short = false) {
  const step = intervalMs(timeframe),
    end = Math.floor(Date.now() / step) * step;
  return Array.from({ length: 220 }, (_, n) => {
    let row = {
      timestamp: end - (220 - n) * step,
      open: 109,
      close: 110,
      high: 111,
      low: 108,
      volume: 100,
      closed: true,
    };
    if (n === 219)
      row = { ...row, open: 111, close: 112, high: 113, low: 110, volume: 200 };
    return short
      ? {
          ...row,
          open: 220 - row.open,
          close: 220 - row.close,
          high: 220 - row.low,
          low: 220 - row.high,
        }
      : row;
  });
}
const metrics = {
  EMA: { 20: 108, 50: 105, 200: 100 },
  ATR: 2,
  RSI: 58,
  ADX: { adx: 30 },
  MACD: { histogram: 1 },
};
function input(short = false) {
  const m = short
    ? {
        ...metrics,
        EMA: { 20: 112, 50: 115, 200: 120 },
        RSI: 42,
        MACD: { histogram: -1 },
      }
    : metrics;
  return {
    instrument: {
      venue: "binance",
      market: "spot",
      symbol: "BTCUSDT",
      timeframe: "1h",
    },
    primary: { candles: bars("1h", short), provenance: { stale: false } },
    confirmation: { candles: bars("4h", short), provenance: { stale: false } },
    indicators: m,
    confirmationIndicators: m,
    volume: 50000000,
  };
}
test("confirmed trend, volume and breakout produce a waiting LONG plan with coherent levels", () => {
  const row = evaluateCandidate(input());
  assert.equal(row.status, "wait_confirmation");
  assert.equal(row.direction, "LONG");
  assert.equal(row.trigger.type, "candle_close_above");
  assert.ok(row.stop < row.trigger.price);
  assert.ok(row.targets.every((t) => t.price > row.trigger.price));
  assert.ok(row.netRR >= 1.2);
  assert.equal(row.spreadIncluded, false);
  assert.ok(row.score > 70 && row.score <= 100);
});
test("SHORT geometry is symmetric and is still a research scenario on spot", () => {
  const row = evaluateCandidate(input(true));
  assert.equal(row.direction, "SHORT");
  assert.equal(row.status, "wait_confirmation");
  assert.equal(row.trigger.type, "candle_close_below");
  assert.ok(row.stop > row.trigger.price);
  assert.ok(row.targets.every((t) => t.price < row.trigger.price));
  assert.equal(row.market, "spot");
});
test("low volume and overextended RSI stay on watch instead of generating entry levels", () => {
  const data = input();
  data.primary.candles.at(-1).volume = 50;
  data.indicators = { ...metrics, RSI: 90 };
  const row = evaluateCandidate(data);
  assert.equal(row.status, "watch");
  assert.ok(row.unmet.includes("volume"));
  assert.ok(row.unmet.includes("rsi"));
  assert.equal(row.trigger, undefined);
});
test("stale data, gaps, missing warmup and opposing context cannot produce candidates", () => {
  let data = input();
  data.primary.provenance.stale = true;
  assert.equal(evaluateCandidate(data), null);
  data = input();
  data.primary.candles.splice(210, 1);
  assert.equal(evaluateCandidate(data), null);
  data = input();
  data.primary.candles = data.primary.candles.slice(-100);
  assert.equal(evaluateCandidate(data), null);
  data = input();
  data.confirmationIndicators = { ...metrics, EMA: { 20: 100, 50: 115 } };
  assert.equal(evaluateCandidate(data), null);
});
test("candle-close expiry is explicit and confirmation timeframe follows the selected horizon", () => {
  assert.equal(confirmationFrame("5m"), "1h");
  assert.equal(confirmationFrame("1d"), "1w");
  const row = evaluateCandidate(input());
  assert.ok(Date.parse(row.expiresAt) > Date.now());
  assert.ok(Date.parse(row.expiresAt) > Date.parse(row.observedAt));
});
test("market scan uses bounded concurrency, excludes stablecoins and isolates provider failures", async () => {
  let active = 0,
    max = 0,
    requests = 0;
  const quotes = Array.from({ length: 8 }, (_, n) => ({
    symbol: "COIN" + n + "USDT",
    price: 110,
    volume: 50000000 - n,
  }));
  const report = await collectCandidates(
    {
      venue: "binance",
      market: "spot",
      timeframe: "1h",
      limit: 6,
      direction: "LONG",
    },
    {
      tickers: async () => [
        ...quotes,
        { symbol: "USDCUSDT", price: 1, volume: 1e12 },
      ],
      history: async (i) => {
        active++;
        max = Math.max(max, active);
        requests++;
        try {
          await new Promise((resolve) => setImmediate(resolve));
          if (i.symbol === "COIN0USDT") throw Error("private upstream error");
          return { candles: bars(i.timeframe), provenance: { stale: false } };
        } finally {
          active--;
        }
      },
      indicators: () => metrics,
    },
  );
  assert.equal(report.universeSize, 6);
  assert.equal(requests, 12);
  assert.ok(max <= 8);
  assert.equal(report.failed, 1);
  assert.equal(report.partial, true);
  assert.equal(report.candidates.length, 5);
  assert.ok(!JSON.stringify(report).includes("private upstream error"));
});
test("empty markets return an honest empty result without history requests", async () => {
  const report = await collectCandidates(
    { venue: "okx", market: "spot", timeframe: "1h" },
    {
      tickers: async () => [],
      history: async () => {
        throw Error("must not call");
      },
      indicators: () => metrics,
    },
  );
  assert.equal(report.universeSize, 0);
  assert.deepEqual(report.candidates, []);
  assert.equal(report.failed, 0);
});
