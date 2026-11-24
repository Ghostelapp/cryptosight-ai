import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAIChartPlan,
  buildAIChartContext,
  packAIChartLabels,
} from "../packages/market/ai-chart.mjs";
const instrument = {
  symbol: "BTCUSDT",
  timeframe: "1h",
  venue: "bybit",
  market: "spot",
};
test("observation context uses nearest real AI levels, deduplicates and never invents missing prices", () => {
  const a = {
    key_levels: {
      support: [70, 95, 90, 95, NaN, -1, "99"],
      resistance: [120, 105, 110],
    },
  };
  const before = structuredClone(a);
  assert.deepEqual(
    buildAIChartContext(a, 100, [], 2).map((l) => l.price),
    [95, 90, 105, 110],
  );
  assert.deepEqual(
    buildAIChartContext(a, 100, [{ price: 95 }], 1).map((l) => l.price),
    [90, 105],
  );
  assert.deepEqual(buildAIChartContext({}, 100), []);
  assert.deepEqual(a, before);
});
const setup = {
  direction: "LONG",
  entry: { price: 100, zone: [99, 101] },
  trigger: { price: 100 },
  stop_loss: 90,
  take_profits: [{ price: 120, size_pct: 100 }],
};
const analysis = {
  symbol: "BTCUSDT",
  timeframe: "1h",
  setups: [
    setup,
    {
      ...setup,
      direction: "SHORT",
      stop_loss: 110,
      take_profits: [{ price: 80, size_pct: 100 }],
    },
  ],
};
test("chart draws only the selected scenario and merges coincident activation and entry", () => {
  const plan = buildAIChartPlan(analysis, instrument);
  assert.deepEqual(
    plan.levels.map((l) => l.price),
    [100, 90, 120],
  );
  assert.equal(plan.levels[0].kind, "entry_trigger");
  assert.deepEqual(plan.bounds, { low: 90, high: 120 });
  assert.deepEqual(
    buildAIChartPlan(analysis, instrument, 1).levels.map((l) => l.price),
    [100, 110, 80],
  );
  const separate = structuredClone(analysis);
  separate.setups[0].trigger.price = 102;
  assert.equal(
    buildAIChartPlan(separate, instrument).levels.find(
      (l) => l.kind === "trigger",
    ).price,
    102,
  );
});
test("chart rejects a different instrument, timeframe, market, demo or malformed levels", () => {
  for (const change of [{ symbol: "ETHUSDT" }, { timeframe: "4h" }])
    assert.equal(
      buildAIChartPlan(analysis, { ...instrument, ...change }),
      null,
    );
  assert.equal(
    buildAIChartPlan(analysis, instrument, 0, {
      venue: "binance",
      market: "spot",
    }),
    null,
  );
  assert.equal(
    buildAIChartPlan(analysis, instrument, 0, instrument, true),
    null,
  );
  assert.equal(
    buildAIChartPlan(
      { ...analysis, setups: [{ ...setup, stop_loss: NaN }] },
      instrument,
    ),
    null,
  );
  assert.equal(buildAIChartPlan(analysis, instrument, 999).index, 0);
});
test("NO_TRADE never produces entry or target geometry", () => {
  const plan = buildAIChartPlan(
    { ...analysis, setups: [{ direction: "NO_TRADE", reasoning: "Wait" }] },
    instrument,
  );
  assert.equal(plan.noTrade, true);
  assert.deepEqual(plan.levels, []);
  assert.equal(plan.bounds, undefined);
});
test("crowded and offscreen labels keep true anchors, fit inside the panel, and never overlap", () => {
  const levels = [-40, 1, 2, 3, 400, 401].map((y, priority) => ({
    y,
    priority,
    id: String(priority),
  }));
  const original = structuredClone(levels),
    rows = packAIChartLabels(levels, 220, 22, 14);
  rows.forEach((r, n) => {
    assert.ok(r.labelY >= 14 && r.labelY <= 206);
    if (n) assert.ok(r.labelY - rows[n - 1].labelY >= 22);
    assert.equal(r.y, levels[Number(r.id)].y);
  });
  assert.equal(rows[0].outside, true);
  assert.equal(rows[0].anchorY, 0);
  assert.equal(rows.at(-1).anchorY, 220);
  assert.deepEqual(levels, original);
  assert.deepEqual(
    packAIChartLabels(levels, 80, 20, 10).map((l) => l.priority),
    [0, 1, 2],
  );
  assert.deepEqual(packAIChartLabels(levels, 10), []);
});
