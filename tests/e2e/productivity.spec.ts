import { test, expect, Page } from "@playwright/test";

const quotes = [
  { symbol: "BTCUSDT", price: 65000, change: 4, volume: 50e6 },
  { symbol: "ETHUSDT", price: 3000, change: -2, volume: 20e6 },
  { symbol: "SOLUSDT", price: 150, change: 8, volume: 15e6 },
];
async function openTerminal(page: Page) {
  await page.route("**/api/v1/markets?**", (route) =>
    route.fulfill({ json: quotes }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
}
async function command(page: Page, query: string) {
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", {
    name: "Search pages, tools or markets…",
  });
  await expect(search).toBeFocused();
  await search.fill(query);
  await search.press("Enter");
}

test("terminal remains usable when browser preference storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await openTerminal(page);
  await command(page, "screener");
  await expect(
    page.getByRole("heading", { name: "Screener", exact: true }),
  ).toBeVisible();
});

test("quick commands navigate, search markets, close with Escape and work from inputs", async ({
  page,
}) => {
  await openTerminal(page);
  await command(page, "screener");
  await expect(
    page.getByRole("heading", { name: "Screener", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search pairs", { exact: true }).fill("ETH");
  await page.keyboard.press("Control+k");
  await page
    .getByRole("combobox", { name: "Search pages, tools or markets…" })
    .fill("no-such-command");
  await expect(
    page.getByText("No matching commands or markets."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await command(page, "SOLUSDT");
  await expect(page.locator(".pair strong")).toHaveText("SOL / USDT");
});

test("workspace survives reload and reset restores defaults without sample mode", async ({
  page,
}) => {
  await openTerminal(page);
  await page.getByLabel("Exchange", { exact: true }).selectOption("okx");
  await page.getByLabel("Timeframe", { exact: true }).selectOption("4h");
  await page.getByLabel("Candlesticks", { exact: true }).selectOption("area");
  await page.getByLabel("Chart layout", { exact: true }).selectOption("2");
  await page
    .getByRole("button", { name: "Sample replay", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Exchange", { exact: true })).toHaveValue("okx");
  await expect(page.getByLabel("Timeframe", { exact: true })).toHaveValue("4h");
  await expect(page.getByLabel("Candlesticks", { exact: true })).toHaveValue(
    "area",
  );
  await expect(page.getByLabel("Chart layout", { exact: true })).toHaveValue(
    "2",
  );
  await expect(
    page.getByRole("button", { name: "Sample replay", exact: true }),
  ).toBeVisible();
  await command(page, "Reset terminal settings");
  await expect(page.getByLabel("Exchange", { exact: true })).toHaveValue(
    "binance",
  );
  await expect(page.getByLabel("Timeframe", { exact: true })).toHaveValue("1h");
  await expect(page.getByLabel("Chart layout", { exact: true })).toHaveValue(
    "1",
  );
});

test("screener combines filters, sorts, handles no results and opens a chart", async ({
  page,
}) => {
  await openTerminal(page);
  await command(page, "screener");
  const screener = page.getByRole("region", { name: "Screener", exact: true });
  await expect(screener.locator("tbody tr")).toHaveCount(3);
  await screener.getByLabel("24h movement").selectOption("losers");
  await expect(screener.locator("tbody tr")).toHaveCount(1);
  await expect(screener.locator("tbody")).toContainText("ETHUSDT");
  await screener.getByLabel("Search pairs").fill("NONE");
  await expect(
    screener.getByText("No markets match these filters."),
  ).toBeVisible();
  await screener.getByRole("button", { name: "Reset filters" }).first().click();
  await screener
    .getByRole("button", { name: "24h change", exact: true })
    .click();
  await expect(screener.locator("tbody tr").first()).toContainText("SOLUSDT");
  await screener
    .getByRole("button", { name: "24h change", exact: true })
    .click();
  await expect(screener.locator("tbody tr").first()).toContainText("ETHUSDT");
  await screener.getByRole("button", { name: "ETHUSDT", exact: true }).click();
  await expect(page.locator(".pair strong")).toHaveText("ETH / USDT");
});

test("risk calculator reports net target profit and clears outdated calculations", async ({
  page,
}) => {
  await openTerminal(page);
  await command(page, "Position calculator");
  const calculator = page.getByRole("dialog", {
    name: "Position calculator",
    exact: true,
  });
  await calculator.getByLabel("Entry", { exact: true }).fill("100");
  await calculator.getByLabel("Stop-loss", { exact: true }).fill("95");
  await calculator.getByLabel("Target price (optional)").fill("110");
  await calculator
    .getByRole("button", { name: "Calculate", exact: true })
    .click();
  await expect(
    calculator.getByText("Net profit at target", { exact: true }),
  ).toBeVisible();
  await expect(
    calculator.getByText("Reward / risk after costs", { exact: true }),
  ).toBeVisible();
  await calculator.getByLabel("Target price (optional)").fill("100.01");
  await expect(
    calculator.getByText("Net profit at target", { exact: true }),
  ).toBeHidden();
  await calculator
    .getByRole("button", { name: "Calculate", exact: true })
    .click();
  await expect(
    calculator.getByText(
      "The target does not cover the estimated trading costs.",
    ),
  ).toBeVisible();
});

test("journal analytics and CSV reflect a saved trade including fees", async ({
  page,
}) => {
  await openTerminal(page);
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill(`insights-${Date.now()}@example.com`);
  await page
    .getByLabel("Password (at least 12 characters)", { exact: true })
    .fill("secure-insights-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await command(page, "Trading journal");
  await page.getByLabel("Entry", { exact: true }).fill("100");
  await page.getByLabel("Exit", { exact: true }).fill("110");
  await page.getByLabel("Fees", { exact: true }).fill("2");
  await page.getByLabel("Notes", { exact: true }).fill('=FORMULA,"quoted"');
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const insights = page.getByRole("region", {
    name: "Journal performance",
    exact: true,
  });
  await expect(insights.getByRole("img")).toHaveAttribute(
    "aria-label",
    /1 recorded trades: 8 USDT/,
  );
  const download = page.waitForEvent("download");
  await insights
    .getByRole("button", { name: "Export CSV", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^CryptoSight-journal-.*\.csv$/);
  const stream = await file.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += chunk.toString();
  expect(content).toContain('"8"');
  expect(content).toContain('"\'=FORMULA,""quoted"""');
  await page.screenshot({
    path: "test-results/journal-insights.png",
    fullPage: true,
  });
});

test("mobile quick commands and screener fit a 320px viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await openTerminal(page);
  await page
    .getByRole("button", { name: "Quick commands", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Search pages, tools or markets…" })
    .fill("screener");
  await page.screenshot({
    path: "test-results/quick-commands-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Search pages, tools or markets…" })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "Screener", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/screener-mobile.png",
    fullPage: true,
  });
});

test("quote failures mark the last response and venue changes clear old prices", async ({
  page,
}) => {
  await page.clock.install();
  let fail = false;
  await page.route("**/api/v1/markets?**", (route) => {
    return !fail
      ? route.fulfill({ json: quotes })
      : route.fulfill({ status: 503, json: { code: "service_unavailable" } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await expect(page.locator(".market-data-status")).toContainText(
    "Quotes refreshed",
  );
  fail = true;
  await page.clock.fastForward(15000);
  await expect(page.locator(".market-data-status")).toContainText(
    "Quote refresh failed",
  );
  await page.getByLabel("Exchange", { exact: true }).selectOption("okx");
  await expect(page.locator(".market-data-status")).toContainText(
    "Market quotes unavailable",
  );
  await expect(page.locator(".market-strip .market-price span")).toHaveText(
    "—",
  );
});
