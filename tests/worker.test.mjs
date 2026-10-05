import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const candles = Array.from({ length: 100 }, (_, j) => ({
  timestamp: Date.UTC(2026, 1, 1) + j * 60000,
  open: 100 + j,
  close: 101 + j,
  high: 102 + j,
  low: 99 + j,
  volume: 10,
}));
test("indicator worker computes aligned off-thread reference series", () => {
  let response;
  const context = vm.createContext({
    window: {},
    postMessage: (x) => (response = x),
  });
  context.self = context;
  context.importScripts = () =>
    vm.runInContext(
      readFileSync("apps/web/public/workers/technicalindicators.js", "utf8"),
      context,
    );
  vm.runInContext(
    readFileSync("apps/web/public/workers/indicators.js", "utf8"),
    context,
  );
  context.self.onmessage({ data: { id: 1, name: "SMA", candles, period: 20 } });
  assert.equal(response.result.length, 100);
  assert.equal(response.result.at(-1).value, 190.5);
  for (const name of [
    "ADX",
    "ATR",
    "CCI",
    "WR",
    "MFI",
    "STOCHRSI",
    "ICHIMOKU",
    "KELTNER",
    "DONCHIAN",
    "VWAP",
    "SUPERTREND",
  ]) {
    context.self.onmessage({ data: { id: 2, name, candles, period: 14 } });
    assert.equal(response.result.length, 100, name);
    assert.ok(Object.keys(response.result.at(-1)).length > 0, name);
  }
});
