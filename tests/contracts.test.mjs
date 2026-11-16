import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
const read = (p) =>
  JSON.parse(readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const ajv = new Ajv({ strict: true });
addFormats(ajv);
const validate = ajv.compile(read("packages/contracts/analysis.schema.json"));
const sample = {
  symbol: "BTCUSDT",
  timeframe: "1h",
  timestamp: "2026-10-04T12:00:00Z",
  market_regime: "ranging",
  bias: "neutral",
  confidence: 20,
  key_levels: { support: [], resistance: [], liquidity_zones: [] },
  setups: [
    {
      direction: "NO_TRADE",
      reasoning: "Insufficient closed candles",
      invalidation: "Sufficient fresh data arrives",
      timing: "Wait for a complete snapshot",
      time_horizon: "intraday",
    },
  ],
  risk: {
    level: "high",
    factors: ["Missing data"],
    volatility_note: "Unknown",
    event_risk: "Calendar unavailable",
  },
  scenarios: { bull_case: "Unknown", bear_case: "Unknown", base_case: "Wait" },
  summary_short: "Wait",
  summary_detailed: "No actionable setup due to missing data",
};
test("strict schema accepts NO_TRADE without fabricated prices", () =>
  assert.equal(validate(sample), true, JSON.stringify(validate.errors)));
test("schema rejects unknown keys, invalid confidence and missing protection", () => {
  assert.equal(validate({ ...sample, confidence: 101 }), false);
  assert.equal(validate({ ...sample, hallucinated_price: 42 }), false);
  assert.equal(
    validate({ ...sample, setups: [{ direction: "LONG", reasoning: "x" }] }),
    false,
  );
  assert.equal(validate({ ...sample, timestamp: "invalid" }), false);
});
test("locale catalogs cover equal keys", () => {
  const keys = Object.keys(read("apps/web/messages/en.json")).sort();
  for (const locale of ["pl", "de"])
    assert.deepEqual(
      Object.keys(read(`apps/web/messages/${locale}.json`)).sort(),
      keys,
    );
});

test("risk contract accepts the optional target and requires supported leverage", () => {
  const risk = ajv.compile(
    read("packages/contracts/openapi.json").components.schemas.RiskRequest,
  );
  const input = {
    account: 10000,
    riskPct: 1,
    entry: 100,
    stop: 95,
    leverage: 1,
    direction: "LONG",
  };
  assert.equal(risk(input), true);
  assert.equal(risk({ ...input, target: 110 }), true);
  assert.equal(risk({ ...input, target: -10 }), false);
  assert.equal(risk({ ...input, leverage: 0.5 }), false);
});
test("API operation IDs unique and private routes require sessions or native bearer", () => {
  const api = read("packages/contracts/openapi.json");
  const ids = [];
  for (const [path, methods] of Object.entries(api.paths))
    for (const op of Object.values(methods)) {
      ids.push(op.operationId);
      if (!op.security?.length)
        assert.ok(
          [
            "/health",
            "/markets",
            "/candles",
            "/depth",
            "/derivatives",
            "/context",
            "/news",
            "/risk",
            "/billing/webhook",
          ].includes(path) || path.startsWith("/auth/"),
        );
      else assert.deepEqual(op.security, [{ session: [] }, { mobileBearer: [] }]);
    }
  assert.equal(new Set(ids).size, ids.length);
});
