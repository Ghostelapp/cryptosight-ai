import { test, expect } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
const origin = "http://127.0.0.1:3100";
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) =>
    console.error("Mobile pairing page:", error.message),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      console.error("Mobile pairing console:", message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/_next/"))
      console.error("Pairing asset:", response.status(), response.url());
  });
});
test("browser approval returns a one-use PKCE code, and the native session can use the shared account", async ({
  page,
}) => {
  const email = `native-${randomBytes(6).toString("hex")}@example.com`;
  const registered = await page.request.post("/api/v1/auth/register", {
    headers: { origin },
    data: { email, password: "native-e2e-password-123", consent: true },
  });
  expect(registered.status()).toBe(201);
  const verifier = randomBytes(32).toString("base64url"),
    state = randomBytes(32).toString("hex");
  const started = await page.request.post("/api/v1/auth/mobile/start", {
    headers: { origin },
    data: {
      codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
      state,
    },
  });
  expect(started.status()).toBe(201);
  const grant = await started.json();
  await page.goto(grant.authorizeUrl);
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  const approval = page.waitForResponse(
    (response) =>
      response.url().endsWith("/auth/mobile/authorize") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Connect this account" }).click();
  const response = await approval;
  expect(response.status()).toBe(200);
  const { redirectUrl } = await response.json(),
    callback = new URL(redirectUrl);
  expect(callback.protocol).toBe("cryptosightai:");
  expect(callback.host).toBe("auth");
  expect(callback.searchParams.get("state")).toBe(state);
  await expect(
    page.getByRole("link", { name: "Open CryptoSight AI" }),
  ).toHaveAttribute("href", redirectUrl);
  const data = {
    requestId: grant.requestId,
    code: callback.searchParams.get("code"),
    codeVerifier: verifier,
  };
  const exchange = await page.request.post("/api/v1/auth/mobile/exchange", {
    headers: { origin },
    data,
  });
  expect(exchange.status()).toBe(200);
  const native = await exchange.json();
  expect(redirectUrl).not.toContain(native.accessToken);
  const me = await page.request.get("/api/v1/auth/me", {
    headers: { authorization: "Bearer " + native.accessToken },
  });
  const account = await me.json();
  expect(account.user.email).toBe(email);
  expect(account.csrfToken).toBeNull();
  expect(
    (
      await page.request.post("/api/v1/auth/mobile/exchange", {
        headers: { origin },
        data,
      })
    ).status(),
  ).toBe(400);
});
test("an invalid pairing request displays an error without approving anything", async ({
  page,
}) => {
  await page.goto("/mobile/connect?request=not-a-request");
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect this account" }),
  ).toHaveCount(0);
});
