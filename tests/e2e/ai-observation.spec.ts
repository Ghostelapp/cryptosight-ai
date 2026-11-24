import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

for (const empty of [false, true])
  test(`NO_TRADE draws ${empty ? "an explicit status without invented levels" : "AI support and resistance automatically"}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.fillText;
      (window as any).__chartTexts = new Set();
      CanvasRenderingContext2D.prototype.fillText = function (
        text,
        ...args: any[]
      ) {
        (window as any).__chartTexts.add(text);
        return original.call(this, text, ...(args as [number, number]));
      };
    });
    const registered = await page.request.post("/api/v1/auth/register", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: {
        email: `observation-${randomBytes(5).toString("hex")}@example.com`,
        password: "fixture-observation-password-123",
        consent: true,
      },
    });
    expect(registered.status()).toBe(201);
    const timestamp = new Date().toISOString(),
      id = "550e8400-e29b-41d4-a716-446655440002";
    let config: any;
    await page.route("**/api/v1/candles?**", (r) =>
      r.fulfill({
        json: {
          candles: Array.from({ length: 200 }, (_, n) => ({
            timestamp: Date.parse(timestamp) - (199 - n) * 3600000,
            open: 60000,
            high: 60100,
            low: 59900,
            close: 60000,
            volume: 50,
          })),
          provenance: { source: "fixture", stale: false },
        },
      }),
    );
    await page.route("**/api/v1/analyses", (r) => {
      if (r.request().method() !== "POST") return r.continue();
      config = r.request().postDataJSON();
      return r.fulfill({ status: 202, json: { id, status: "queued" } });
    });
    await page.route("**/api/v1/analyses/" + id, (r) =>
      r.fulfill({
        json: {
          id,
          status: "completed",
          request_config: config,
          result: {
            symbol: config.symbol,
            timeframe: config.timeframe,
            timestamp,
            market_regime: "ranging",
            bias: "neutral",
            confidence: 40,
            key_levels: {
              support: empty ? [] : [59000, 58000],
              resistance: empty ? [] : [61000, 62000],
              liquidity_zones: [],
            },
            setups: [
              {
                direction: "NO_TRADE",
                reasoning:
                  "AI: no confirmed entry while price is inside the range",
                timing: "Wait for a confirmed break",
                invalidation: "Reassess after a close outside the range",
                time_horizon: "intraday",
              },
            ],
            risk: {
              level: "high",
              factors: [],
              volatility_note: "Unknown",
              event_risk: "Unknown",
            },
            scenarios: {
              bull_case: "Break above",
              bear_case: "Break below",
              base_case: "Wait",
            },
            summary_short: "Observation only",
            summary_detailed: "No entry confirmation",
          },
        },
      }),
    );
    await page.goto("/");
    await page
      .getByRole("button", { name: "I understand and agree", exact: true })
      .click();
    await expect(page.locator(".account-button")).toBeVisible();
    await page.getByLabel("Model ID", { exact: true }).first().fill("fixture");
    await page
      .getByRole("button", { name: "Analyze market", exact: true })
      .click();
    const guide = page.getByRole("region", {
      name: "Chart plan — AI explanation",
      exact: true,
    });
    await expect(guide).toContainText("AI: no confirmed entry");
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__chartTexts.has("NO TRADE · AI observation"),
        ),
      )
      .toBe(true);
    if (empty) {
      await expect(guide).toContainText("AI supplied no support or resistance");
      await expect(
        guide.getByRole("checkbox", {
          name: "Fit scale to AI levels",
          exact: true,
        }),
      ).toHaveCount(0);
    } else {
      await expect(guide).toContainText("AI support 1: 59,000");
      await expect(guide).toContainText("AI resistance 1: 61,000");
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__chartTexts.has("SUP1 59,000")),
        )
        .toBe(true);
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__chartTexts.has("RES1 61,000")),
        )
        .toBe(true);
      await expect(
        guide.getByRole("checkbox", {
          name: "Fit scale to AI levels",
          exact: true,
        }),
      ).toBeChecked();
    }
    expect(
      await page.evaluate(() =>
        [...(window as any).__chartTexts].some((s: any) =>
          /^(SL|TP\d|ENTRY) /.test(s),
        ),
      ),
    ).toBe(false);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.locator(".chart-shell").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page
      .locator(".chart-shell")
      .first()
      .screenshot({
        path: `test-results/ai-observation-${empty ? "empty" : "levels"}.png`,
      });
    await expect(
      guide.getByRole("checkbox", { name: "AI drawing", exact: true }),
    ).toBeChecked();
    expect(errors).toEqual([]);
  });
