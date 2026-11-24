import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

test("candidate scanner shows conditional plans, separates watch candidates and opens the selected market", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("MISSING_MESSAGE")
    )
      errors.push(message.text());
  });
  const r = await page.request.post("/api/v1/auth/register", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      email: `scan-${randomBytes(5).toString("hex")}@example.com`,
      password: "candidate-fixture-password-123",
      consent: true,
    },
  });
  expect(r.status()).toBe(201);
  let count = 0,
    paidCalls = 0;
  await page.route("**/api/v1/scanner", async (route) => {
    if (route.request().method() === "POST") paidCalls++;
    return route.continue();
  });
  await page.route("**/api/v1/scanner/candidates?**", async (route) => {
    const q = new URL(route.request().url()).searchParams;
    expect(q.get("timeframe")).toBe("1h");
    expect(q.get("venue")).toBe("binance");
    count++;
    const data = {
      venue: "binance",
      market: "spot",
      timeframe: "1h",
      confirmationTimeframe: "4h",
      generatedAt: new Date().toISOString(),
      refreshAfter: new Date(Date.now() + 60000).toISOString(),
      universeSize: 24,
      scanned: 24,
      failed: 0,
      notScanned: 0,
      partial: false,
      candidates:
        count === 1
          ? [
              {
                venue: "binance",
                market: "spot",
                timeframe: "1h",
                symbol: "ETHUSDT",
                direction: "LONG",
                score: 88,
                pattern: "breakout",
                confirmationTimeframe: "4h",
                trigger: { type: "candle_close_above", price: 3100 },
                price: 3080,
                stop: 3000,
                targets: [{ price: 3250 }, { price: 3350 }],
                netRR: 1.6,
                rsi: 58,
                adx: 30,
                volumeRatio20: 1.5,
                expiresAt: new Date(Date.now() + 300000).toISOString(),
              },
            ]
          : [],
      watch:
        count === 1
          ? [
              {
                symbol: "SOLUSDT",
                venue: "binance",
                market: "spot",
                timeframe: "1h",
                direction: "LONG",
                score: 65,
                unmet: ["volume"],
              },
            ]
          : [],
    };
    return route.fulfill({ json: data });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await page.getByRole("button", { name: "Screener", exact: true }).click();
  const scanner = page.getByRole("region", {
    name: "Potential setups",
    exact: true,
  });
  await scanner
    .getByRole("button", { name: "Find setups", exact: true })
    .click();
  await expect(scanner).toContainText("ETH / USDT");
  await expect(scanner).toContainText("Condition: candle closes above");
  await expect(scanner).toContainText("Watch candidates");
  expect(paidCalls).toBe(0);
  await scanner.screenshot({ path: "test-results/candidate-scanner.png" });
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await scanner.screenshot({
    path: "test-results/candidate-scanner-mobile.png",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await scanner
    .getByRole("button", { name: "Open chart for analysis", exact: true })
    .first()
    .click();
  await expect(
    page.locator(".market-strip .pair strong").first(),
  ).toContainText("ETH");
  await page.getByRole("button", { name: "Screener", exact: true }).click();
  await scanner
    .getByRole("button", { name: "Find setups", exact: true })
    .click();
  await expect(scanner).toContainText("No setups meet every condition");
  expect(errors).toEqual([]);
});
