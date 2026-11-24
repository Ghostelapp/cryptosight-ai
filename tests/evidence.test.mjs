import { test } from "node:test";
import assert from "node:assert/strict";
import {
  researchFrames,
  closedBars,
  frameEvidence,
  executionEvidence,
  alignedCorrelation,
  setupMetrics,
} from "../packages/quant/evidence.mjs";
import { snapshot } from "../packages/ai/agent.mjs";
import { indicators } from "../packages/quant/indicators.mjs";
import { intervalMs, nextTime } from "../packages/market/providers.mjs";

function candles(timeframe = "1h", count = 300) {
  const step = intervalMs(timeframe),
    end = Math.floor(Date.now() / step) * step;
  return Array.from({ length: count }, (_, n) => ({
    timestamp: end - (count - n) * step,
    open: 100 + n * 0.1,
    close: 100 + n * 0.1 + 0.05,
    high: 101 + n * 0.1,
    low: 99 + n * 0.1,
    volume: 100 + (n % 17),
    closed: true,
  }));
}
const feeds = {
  history: async (i) => ({
    instrument: i,
    candles: candles(i.timeframe),
    provenance: { source: i.venue, stale: false },
  }),
  instrumentMetadata: async (i) => ({
    ...i,
    tickSize: 0.01,
    quantityStep: 0.001,
  }),
  derivatives: async () => ({ unavailableReason: "spot_market" }),
  calendar: async () => ({ unavailableReason: "calendar_not_configured" }),
  context: async () => ({ global: { btcDominance: 55 } }),
  news: async () => ({ items: [] }),
  onchain: async () => ({ unavailableReason: "not_configured" }),
  sentiment: async () => ({ unavailableReason: "not_configured" }),
  liquidations: async () => ({ unavailableReason: "not_configured" }),
  depth: async () => ({
    source: "binance",
    timestamp: Date.now(),
    bids: [[129.9, 10]],
    asks: [[130.1, 10]],
  }),
};
test("research context adapts to scalping and weekly horizons without duplicate frames", () => {
  assert.deepEqual(researchFrames("1m", "deep"), ["1m", "15m", "1h"]);
  assert.deepEqual(researchFrames("1h", "deep"), ["1h", "4h", "1d"]);
  assert.deepEqual(researchFrames("1w", "deep"), ["1w", "1d", "1M"]);
  assert.deepEqual(researchFrames("1d", "quick"), ["1d"]);
});
test("closed-bar normalization excludes lookahead, malformed OHLC and duplicate timestamps", () => {
  const c = candles();
  const future = {
    ...c.at(-1),
    timestamp: Date.now(),
    close: 999999,
    high: 1000000,
  };
  const rows = closedBars([...c, c[0], future, { ...c[1], low: 1000 }], "1h");
  assert.equal(rows.length, 300);
  assert.equal(rows.at(-1).close, c.at(-1).close);
});
test("frame evidence detects gaps and calculates volume relative to prior bars", () => {
  const c = candles(),
    removed = c.filter((_, n) => n !== 290),
    stats = frameEvidence(removed, "1h", indicators(removed));
  assert.equal(stats.gaps, 1);
  assert.equal(stats.closedBars, 299);
  assert.equal(stats.trend, "bullish");
  assert.ok(stats.atrPct > 0);
  assert.ok(stats.volumeRatio20 > 0);
  assert.ok(stats.volatilityPerBarPct >= 0);
  assert.ok(stats.lastCloseAt);
});
test("calendar-month closing boundaries do not assume a 30-day month", () => {
  assert.equal(nextTime(Date.UTC(2026, 0, 1), "1M"), Date.UTC(2026, 1, 1));
  const c = {
    timestamp: Date.UTC(2026, 0, 1),
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1,
    closed: true,
  };
  assert.equal(closedBars([c], "1M", Date.UTC(2026, 0, 31)).length, 0);
  assert.equal(closedBars([c], "1M", Date.UTC(2026, 1, 1)).length, 1);
});
test("execution snapshot rejects crossed and stale books and avoids false USD notionals for contracts", () => {
  const now = Date.now(),
    book = {
      timestamp: now,
      bids: [[99, 2]],
      asks: [[101, 1]],
      source: "binance",
    };
  const result = executionEvidence(book, "spot", now);
  assert.equal(result.spreadBps, 200);
  assert.equal(result.bidNotional, 198);
  assert.equal(result.displayedImbalance, 1 / 3);
  assert.equal(executionEvidence(book, "perpetual", now).bidNotional, null);
  assert.equal(
    executionEvidence({ ...book, timestamp: now - 16000 }, "spot", now)
      .available,
    false,
  );
  assert.equal(
    executionEvidence({ ...book, bids: [[102, 1]] }, "spot", now).available,
    false,
  );
});
test("correlation aligns returns by timestamp and reports unknown for zero variance", () => {
  const c = candles();
  assert.ok(alignedCorrelation(c, c).value > 0.999);
  const flat = c.map((b) => ({ ...b, close: 100 }));
  assert.equal(alignedCorrelation(c, flat).value, null);
  assert.equal(alignedCorrelation(c.slice(0, 10), c).value, null);
});
test("net risk/reward and break-even account for explicit fees, slippage and spread", () => {
  const result = {
    setups: [
      {
        direction: "LONG",
        entry: { price: 100 },
        stop_loss: 90,
        take_profits: [{ price: 120, size_pct: 100 }],
      },
    ],
  };
  const [metric] = setupMetrics(result, {
    execution: { available: true, spreadBps: 0 },
  });
  assert.equal(metric.grossRR, 2);
  assert.ok(Math.abs(metric.netRR - 19.7 / 10.3) < 1e-10);
  assert.ok(Math.abs(metric.breakEvenWinRatePct - (10.3 / 30) * 100) < 1e-10);
  assert.equal(metric.assumedRoundTripCostBps, 30);
  assert.equal(
    setupMetrics({ setups: [{ direction: "NO_TRADE" }] }, {}).length,
    0,
  );
});
test("deep snapshot tolerates optional-source failures while keeping indicators on closed candles", async () => {
  const snap = await snapshot({ symbol: "ETHUSDT", timeframe: "1h" }, "deep", {
    ...feeds,
    news: async () => {
      throw Error("private upstream detail");
    },
  });
  assert.equal(snap.analysisMode, "deep");
  assert.equal(snap.research.frames.length, 3);
  assert.equal(snap.research.status, "partial");
  assert.ok(snap.research.missingSources.includes("news"));
  assert.equal(snap.research.benchmark.samples, 60);
  assert.ok(snap.research.benchmark.value > 0.999);
  assert.equal(snap.frames["1h"].ohlcv.length, 60);
  assert.ok(JSON.stringify(snap).length < 65000);
  assert.ok(!JSON.stringify(snap).includes("private upstream detail"));
});
test("missing secondary timeframes are explicit, while missing primary data blocks analysis", async () => {
  const history = async (i) => {
    if (i.timeframe !== "1h") throw Error("unavailable");
    return feeds.history(i);
  };
  const snap = await snapshot({ timeframe: "1h" }, "deep", {
    ...feeds,
    history,
  });
  assert.deepEqual(snap.research.missingFrames, ["4h", "1d"]);
  assert.ok(snap.frames["1h"]);
  await assert.rejects(
    snapshot({ timeframe: "1h" }, "deep", {
      ...feeds,
      history: async (i) => ({ ...(await feeds.history(i)), candles: [] }),
    }),
    /insufficient_fresh_data/,
  );
});
test("snapshot starts auxiliary feeds while primary history is still pending", async () => {
  let release,
    auxiliaryStarted = false;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const pending = snapshot({ timeframe: "1h" }, "quick", {
    ...feeds,
    history: async (i) => {
      await gate;
      return feeds.history(i);
    },
    depth: async () => {
      auxiliaryStarted = true;
      return feeds.depth();
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(auxiliaryStarted, true);
  release();
  await pending;
});
