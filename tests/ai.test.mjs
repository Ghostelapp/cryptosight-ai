import { test } from "node:test";
import assert from "node:assert/strict";
import { llm, validateAnalysis, analyze } from "../packages/ai/agent.mjs";
const snap = {
  symbol: "BTCUSDT",
  timeframe: "1h",
  timestamp: "2026-10-04T12:00:00Z",
  frames: { "1h": { indicators: { price: 100 } } },
};
const result = {
  symbol: "BTCUSDT",
  timeframe: "1h",
  timestamp: snap.timestamp,
  market_regime: "ranging",
  bias: "neutral",
  confidence: 20,
  key_levels: { support: [], resistance: [], liquidity_zones: [] },
  setups: [
    {
      direction: "NO_TRADE",
      reasoning: "Insufficient evidence",
      invalidation: "New closed bars",
      timing: "Wait",
      time_horizon: "intraday",
    },
  ],
  risk: {
    level: "high",
    factors: [],
    volatility_note: "Unknown",
    event_risk: "Unknown",
  },
  scenarios: { bull_case: "Unknown", bear_case: "Unknown", base_case: "Wait" },
  summary_short: "Wait",
  summary_detailed: "Wait",
};
test("chart notes remain optional for history but validate length and target correspondence", () => {
  const setup = {
    direction: "LONG",
    trigger: { type: "price_touch", price: 100, timeframe: "1h" },
    entry: { type: "limit", price: 100, zone: [99, 101] },
    stop_loss: 90,
    take_profits: [{ price: 120, size_pct: 100, probability: 50 }],
    risk_reward: 2,
    invalidation: "Below support",
    timing: "Wait",
    reasoning: "Structure",
    time_horizon: "intraday",
  };
  const check = (s) => validateAnalysis({ ...result, setups: [s] }, snap);
  assert.doesNotThrow(() => check(setup));
  const notes = {
    entry: "Retest of support",
    stop: "Below support",
    trigger: "Wait for retest",
    targets: ["Prior resistance"],
  };
  assert.doesNotThrow(() => check({ ...setup, chart_notes: notes }));
  assert.throws(
    () =>
      check({
        ...setup,
        chart_notes: { ...notes, targets: ["First", "Extra"] },
      }),
    /invalid_ai_chart_notes/,
  );
  assert.throws(() =>
    check({ ...setup, chart_notes: { ...notes, entry: "x".repeat(301) } }),
  );
});
test("semantic validation rejects mismatched snapshots and nonsensical trade levels", () => {
  assert.throws(() => validateAnalysis({ ...result, symbol: "ETHUSDT" }, snap));
  const long = {
    direction: "LONG",
    trigger: { type: "price_touch", price: 100, timeframe: "1h" },
    entry: { type: "limit", price: 100, zone: [99, 101] },
    stop_loss: 90,
    take_profits: [{ price: 120, size_pct: 100, probability: 50 }],
    risk_reward: 2,
    invalidation: "Below 90",
    timing: "Price reaches 100",
    reasoning: "Structure",
    time_horizon: "intraday",
  };
  assert.equal(
    validateAnalysis({ ...result, setups: [long] }, snap).setups[0].risk_reward,
    2,
  );
  assert.throws(() =>
    validateAnalysis(
      { ...result, setups: [{ ...long, stop_loss: 110 }] },
      snap,
    ),
  );
  assert.throws(() =>
    validateAnalysis(
      { ...result, setups: [{ ...long, risk_reward: 10 }] },
      snap,
    ),
  );
  assert.throws(() =>
    validateAnalysis(
      {
        ...result,
        setups: [
          {
            ...long,
            take_profits: [{ price: 120, size_pct: 50, probability: 50 }],
          },
        ],
      },
      snap,
    ),
  );
});
test("provider adapters parse recorded OpenAI, Gemini, Anthropic and OpenRouter response shapes", async () => {
  const previous = globalThis.fetch;
  try {
    for (const provider of ["openai", "gemini", "anthropic", "openrouter"]) {
      let request;
      globalThis.fetch = async (url, options) => {
        request = { url, options, body: JSON.parse(options.body) };
        const text = JSON.stringify(result);
        const body =
          provider === "gemini"
            ? {
                candidates: [{ content: { parts: [{ text }] } }],
                usageMetadata: {
                  promptTokenCount: 10,
                  candidatesTokenCount: 20,
                },
              }
            : provider === "anthropic"
              ? {
                  content: [{ type: "tool_use", input: result }],
                  usage: { input_tokens: 10, output_tokens: 20 },
                }
              : {
                  choices: [{ message: { content: text } }],
                  usage: { prompt_tokens: 10, completion_tokens: 20 },
                };
        return Response.json(body);
      };
      const r = await llm({
        provider,
        model: "test-model",
        key: "not-a-real-key",
        locale: "pl",
        snap,
      });
      assert.deepEqual(JSON.parse(r.text), result);
      assert.equal(r.usage.inputTokens, 10);
      assert.ok(JSON.stringify(request.body).includes("Polish"));
    }
  } finally {
    globalThis.fetch = previous;
  }
});
test("analysis retries invalid output once and never publishes invalid JSON", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return Response.json({
        choices: [
          {
            message: {
              content: calls === 1 ? "bad JSON" : JSON.stringify(result),
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });
    };
    assert.deepEqual(
      (
        await analyze({
          provider: "openai",
          model: "test",
          key: "test",
          locale: "en",
          snap,
        })
      ).result,
      result,
    );
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ choices: [{ message: { content: "bad JSON" } }] });
    };
    await assert.rejects(
      analyze({
        provider: "openai",
        model: "test",
        key: "test",
        locale: "en",
        snap,
      }),
      /ai_validation_failed/,
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = previous;
  }
});

test("semantic validation checks trigger/zone tick precision and contradictory NO_TRADE", () => {
  const long = {
    direction: "LONG",
    trigger: { type: "price_touch", price: 100, timeframe: "1h" },
    entry: { type: "limit", price: 100, zone: [99, 101] },
    stop_loss: 90,
    take_profits: [{ price: 120, size_pct: 100, probability: 50 }],
    risk_reward: 2,
    invalidation: "Below 90",
    timing: "Touch entry",
    reasoning: "Structure",
    time_horizon: "intraday",
  };
  const ticked = { ...snap, instrument: { tickSize: 1 } };
  assert.throws(
    () =>
      validateAnalysis(
        {
          ...result,
          setups: [{ ...long, entry: { ...long.entry, zone: [99.5, 101] } }],
        },
        ticked,
      ),
    /invalid_tick_precision/,
  );
  assert.throws(
    () =>
      validateAnalysis(
        {
          ...result,
          setups: [{ ...long, trigger: { ...long.trigger, price: 100.5 } }],
        },
        ticked,
      ),
    /invalid_tick_precision/,
  );
  assert.throws(
    () =>
      validateAnalysis({ ...result, setups: [result.setups[0], long] }, ticked),
    /contradictory_ai_setups/,
  );
});
