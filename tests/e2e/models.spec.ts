import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

test("saving a provider key discovers models, supports selection, and clears stale provider results", async ({
  page,
}) => {
  const registered = await page.request.post("/api/v1/auth/register", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      email: `models-${randomBytes(5).toString("hex")}@example.com`,
      password: "model-picker-e2e-password-123",
      consent: true,
    },
  });
  expect(registered.status()).toBe(201);
  let discovered = false;
  await page.route("**/api/v1/models?**", async (route) => {
    const provider = new URL(route.request().url()).searchParams.get(
      "provider",
    );
    if (provider === "gemini")
      return route.fulfill({
        status: 400,
        json: { code: "provider_key_rejected" },
      });
    if (!discovered)
      return route.fulfill({
        status: 503,
        json: { code: "credential_required" },
      });
    return route.fulfill({
      json: {
        provider: "openai",
        models: [
          { id: "gpt-fixture-one", name: "Fixture One" },
          { id: "gpt-fixture-two", name: "Fixture Two" },
        ],
      },
    });
  });
  await page.route("**/api/v1/credentials", async (route) => {
    if (route.request().method() === "POST") discovered = true;
    return route.continue();
  });
  await page.goto("/");
  const consent = page.getByRole("button", {
    name: "I understand and agree",
    exact: true,
  });
  await expect(consent).toBeVisible();
  await consent.click();
  await expect(page.locator(".account-button")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "AI keys", exact: true }).click();
  const keyCard = page.locator(".form-card").filter({
    has: page.getByRole("heading", { name: "API key", exact: true }),
  });
  await keyCard
    .getByLabel("API key", { exact: true })
    .fill("fixture-browser-key");
  await keyCard.getByRole("button", { name: "Save", exact: true }).click();
  const picker = keyCard.getByRole("combobox", {
    name: "Models available to this key",
    exact: true,
  });
  await expect(picker.locator("option")).toHaveCount(3);
  await picker.selectOption("gpt-fixture-two");
  await page.screenshot({
    path: "test-results/model-picker.png",
    fullPage: true,
  });
  await expect(keyCard.getByLabel("Model ID", { exact: true })).toHaveValue(
    "gpt-fixture-two",
  );
  await keyCard
    .getByRole("combobox", { name: "AI provider", exact: true })
    .selectOption("gemini");
  await expect(keyCard.getByLabel("Model ID", { exact: true })).toHaveValue("");
  await expect(keyCard.getByRole("status")).toContainText("rejected");
  await expect(picker.locator("option")).toHaveCount(1);
});
