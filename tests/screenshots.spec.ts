import { test, expect } from "@playwright/test";

test("home page", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => document.fonts.ready);

  await expect(page).toHaveScreenshot("home.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});