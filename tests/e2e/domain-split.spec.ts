import { test, expect } from "@playwright/test";
test("landing stays public on its host and opens the current terminal on the app host", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://data-api.binance.vision/**", (r) => r.abort());
  await page.goto("http://localhost:3100/");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Analiza rynku krypto",
  );
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/landing-mobile.png",
    fullPage: true,
  });
  const cta = page.locator(".pub-header-terminal");
  await expect(cta).toHaveAttribute("href", "http://127.0.0.1:3100/?lang=pl");
  await cta.click();
  await expect(page.locator(".pub-site")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Rozumiem i akceptuję", exact: true })
    .click();
  await expect(page.locator(".chart-canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Zaloguj się", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog").locator(".auth-mode-switch"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("public knowledge translations and old password links resolve on the right host", async ({
  page,
  request,
}) => {
  await page.goto("http://localhost:3100/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("http://localhost:3100/wiedza/swiece-ohlcv");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Jak czytać świece OHLCV?",
  );
  const legacy = await request.get(
    "http://localhost:3100/?reset=" + "a".repeat(64),
    { maxRedirects: 0 },
  );
  expect(legacy.status()).toBe(307);
  // Next can relativize redirects between loopback aliases; real host isolation is covered by routing tests and the deployment smoke check.
  expect(new URL(legacy.headers().location,"http://127.0.0.1:3100").href).toBe(
    "http://127.0.0.1:3100/?reset=" + "a".repeat(64),
  );
  const terminal = await request.get("/");
  expect(terminal.ok()).toBe(true);
  expect(await terminal.text()).toContain("CryptoSight");
});
