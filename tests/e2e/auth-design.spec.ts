import { test, expect } from "@playwright/test";
test("account panel keeps password controls, inline feedback, recovery and wallet access usable on desktop and mobile", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      json: {
        user: null,
        configuration: { email: true, walletChains: [1] },
        consentAccepted: false,
      },
    }),
  );
  await page.route("**/api/v1/auth/login", (r) =>
    r.fulfill({ status: 401, json: { error: "invalid_credentials" } }),
  );
  await page.route("**/api/v1/auth/reset-request", (r) =>
    r.fulfill({ json: { accepted: true } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".auth-story")).toBeVisible();
  await expect(dialog.locator(".auth-mfa input")).toBeHidden();
  await dialog.getByLabel("Email", { exact: true }).fill("layout@example.com");
  const password = dialog.getByLabel("Password (at least 12 characters)", {
    exact: true,
  });
  await password.fill("auth-layout-fixture");
  await dialog
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await dialog
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await dialog.screenshot({ path: "test-results/auth-login-desktop.png" });
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Register", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(dialog.locator(".auth-story")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await dialog.screenshot({ path: "test-results/auth-register-mobile.png" });
  await dialog
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(dialog.locator(".auth-wallet")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toBeVisible();
  await dialog.screenshot({ path: "test-results/auth-recovery-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
