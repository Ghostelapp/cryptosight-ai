import { test, expect } from "@playwright/test";

test("paper ticket, reserved limit cancellation, SL/TP editing and partial/full close UI", async ({
  page,
}) => {
  let orders: any[] = [],
    exits: any[] = [],
    created = 0;
  const overview = () => ({
    account: { balance: "10000" },
    orders,
    exits,
    exposure: orders
      .filter((o) => o.status === "filled")
      .map((o) => ({ id: o.id, mark: 110, unrealizedPnl: 21.582 })),
    equity: 10000,
    reserved: orders
      .filter((o) => o.status === "pending")
      .reduce((s, o) => s + Number(o.reserved), 0),
    drawdownPct: 0,
    complete: true,
    engineActive: true,
    engineLastTick: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stats: {
      closedTrades: orders.filter((o) => o.status === "closed").length,
      winRate: 100,
      realizedPnl: exits.reduce((s, e) => s + Number(e.pnl), 0),
      profitFactor: null,
      unrealizedPnl: 21.582,
    },
  });
  await page.route("**/api/v1/paper/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/account")) return route.fulfill({ json: overview() });
    const body = route.request().postDataJSON();
    expect(body.leverage).toBe(10);
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    const o = {
      id: crypto.randomUUID(),
      symbol: body.symbol,
      venue: body.venue,
      market: body.market,
      leverage: body.leverage,
      direction: body.direction,
      quantity: String(body.quantity),
      initial_quantity: String(body.quantity),
      order_type: body.orderType,
      limit_price: String(body.limitPrice),
      fill_price: created ? "99" : null,
      stop_loss: String(body.stopLoss),
      take_profit: String(body.takeProfit),
      reserved: created ? "0" : "20.2",
      version: 1,
      status: created ? "filled" : "pending",
      pnl: null,
      pending_exit: null,
      close_reason: null,
    };
    created++;
    orders.unshift(o);
    await route.fulfill({ json: o });
  });
  await page.route("**/api/v1/paper-cancel/*", async (route) => {
    const o = orders.find((o) => route.request().url().endsWith(o.id));
    o.status = "cancelled";
    o.reserved = "0";
    await route.fulfill({ json: o });
  });
  await page.route("**/api/v1/paper-protection/*", async (route) => {
    const o = orders.find((o) => route.request().url().endsWith(o.id));
    const b = route.request().postDataJSON();
    expect(b.version).toBe(o.version);
    o.stop_loss = b.stopLoss;
    o.take_profit = b.takeProfit;
    o.version++;
    await route.fulfill({ json: o });
  });
  await page.route("**/api/v1/paper-close/*", async (route) => {
    const o = orders.find((o) => route.request().url().endsWith(o.id));
    const b = route.request().postDataJSON();
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    const q = b.quantity ?? Number(o.quantity);
    expect(q).toBeGreaterThan(0);
    const e = {
      id: crypto.randomUUID(),
      order_id: o.id,
      symbol: o.symbol,
      quantity: q,
      price: 110,
      pnl: q * 10.791,
      entry_fees: 0.099 * q,
      exit_fees: 0.11 * q,
      created_at: new Date().toISOString(),
      reason: "manual",
    };
    exits.unshift(e);
    if (q === Number(o.quantity)) o.status = "closed";
    else o.quantity = String(Number(o.quantity) - q);
    o.version++;
    await route.fulfill({ json: e });
  });
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
    .fill(`paper-e2e-${Date.now()}@example.com`);
  await page
    .getByLabel("Password (at least 12 characters)", { exact: true })
    .fill("paper-e2e-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".account-button")).toBeVisible();
  await page
    .getByRole("button", { name: "Paper trading", exact: true })
    .click();
  const ticket = page.getByRole("region", { name: "New order", exact: true });
  await expect(
    ticket.getByRole("combobox", { name: "Leverage", exact: true }),
  ).toBeDisabled();
  await ticket
    .getByRole("button", {
      name: "Want leverage? Switch to futures →",
      exact: true,
    })
    .click();
  await ticket
    .getByRole("combobox", { name: "Leverage", exact: true })
    .selectOption("10");
  await page
    .getByRole("combobox", { name: "Order type", exact: true })
    .selectOption("limit");
  await page.getByLabel("Limit price", { exact: true }).fill("100");
  await page.getByLabel("Quantity", { exact: true }).fill("2");
  await expect(ticket.locator(".paper-estimate")).toContainText("20 USDT");
  await page.getByText("SL / TP and risk sizing", { exact: true }).click();
  await page.getByLabel("Stop-loss", { exact: true }).fill("95");
  await page.getByLabel("Take-profit", { exact: true }).fill("120");
  await page.getByRole("button", { name: /^Place limit order/ }).click();
  await expect(
    page.getByRole("button", { name: "Cancel order", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cancel order", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Place limit order/ }).click();
  const position = page.locator("article.paper-position");
  await expect(position).toBeVisible();
  await expect(position).toContainText("LONG · 10×");
  await page.getByText("SL / TP and risk sizing", { exact: true }).click();
  await page
    .getByRole("region", { name: "Paper trading", exact: true })
    .screenshot({ path: "test-results/paper-compact-desktop.png" });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("region", { name: "Paper trading", exact: true })
    .screenshot({ path: "test-results/paper-compact-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await position.getByText("Manage · SL / TP", { exact: true }).click();
  await position.getByLabel("Stop-loss", { exact: true }).fill("105");
  await position
    .getByRole("button", { name: "Save SL/TP", exact: true })
    .click();
  await position
    .getByRole("button", { name: "Close 50%", exact: true })
    .click();
  await expect(position).toContainText("Quantity: 1");
  await position
    .getByRole("button", { name: "Close 100%", exact: true })
    .click();
  await expect(position).toHaveCount(0);
  await page.getByRole("tab", { name: /^Trade history/ }).click();
  await expect(page.locator("tbody").first().locator("tr")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/paper-mobile.png",
    fullPage: true,
  });
});
