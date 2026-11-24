import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

test("deep research displays measured evidence and costs, retries the same intent, and stops polling on completion", async ({
  page,
}) => {
  const clientErrors: string[] = [];
  page.on("pageerror", (error) => clientErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("MISSING_MESSAGE")
    )
      clientErrors.push(message.text());
  });
  const registered = await page.request.post("/api/v1/auth/register", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      email: `research-${randomBytes(5).toString("hex")}@example.com`,
      password: "research-fixture-password-123",
      consent: true,
    },
  });
  expect(registered.status()).toBe(201);
  const timestamp = new Date().toISOString();
  await page.route("**/api/v1/candles?**", (route) =>
    route.fulfill({
      json: {
        candles: Array.from({ length: 200 }, (_, n) => ({
          timestamp: Date.parse(timestamp) - (199 - n) * 3600000,
          open: 60000 + Math.sin(n / 9) * 250,
          high: 60400,
          low: 59600,
          close: 60000 + Math.cos(n / 9) * 250,
          volume: 50,
        })),
        indicators: null,
        provenance: { source: "fixture", stale: false },
      },
    }),
  );
  const id = "550e8400-e29b-41d4-a716-446655440001";
  let submits = 0,
    reads = 0,
    key = "";
  await page.route("**/api/v1/analyses", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON();
    expect(body.mode).toBe("deep");
    if (++submits === 1) {
      key = route.request().headers()["idempotency-key"];
      return route.fulfill({
        status: 503,
        json: { code: "service_unavailable" },
      });
    }
    expect(route.request().headers()["idempotency-key"]).toBe(key);
    return route.fulfill({ status: 202, json: { id, status: "queued" } });
  });
  await page.route("**/api/v1/analyses/" + id, async (route) => {
    if (++reads === 1)
      return route.fulfill({ json: { id, status: "running" } });
    return route.fulfill({
      json: {
        id,
        status: "completed",
        research: {
          status: "partial",
          frames: [
            {
              timeframe: "1h",
              trend: "bullish",
              closedBars: 299,
              gaps: 0,
              rsi: 55,
              atrPct: 1.5,
              volumeRatio20: 1.2,
            },
          ],
          execution: { spreadBps: 2 },
          benchmark: { value: 0.75 },
          missingSources: ["calendar"],
          missingFrames: [],
        },
        trade_metrics: [
          {
            direction: "LONG",
            grossRR: 2,
            netRR: 1.8,
            breakEvenWinRatePct: 35,
            stopDistancePct: 2,
            assumedRoundTripCostBps: 32,
            positiveAfterCosts: true,
          },
        ],
        result: {
          symbol: "BTCUSDT",
          timeframe: "1h",
          timestamp,
          market_regime: "trending",
          bias: "bullish",
          confidence: 55,
          key_levels: {
            support: [59000],
            resistance: [62000],
            liquidity_zones: [],
          },
          setups: [
            {
              direction: "LONG",
              trigger: { type: "price_touch", price: 60000, timeframe: "1h" },
              entry: { type: "limit", price: 60000, zone: [59900, 60100] },
              stop_loss: 59000,
              take_profits: [{ price: 62000, size_pct: 100, probability: 50 }],
              risk_reward: 2,
              invalidation: "Below support",
              timing: "Wait for trigger",
              reasoning: "Fixture evidence",
              chart_notes: {
                entry: "AI: retest of measured support",
                stop: "AI: below structural support",
                trigger: "AI: wait for the retest",
                targets: ["AI: prior resistance target"],
              },
              time_horizon: "intraday",
            },
            {
              direction: "SHORT",
              trigger: {
                type: "candle_close_below",
                price: 59900,
                timeframe: "1h",
              },
              entry: { type: "limit", price: 60000, zone: [59950, 60050] },
              stop_loss: 61000,
              take_profits: [{ price: 58000, size_pct: 100, probability: 45 }],
              risk_reward: 2,
              invalidation: "Above 61000",
              timing: "Wait for a closed candle",
              reasoning: "Alternative bearish evidence",
              time_horizon: "intraday",
              chart_notes: {
                entry: "AI: alternative resistance retest",
                stop: "AI: above resistance",
                trigger: "AI: close below breakdown level",
                targets: ["AI: lower support target"],
              },
            },
          ],
          risk: {
            level: "medium",
            factors: ["Calendar unavailable"],
            volatility_note: "Measured ATR",
            event_risk: "Unknown",
          },
          scenarios: {
            bull_case: "Confirmed breakout",
            bear_case: "Support fails",
            base_case: "Wait",
          },
          summary_short: "Fixture analysis",
          summary_detailed: "Fixture rationale",
        },
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await page.getByLabel("Model ID", { exact: true }).first().fill("fixture");
  const analyze = page.getByRole("button", {
    name: "Analyze market",
    exact: true,
  });
  await analyze.click();
  await expect(analyze).toBeEnabled();
  await analyze.click();
  const report = page.getByRole("region", {
    name: "Evidence and data quality",
    exact: true,
  });
  await expect(report).toBeVisible();
  await expect(report).toContainText("Net risk/reward");
  await expect(report).toContainText("calendar");
  await report.screenshot({ path: "test-results/research-evidence.png" });
  const guide = page.getByRole("region", {
    name: "Chart plan — AI explanation",
    exact: true,
  });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("AI: retest of measured support");
  await expect(guide).toContainText("AI: prior resistance target");
  await page.locator(".chart-shell").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page
    .locator(".chart-shell")
    .first()
    .screenshot({ path: "test-results/ai-chart-long.png" });
  await guide.getByRole("combobox").selectOption("1");
  await expect(guide).toContainText("Alternative bearish evidence");
  await expect(guide).not.toContainText("AI: prior resistance target");
  await guide
    .getByRole("checkbox", { name: "AI drawing", exact: true })
    .uncheck();
  await guide
    .getByRole("checkbox", { name: "AI drawing", exact: true })
    .check();
  await guide
    .getByRole("checkbox", { name: "Fit scale to SL and TP", exact: true })
    .uncheck();
  await guide
    .getByRole("checkbox", { name: "Fit scale to SL and TP", exact: true })
    .check();
  await guide
    .getByRole("checkbox", { name: "AI support and resistance", exact: true })
    .check();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator(".chart-shell").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page
    .locator(".chart-shell")
    .first()
    .screenshot({ path: "test-results/ai-chart-mobile.png" });
  await guide.screenshot({ path: "test-results/ai-chart-guide-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(reads).toBe(2);
  // Observe two nominal poll periods after the terminal status.
  await page.waitForTimeout(4500);
  expect(reads).toBe(2);
  expect(clientErrors).toEqual([]);
});
