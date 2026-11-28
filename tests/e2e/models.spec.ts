import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
test("members can save a personal key and choose published agents but cannot edit providers or models", async ({
  page,
}) => {
  const registered = await page.request.post("/api/v1/auth/register", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      email: `managed-${randomBytes(5).toString("hex")}@example.com`,
      password: "managed-fixture-password-123",
      consent: true,
    },
  });
  expect(registered.status()).toBe(201);
  await page.route("**/api/v1/agents", (r) =>
    r.fulfill({
      json: [
        {
          id: "550e8400-e29b-41d4-a716-446655440099",
          name: "Published analyst",
          provider: "openai",
          model: "fixed-model",
          description: "Administrator configuration",
        },
      ],
    }),
  );
  let catalogs = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/models")) catalogs++;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "AI keys", exact: true }).click();
  const card = page
    .locator(".form-card")
    .filter({
      has: page.getByRole("heading", { name: "API key", exact: true }),
    });
  await expect(card.getByLabel("Model ID", { exact: true })).toHaveCount(0);
  await card
    .getByLabel("API key", { exact: true })
    .fill("personal-browser-fixture-secret");
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.locator(".key-row")).toContainText("openai");
  await expect(card.getByLabel("API key", { exact: true })).toHaveValue("");
  expect(catalogs).toBe(0);
  await page
    .getByRole("button", { name: "Terminal", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("combobox", { name: "AI agent", exact: true }),
  ).toHaveValue("550e8400-e29b-41d4-a716-446655440099");
  await expect(page.getByLabel("Model ID", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "AI provider", exact: true }),
  ).toHaveCount(0);
  expect(
    (await page.request.get("/api/v1/models?provider=openai")).status(),
  ).toBe(403);
  expect((await page.request.get("/api/v1/admin/agents")).status()).toBe(403);
  await page.screenshot({
    path: "test-results/member-managed-agents.png",
    fullPage: true,
  });
});
