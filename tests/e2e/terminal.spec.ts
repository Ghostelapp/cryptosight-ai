import { test, expect } from "@playwright/test";
test("consent, sample chart, language switching, and mobile navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sample replay", exact: true })
    .click();
  await expect(page.locator(".chart-canvas canvas").first()).toBeVisible();
  await expect(page.locator(".chart-footer")).toContainText(
    "Synthetic sample candles",
  );
  await page.screenshot({
    path: "test-results/terminal-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Language", { exact: true }).selectOption("pl");
  await expect(
    page.getByRole("button", { name: "Analizuj rynek", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Analizuj rynek", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Nawigacja", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Ustawienia", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ustawienia", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/terminal-mobile.png",
    fullPage: true,
  });
});
test("register, journal persistence and calculator flow", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill(`e2e-${Date.now()}@example.com`);
  await page
    .getByLabel("Password (at least 12 characters)", { exact: true })
    .fill("secure-e2e-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await page
    .getByRole("button", { name: "Trading journal", exact: true })
    .click();
  await page.getByLabel("Entry", { exact: true }).fill("100");
  await page.getByLabel("Exit", { exact: true }).fill("110");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("tbody tr").first()).toContainText("BTCUSDT");
  await page.reload();
  await page
    .getByRole("button", { name: "Trading journal", exact: true })
    .click();
  await expect(page.locator("tbody tr").first()).toContainText("BTCUSDT");
  await page
    .getByRole("button", { name: "Terminal", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Position calculator", exact: true })
    .click();
  await page.getByLabel("Entry", { exact: true }).fill("100");
  await page.getByLabel("Stop-loss", { exact: true }).fill("95");
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(
    page.getByText("Liquidation price unavailable without venue margin tiers", {
      exact: true,
    }),
  ).toBeVisible();
});
