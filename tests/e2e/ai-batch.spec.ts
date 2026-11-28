import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
test("multi-frame scanner submits deep jobs, shows partial failures and polls queued results to completion", async ({
  page,
}) => {
  const r = await page.request.post("/api/v1/auth/register", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      email: `batch-${randomBytes(5).toString("hex")}@example.com`,
      password: "batch-fixture-password-1234",
      consent: true,
    },
  });
  expect(r.status()).toBe(201);
  const id = "550e8400-e29b-41d4-a716-446655440010";
  await page.route("**/api/v1/analyses/" + id, (route) =>
    route.fulfill({
      json: {
        id,
        status: "completed",
        request_config: {
          venue: "binance",
          market: "spot",
          symbol: "BTCUSDT",
          timeframe: "15m",
        },
        result: {
          symbol: "BTCUSDT",
          timeframe: "15m",
          timestamp: new Date().toISOString(),
          confidence: 40,
          bias: "neutral",
          market_regime: "ranging",
          key_levels: {
            support: [59000],
            resistance: [61000],
            liquidity_zones: [],
          },
          setups: [
            {
              direction: "NO_TRADE",
              reasoning: "Batch timeframe evidence",
              timing: "Wait",
              invalidation: "Range breaks",
              time_horizon: "intraday",
            },
          ],
          risk: {
            level: "medium",
            factors: [],
            event_risk: "Unknown",
            volatility_note: "Unknown",
          },
          scenarios: { bull_case: "Up", bear_case: "Down", base_case: "Range" },
          summary_short: "15m fixture",
          summary_detailed: "Detailed fixture",
        },
      },
    }),
  );
  let reads = 0,
    posted = false;
  await page.route("**/api/v1/scanner?**", (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (!q.get("ids")) return route.fulfill({ json: [] });
    reads++;
    return route.fulfill({
      json: [
        {
          id,
          analysisId: id,
          symbol: "BTCUSDT",
          venue: "binance",
          market: "spot",
          timeframe: "15m",
          status: reads === 1 ? "running" : "completed",
          direction: "NO_TRADE",
          score: 0,
        },
      ],
    });
  });
  await page.route("**/api/v1/scanner", (route) => {
    const body = route.request().postDataJSON();
    expect(body.timeframes).toEqual(["15m", "1h", "4h"]);
    expect(body.mode).toBe("deep");
    posted = true;
    return route.fulfill({
      status: 202,
      json: {
        enqueued: 1,
        jobs: [
          {
            id,
            symbol: "BTCUSDT",
            venue: "binance",
            market: "spot",
            timeframe: "15m",
            status: "queued",
          },
          {
            symbol: "BTCUSDT",
            venue: "binance",
            market: "spot",
            timeframe: "1h",
            status: "failed",
            error: "daily_limit",
          },
          {
            symbol: "BTCUSDT",
            venue: "binance",
            market: "spot",
            timeframe: "4h",
            status: "failed",
            error: "credential_required",
          },
        ],
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await page.getByRole("button", { name: "Screener", exact: true }).click();
  await page
    .getByRole("tab", { name: "Additional watchlist scans", exact: true })
    .click();
  const panel = page.getByRole("region", {
    name: "Additional watchlist scans",
    exact: true,
  });
  await panel.getByLabel("Model ID", { exact: true }).fill("fixture");
  await panel
    .getByRole("button", { name: "AI watchlist scan", exact: true })
    .click();
  await expect.poll(() => posted).toBe(true);
  await expect(panel).toContainText("1 of 3");
  await expect(panel.locator("tbody")).toContainText("15m");
  await expect(panel.locator("tbody")).toContainText("NO_TRADE");
  await expect.poll(() => reads).toBe(2);
  const after = reads;
  await page.waitForTimeout(3500);
  expect(reads).toBe(after);
  await page.setViewportSize({ width: 360, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: "test-results/multi-frame-scanner-mobile.png",
  });
  await panel
    .getByRole("button", { name: "Open chart for analysis", exact: true })
    .click();
  await expect(
    page.getByRole("region", {
      name: "Chart plan — AI explanation",
      exact: true,
    }),
  ).toContainText("Batch timeframe evidence");
});
