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
    await page
      .getByRole("button", { name: "Sample replay", exact: true })
      .click();
    const shell = page.locator(".charts-1 .chart-shell");
    const canvas = shell.locator(".chart-canvas");
    await expect(canvas.locator("canvas").first()).toBeVisible();
    await expect
      .poll(async () => {
        const plot = await canvas.boundingBox();
        const body = await page.locator(".chart-body").boundingBox();
        const toolbar = await page
          .getByRole("toolbar", { name: "Drawing tools", exact: true })
          .boundingBox();
        return (
          !!plot &&
          !!body &&
          !!toolbar &&
          Math.abs(plot.width - body.width) < 2 &&
          toolbar.y + toolbar.height <= plot.y + 1 &&
          plot.height >= 300
        );
      })
      .toBe(true);
    await expect
      .poll(() =>
        shell.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.locator(".chart-body").evaluate((el) => {
          const shell = el.querySelector(".chart-shell")!;
          return (
            Math.abs(
              el.getBoundingClientRect().bottom -
                shell.getBoundingClientRect().bottom,
            ) < 2
          );
        }),
      )
      .toBe(true);
    await page
      .getByRole("toolbar", { name: "Drawing tools", exact: true })
      .getByRole("button", { name: "Horizontal line", exact: true })
      .click();
    await expect(
      page
        .getByRole("toolbar", { name: "Drawing tools", exact: true })
        .getByRole("button", { name: "Horizontal line", exact: true }),
    ).toHaveClass(/active/);
    await page.locator("#chart-panel").screenshot({
      path: `test-results/chart-mobile-${width}.png`,
    });
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
