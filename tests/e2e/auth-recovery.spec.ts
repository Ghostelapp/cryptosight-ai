import { test, expect } from "@playwright/test";
test("Turnstile gates registration and recovery, refreshes per action and reset link only asks for new passwords", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      json: {
        user: null,
        csrfToken: null,
        consentAccepted: false,
        configuration: {
          email: true,
          walletChains: [1],
          turnstile: {
            enabled: true,
            ready: true,
            siteKey: "fixture-public-site",
          },
        },
      },
    }),
  );
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js*",
    (r) =>
      r.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile={render:function(el,opts){el.innerHTML='';var b=document.createElement('button');b.type='button';b.textContent='Complete fixture verification';b.onclick=function(){opts.callback('verified-'+opts.action)};el.appendChild(b);return 'fixture'},remove:function(){document.querySelectorAll('.turnstile-area button').forEach(function(b){b.remove()})}};`,
      }),
  );
  const requests: any[] = [];
  for (const endpoint of ["register", "reset-request", "reset"])
    await page.route("**/api/v1/auth/" + endpoint, (r) => {
      requests.push({ endpoint, body: r.request().postDataJSON() });
      return r.fulfill({
        json:
          endpoint === "register"
            ? { verification_required: true }
            : { accepted: true },
      });
    });
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("captcha-ui@example.com");
  await dialog
    .getByLabel("Password (at least 12 characters)", { exact: true })
    .fill("captcha-ui-fixture-password");
  const register = dialog.getByRole("button", {
    name: "Create account",
    exact: true,
  });
  await expect(register).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Complete fixture verification" })
    .click();
  await expect(register).toBeEnabled();
  await register.click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].body.turnstileToken).toBe("verified-register");
  await dialog
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Password (at least 12 characters)", { exact: true }),
  ).toHaveCount(0);
  const send = dialog.getByRole("button", {
    name: "Send reset link",
    exact: true,
  });
  await expect(send).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Complete fixture verification" })
    .click();
  await send.click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].body.turnstileToken).toBe("verified-reset_request");
  await page.goto("/?reset=" + "a".repeat(64));
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Email", { exact: true })).toHaveCount(0);
  await dialog
    .getByLabel("New password", { exact: true })
    .fill("new-ui-fixture-password");
  await dialog
    .getByLabel("Confirm new password", { exact: true })
    .fill("new-ui-fixture-password");
  await dialog
    .getByRole("button", { name: "Complete fixture verification" })
    .click();
  await dialog
    .getByRole("button", { name: "Set new password", exact: true })
    .click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].body.token).toBe("a".repeat(64));
  expect(requests[2].body.turnstileToken).toBe("verified-reset");
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/reset=/);
});

