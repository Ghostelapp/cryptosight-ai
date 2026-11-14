import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWorkspace } from "../apps/web/lib/workspace.mjs";
import { screenMarkets } from "../packages/market/screener.mjs";
import {
  journalStats,
  journalCsv,
  tradePnl,
} from "../packages/quant/journal.mjs";
import { positionSize } from "../packages/quant/research.mjs";
import { projectRoot } from "../packages/backend/paths.mjs";
import { resolve } from "node:path";

test("project root resolves the workspace cwd on Windows and honors deployments", () => {
  const root = resolve(".");
  assert.equal(projectRoot(resolve(root, "apps/web"), ""), root);
  assert.equal(projectRoot(root, ""), root);
  assert.equal(
    projectRoot(resolve(root, "apps/web"), "deployment-root"),
    "deployment-root",
  );
});

test("workspace restore validates corrupt values and keeps account data out", () => {
  const saved = normalizeWorkspace(
    {
      instrument: {
        venue: "fake",
        market: "spot",
        symbol: "<script>",
        timeframe: "4h",
      },
      chartType: "area",
      layout: 3,
      period: -1,
      indicatorNames: ["EMA", "EMA", "EVIL"],
      panelOrder: ["chart", "chart"],
      demo: true,
      key: "secret",
    },
    ["EMA", "RSI"],
  );
  assert.deepEqual(saved.instrument, {
    venue: "binance",
    market: "spot",
    symbol: "BTCUSDT",
    timeframe: "4h",
  });
  assert.equal(saved.chartType, "area");
  assert.equal(saved.layout, 1);
  assert.equal(saved.period, 20);
  assert.deepEqual(saved.indicatorNames, ["EMA"]);
  assert.deepEqual(saved.panelOrder, ["chart", "analysis"]);
  assert.equal("demo" in saved, false);
  assert.equal("key" in saved, false);
  assert.deepEqual(normalizeWorkspace(null, ["EMA", "RSI"]).indicatorNames, [
    "EMA",
    "RSI",
  ]);
});

const markets = [
  { symbol: "BTCUSDT", price: 100, volume: 50e6, change: 4 },
  { symbol: "ETHUSDT", price: 50, volume: 20e6, change: -2 },
  { symbol: "SOLUSDT", price: 10, volume: 5e6, change: 8 },
  { symbol: "XRPUSDT", price: null, volume: 15e6, change: null },
];
test("screener combines volume, movement, normalized search and watchlist without mutation", () => {
  assert.deepEqual(
    screenMarkets(markets, { minVolume: 10e6, movement: "gainers" }).map(
      (r) => r.symbol,
    ),
    ["BTCUSDT"],
  );
  assert.deepEqual(
    screenMarkets(markets, {
      movement: "losers",
      favoritesOnly: true,
      watchlist: ["ETHUSDT"],
      search: " eth ",
    }).map((r) => r.symbol),
    ["ETHUSDT"],
  );
  assert.equal(screenMarkets(markets, { search: "none" }).length, 0);
  assert.equal(markets[0].symbol, "BTCUSDT");
});
test("screener sorts numbers both ways and leaves missing values last", () => {
  assert.deepEqual(
    screenMarkets(markets, { sort: "price", order: "asc" }).map(
      (r) => r.symbol,
    ),
    ["SOLUSDT", "ETHUSDT", "BTCUSDT", "XRPUSDT"],
  );
  assert.deepEqual(
    screenMarkets(markets, { sort: "change", order: "desc" }).map(
      (r) => r.symbol,
    ),
    ["SOLUSDT", "BTCUSDT", "ETHUSDT", "XRPUSDT"],
  );
});

const trade = (id, exit, overrides = {}) => ({
  id: String(id),
  created_at: `2026-11-${String(id).padStart(2, "0")}T12:00:00Z`,
  symbol: "BTCUSDT",
  side: "LONG",
  entry: "100",
  exit: String(exit),
  quantity: "1",
  fees: "1",
  notes: "",
  ...overrides,
});
test("journal uses recording order, fees, short PnL and absolute peak drawdown", () => {
  const entries = [
    trade(3, 90, { side: "SHORT" }),
    trade(1, 120),
    trade(2, 90),
  ];
  const stats = journalStats(entries);
  assert.equal(stats.total, 17);
  assert.equal(stats.maxDrawdown, 11);
  assert.equal(stats.average, 17 / 3);
  assert.equal(stats.winRate, (2 / 3) * 100);
  assert.equal(stats.profitFactor, 28 / 11);
  assert.deepEqual(
    stats.curve.map((p) => p.pnl),
    [0, 19, 8, 17],
  );
  assert.equal(entries[0].id, "3");
  assert.equal(tradePnl(trade(1, 100)), -1);
});
test("journal empty, all-win and all-loss cases do not invent ratios", () => {
  assert.equal(journalStats([]).winRate, null);
  assert.equal(journalStats([]).maxDrawdown, null);
  assert.equal(journalStats([trade(1, 110)]).noLosses, true);
  assert.equal(journalStats([trade(1, 90)]).profitFactor, 0);
  assert.equal(journalStats([trade(1, 90)]).maxDrawdown, 11);
});
test("journal CSV quotes multiline text, escapes formulas and preserves negative numbers", () => {
  const csv = journalCsv([
    trade(1, 90, { notes: '=SUM(1,2)\n"example"' }),
    trade(2, 110, { notes: " \t@formula" }),
  ]);
  assert.ok(csv.startsWith('\uFEFF"recorded_at"'));
  assert.ok(csv.includes('"\'=SUM(1,2)\n""example"""'));
  assert.ok(csv.includes('"-11"'));
  assert.ok(csv.includes('"\' \t@formula"'));
});

test("risk target reports net rewards and a break-even price for long and short", () => {
  for (const direction of ["LONG", "SHORT"]) {
    const config = {
      account: 10000,
      riskPct: 1,
      entry: 100,
      stop: direction === "LONG" ? 95 : 105,
      target: direction === "LONG" ? 110 : 90,
      direction,
      feeBps: 10,
      slippageBps: 5,
    };
    const result = positionSize(config);
    assert.ok(result.maxLoss <= 100 + 1e-8);
    assert.ok(
      Math.abs(result.netProfit - (result.grossProfit - result.targetCosts)) <
        1e-8,
    );
    assert.equal(result.rewardRisk, result.netProfit / result.maxLoss);
    const atBreakEven = positionSize({
      ...config,
      target: result.breakEvenPrice,
    });
    assert.ok(Math.abs(atBreakEven.netProfit) < 1e-8);
    assert.throws(() => positionSize({ ...config, target: config.stop }));
  }
});
test("risk target rejects non-finite targets and impossible costs, and warns about unprofitable targets", () => {
  const config = { account: 10000, riskPct: 1, entry: 100, stop: 95 };
  assert.equal(positionSize(config).target, null);
  assert.throws(() => positionSize({ ...config, target: NaN }));
  assert.throws(() => positionSize({ ...config, target: Infinity }));
  assert.throws(() => positionSize({ ...config, feeBps: 10000 }));
  assert.ok(
    positionSize({ ...config, target: 100.01 }).warnings.includes(
      "target_below_costs",
    ),
  );
});
