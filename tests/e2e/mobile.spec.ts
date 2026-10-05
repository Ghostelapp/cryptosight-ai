import { test, expect } from "@playwright/test";

for (const width of [320, 390, 768]) {
  test(`mobile ${width}px: navigation, focus, panel links and page width`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "I understand and agree", exact: true })
      .click();
    const menu = page.getByRole("button", { name: "Navigation", exact: true });
    await menu.click();
    const drawer = page.getByRole("dialog", {
      name: "Navigation",
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();
    await menu.click();
    await drawer.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
    await menu.click();
    await drawer.getByRole("button", { name: "Terminal", exact: true }).click();
    await page.getByRole("link", { name: "AI analysis", exact: true }).click();
    await expect(page).toHaveURL(/#analysis-panel$/);
    await expect(page.locator("#analysis-panel")).toBeInViewport();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/mobile-${width}.png`,
      fullPage: true,
    });
  });
}
