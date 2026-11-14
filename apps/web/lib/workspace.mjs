export const workspaceKey = "cryptosight.workspace.v1";
export const defaultWorkspace = {
  instrument: {
    venue: "binance",
    market: "spot",
    symbol: "BTCUSDT",
    timeframe: "1h",
  },
  chartType: "candles",
  layout: 1,
  indicatorNames: ["EMA", "RSI"],
  period: 20,
  panelOrder: ["chart", "analysis"],
  allowFallback: true,
};

// Read an allowlist only: never restore credentials, account data or sample mode.
export function normalizeWorkspace(value, allowedIndicators) {
  const input = value && typeof value === "object" ? value : {};
  const i = input.instrument || {};
  const pick = (value, options, fallback) =>
    options.includes(value) ? value : fallback;
  return {
    instrument: {
      venue: pick(i.venue, ["binance", "bybit", "okx"], "binance"),
      market: pick(i.market, ["spot", "perpetual"], "spot"),
      symbol:
        typeof i.symbol === "string" && /^[A-Z0-9]{2,20}USDT$/.test(i.symbol)
          ? i.symbol
          : "BTCUSDT",
      timeframe: pick(
        i.timeframe,
        [
          "1m",
          "3m",
          "5m",
          "15m",
          "30m",
          "1h",
          "2h",
          "4h",
          "6h",
          "12h",
          "1d",
          "1w",
          "1M",
        ],
        "1h",
      ),
    },
    chartType: pick(
      input.chartType,
      ["candles", "heikin", "line", "area"],
      "candles",
    ),
    layout: pick(input.layout, [1, 2, 4], 1),
    indicatorNames: Array.isArray(input.indicatorNames)
      ? [
          ...new Set(
            input.indicatorNames.filter((name) =>
              allowedIndicators.includes(name),
            ),
          ),
        ].slice(0, 24)
      : [...defaultWorkspace.indicatorNames],
    period:
      Number.isInteger(input.period) && input.period >= 2 && input.period <= 200
        ? input.period
        : 20,
    panelOrder:
      Array.isArray(input.panelOrder) &&
      input.panelOrder.length === 2 &&
      new Set(input.panelOrder).size === 2 &&
      input.panelOrder.every((p) => ["chart", "analysis"].includes(p))
        ? input.panelOrder
        : [...defaultWorkspace.panelOrder],
    allowFallback:
      typeof input.allowFallback === "boolean" ? input.allowFallback : true,
  };
}
