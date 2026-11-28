import { test, expect } from "@playwright/test";
test("administrator configures encrypted Resend and Turnstile keys without receiving them back", async ({
  page,
}) => {
  const login = await page.request.post("/api/v1/auth/login", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      email: "admin-e2e@example.com",
      password: "isolated-e2e-password-123",
    },
  });
  expect(login.status()).toBe(200);
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await page
    .getByRole("button", { name: "Administration", exact: true })
    .click();
  await page.getByRole("tab", { name: "Integrations", exact: true }).click();
  const region = page.getByRole("region", {
    name: "Service integrations",
    exact: true,
  });
  const resend = region
    .locator("form")
    .filter({
      has: page.getByRole("heading", { name: "Resend", exact: true }),
    });
  await resend
    .getByLabel("Verified sender email", { exact: true })
    .fill("noreply@cryptosight.tech");
  await resend
    .getByLabel("Resend API key", { exact: true })
    .fill("re_fixture_browser_secret");
  await resend.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    resend.getByLabel("Resend API key", { exact: true }),
  ).toHaveValue("");
  const turnstile = region
    .locator("form")
    .filter({
      has: page.getByRole("heading", {
        name: "Cloudflare Turnstile",
        exact: true,
      }),
    });
  await turnstile
    .getByLabel("Turnstile site key (public)", { exact: true })
    .fill("fixture-browser-site");
  await turnstile
    .getByLabel("Turnstile secret key", { exact: true })
    .fill("fixture-browser-captcha-secret");
  await turnstile.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    turnstile.getByLabel("Turnstile secret key", { exact: true }),
  ).toHaveValue("");
  const response = await page.request.get("/api/v1/admin/integrations");
  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text).not.toContain("re_fixture_browser_secret");
  expect(text).not.toContain("fixture-browser-captcha-secret");
  await page.setViewportSize({ width: 360, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await region.screenshot({
    path: "test-results/admin-service-integrations.png",
  });
});

test("administrator can save an encrypted agent and expose it in analysis controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page.getByLabel("Email", { exact: true }).fill("admin-e2e@example.com");
  await page
    .getByLabel("Password (at least 12 characters)", { exact: true })
    .fill("isolated-e2e-password-123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await page
    .getByRole("button", { name: "Administration", exact: true })
    .click();
  const panel = page.locator(".admin-panel");
  await expect(
    panel.getByRole("heading", { name: "Administration", exact: true }),
  ).toBeVisible();
  await panel.getByText("New agent", { exact: true }).click();
  await panel.getByLabel("Name", { exact: true }).fill("E2E managed analyst");
  await panel.getByLabel("Model ID", { exact: true }).fill("test-model");
  await panel
    .getByLabel("API key", { exact: true })
    .fill("synthetic-e2e-api-key");
  await panel.getByLabel("Enabled", { exact: true }).check();
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    panel.getByRole("heading", { name: "E2E managed analyst", exact: true }),
  ).toBeVisible();
  await expect(panel.getByLabel("API key", { exact: true })).toHaveValue("");
  const response = await page.request.get("/api/v1/admin/agents");
  expect(response.status()).toBe(200);
  expect(await response.text()).not.toContain("synthetic-e2e-api-key");
  await page
    .locator(".feature-page")
    .screenshot({ path: "test-results/admin-compact-desktop.png" });
  await page.setViewportSize({ width: 360, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .locator(".feature-page")
    .screenshot({ path: "test-results/admin-compact-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await page
    .getByRole("combobox", { name: "AI agent", exact: true })
    .selectOption({ label: "E2E managed analyst" });
  await expect(page.getByLabel("Model ID", { exact: true })).toHaveValue(
    "test-model",
  );
  await expect(page.getByLabel("Model ID", { exact: true })).toBeDisabled();
  await page.screenshot({
    path: "test-results/admin-managed-agent.png",
    fullPage: true,
  });
});

test("ordinary account cannot access admin API or administration navigation", async ({
  page,
}) => {
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
    .fill(`member-admin-e2e-${Date.now()}@example.com`);
  await page
    .getByLabel("Password (at least 12 characters)", { exact: true })
    .fill("isolated-e2e-member-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Administration", exact: true }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/v1/admin/overview")).status()).toBe(403);
});
