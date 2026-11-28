import { test, expect } from "@playwright/test";
import { Wallet } from "ethers";
test("wallet registration, persistence, logout and login with an EIP-1193 provider", async ({
  page,
}) => {
  const wallet = Wallet.createRandom(),
    methods: string[] = [];
  await page.exposeFunction("__signWallet", async (hex: string) =>
    wallet.signMessage(Buffer.from(hex.slice(2), "hex")),
  );
  await page.exposeFunction("__recordWalletMethod", (method: string) =>
    methods.push(method),
  );
  await page.addInitScript(
    ({ address }) => {
      (window as any).ethereum = {
        isMetaMask: true,
        request: async ({ method, params }: any) => {
          await (window as any).__recordWalletMethod(method);
          if (["eth_requestAccounts", "eth_accounts"].includes(method))
            return [address];
          if (method === "eth_chainId") return "0x2105";
          if (method === "personal_sign")
            return (window as any).__signWallet(params[0]);
          throw new Error("Unexpected wallet method: " + method);
        },
      };
    },
    { address: wallet.address },
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "I understand and agree", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page.locator(".auth-wallet > summary").click();
  const panel = page.getByTestId("wallet-access");
  await panel.getByRole("checkbox").check();
  await panel
    .getByRole("button", {
      name: "Register / sign in with wallet",
      exact: true,
    })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await expect(page.locator(".account-button")).toContainText(
    wallet.address.slice(0, 6).toLowerCase(),
  );
  await page.reload();
  await expect(page.locator(".account-button")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Wallet", exact: true }).click();
  await expect(page.getByTestId("wallet-access")).toContainText(
    wallet.address.toLowerCase(),
  );
  await page.getByRole("tab", { name: "Preferences", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page.locator(".auth-wallet > summary").click();
  await page.getByTestId("wallet-access").getByRole("checkbox").check();
  await page
    .getByTestId("wallet-access")
    .getByRole("button", {
      name: "Register / sign in with wallet",
      exact: true,
    })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  expect(methods).toContain("personal_sign");
  expect(
    methods.every((m) =>
      [
        "eth_requestAccounts",
        "eth_accounts",
        "eth_chainId",
        "personal_sign",
      ].includes(m),
    ),
  ).toBeTruthy();
});
test("missing wallet has a useful error state and disabled login", async ({
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
  await page.locator(".auth-wallet > summary").click();
  await expect(page.getByTestId("wallet-access")).toContainText(
    "No wallet found",
  );
  await expect(
    page.getByTestId("wallet-access").getByRole("button"),
  ).toBeDisabled();
});
