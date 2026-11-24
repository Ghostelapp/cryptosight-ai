import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
async function navigate(page: Page, label: string) {
  await page.keyboard.press("Control+k");
  const search = page.locator('input[role="combobox"]');
  await search.fill(label);
  await search.press("Enter");
}
test("compact pages keep settings tabs accessible, preserve input, and expose alert creation and advanced backtest costs", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const reg = await page.request.post("/api/v1/auth/register", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      email: `pages-${randomBytes(5).toString("hex")}@example.com`,
      password: "feature-pages-fixture-password",
      consent: true,
    },
  });
  expect(reg.status()).toBe(201);
  await page.route("**/api/v1/notifications", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/v1/markets?**", (r) =>
    r.fulfill({
      json: Array.from({ length: 24 }, (_, n) => ({
        symbol: (n ? "PAIR" + n : "BTC") + "USDT",
        price: 60000,
        change: n - 12,
        volume: 50000000,
      })),
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await navigate(page, "Settings");
  const settings = page.getByRole("tablist", { name: "Settings", exact: true });
  await expect(settings.getByRole("tab")).toHaveCount(6);
  await settings.getByRole("tab", { name: "Preferences", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    settings.getByRole("tab", { name: "Wallet", exact: true }),
  ).toBeFocused();
  await expect(page.getByTestId("wallet-access")).toBeVisible();
  await page.keyboard.press("End");
  await expect(
    settings.getByRole("tab", { name: "Account", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  let panel = page.getByRole("tabpanel");
  await panel.getByLabel("Timezone", { exact: true }).fill("Europe/Warsaw");
  await settings.getByRole("tab", { name: "AI keys", exact: true }).click();
  await expect(
    page.getByRole("tabpanel").getByLabel("API key", { exact: true }),
  ).toBeVisible();
  await settings.getByRole("tab", { name: "Preferences", exact: true }).click();
  panel = page.getByRole("tabpanel");
  await expect(panel.getByLabel("Timezone", { exact: true })).toHaveValue(
    "Europe/Warsaw",
  );
  await panel.getByRole("combobox", { name: /^Theme/ }).selectOption("light");
  await page
    .locator(".feature-page")
    .screenshot({ path: "test-results/settings-compact-light.png" });
  await panel.getByRole("combobox", { name: /^Theme/ }).selectOption("dark");
  await navigate(page, "Alerts");
  await expect(page.getByLabel("Price", { exact: true })).toBeHidden();
  await page.getByText("Add alert", { exact: true }).click();
  await page.getByLabel("Price", { exact: true }).fill("65000");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("tabpanel").locator("tbody")).toContainText(
    "BTCUSDT",
  );
  await page.getByText("Add alert", { exact: true }).click();
  const toast = page.locator(".toast");
  if (await toast.isVisible()) await toast.getByRole("button").click();
  await page
    .locator(".feature-page")
    .screenshot({ path: "test-results/alerts-compact.png" });
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Notifications", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByText("No notifications yet.", { exact: true }),
  ).toBeVisible();
  await navigate(page, "Backtesting");
  await expect(
    page.getByLabel("Fee (basis points)", { exact: true }),
  ).toBeHidden();
  await page.getByText("Fees and slippage", { exact: true }).click();
  await expect(
    page.getByLabel("Fee (basis points)", { exact: true }),
  ).toBeVisible();
  await navigate(page, "Market overview");
  await expect(page.locator(".heatmap button")).toHaveCount(12);
  await page
    .getByRole("button", { name: "Show more markets", exact: true })
    .click();
  await expect(page.locator(".heatmap button")).toHaveCount(24);
  await page.getByRole("button", { name: "Show less", exact: true }).click();
  await page
    .locator(".feature-page")
    .screenshot({ path: "test-results/dashboard-compact.png" });
  for (const [name, file] of [
    ["Screener", "screener"],
    ["Trading journal", "journal"],
    ["AI track record", "track"],
    ["Backtesting", "backtest"],
    ["Settings", "settings"],
  ]) {
    await navigate(page, name);
    await page
      .locator(".feature-page")
      .screenshot({ path: `test-results/${file}-compact-desktop.png` });
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page
      .locator(".feature-page")
      .screenshot({ path: `test-results/${file}-compact-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page
    .getByRole("tabpanel")
    .getByRole("combobox", { name: /^Language/ })
    .selectOption("pl");
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .locator(".feature-page")
    .screenshot({ path: "test-results/settings-compact-polish-mobile.png" });
  expect(errors).toEqual([]);
});
