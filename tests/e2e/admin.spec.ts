import { test, expect } from "@playwright/test";

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
  await panel.getByLabel("Name", { exact: true }).fill("E2E managed analyst");
  await panel.getByLabel("Model", { exact: true }).fill("test-model");
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
  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await page
    .getByLabel("AI agent", { exact: true })
    .selectOption({ label: "E2E managed analyst" });
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
    "test-model",
  );
  await expect(page.getByLabel("Model", { exact: true })).toBeDisabled();
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
