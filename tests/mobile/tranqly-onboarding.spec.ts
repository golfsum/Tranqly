import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("onboarding is one controlled flow through Insights Journey and You", async ({ page }, testInfo) => {
  const firstWeek = page.getByText("Your first week with Tranqly", { exact: true });
  await expect(firstWeek).toBeVisible();
  await expect(page.getByText("Step 1 of 5", { exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath("first-week.png") });
  await testInfo.attach("first-week", { body: await page.screenshot(), contentType: "image/png" });
  const firstWeekCard = await firstWeek.locator("xpath=ancestor::*[@role='dialog'][1]").boundingBox();

  await expect(page.getByText("What should I call you? (Optional)", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Your name").fill("Taylor");
  const populatedCard = await firstWeek.locator("xpath=ancestor::*[@role='dialog'][1]").boundingBox();
  expect(Math.abs((firstWeekCard?.height ?? 0) - (populatedCard?.height ?? 0))).toBeLessThanOrEqual(2);

  await page.getByText("Next", { exact: true }).click();
  await expect(page.getByText("Begin your journey", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Step 2 of 5", { exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath("free-week.png") });
  await testInfo.attach("free-week", { body: await page.screenshot(), contentType: "image/png" });
  await expect(page.getByText("$59.99", { exact: false })).toHaveCount(0);
  await expect(page.getByText("$5.99", { exact: false })).toHaveCount(0);
  await expect(page.getByText("No payment required. Nothing renews automatically.", { exact: true })).toBeVisible();
  await page.getByText("Begin your journey", { exact: true }).nth(1).click();

  await expect(page.getByText("Your first reflection", { exact: true })).toBeVisible();
  await expect(page.getByText("Step 3 of 5", { exact: true })).toBeVisible();
  await expect(page.getByTestId("coach-target-highlight")).toBeVisible();
  await expect(page.getByTestId("daily-prompt")).toBeVisible();
  await expect(page.getByTestId("reflection-mic")).toBeVisible();

  await page.getByText("Next", { exact: true }).click();
  await expect(page.getByText("Your Journey", { exact: true })).toBeVisible();
  await expect(page.getByText("Step 4 of 5", { exact: true })).toBeVisible();
  await expect(page.getByTestId("coach-target-highlight")).toBeVisible();
  await expect(page.getByTestId("daily-prompt")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath("journey-coach.png") });
  await testInfo.attach("journey-coach", { body: await page.screenshot(), contentType: "image/png" });
  await expect(page.getByText("Your journey", { exact: true })).toHaveCount(0);

  await page.getByText("Next", { exact: true }).click();
  await expect(page.getByText("Your sanctuary", { exact: true })).toBeVisible();
  await expect(page.getByText("Step 5 of 5", { exact: true })).toBeVisible();
  await expect(page.getByTestId("coach-target-highlight")).toBeVisible();
  await expect(page.getByPlaceholder("What should Tranqly call you?")).toHaveCount(0);

  await page.getByText("Done", { exact: true }).click();
  await expect(page.getByText("Your sanctuary", { exact: true })).toBeHidden();
  await expect(page.getByText("You're all set", { exact: true })).toBeVisible();
  await page.getByText("Start reflecting", { exact: true }).click();
  await expect(page.getByTestId("daily-prompt")).toBeVisible();

  await page.reload();
  await expect(firstWeek).toHaveCount(0);
  await expect(page.getByText("Your first reflection", { exact: true })).toHaveCount(0);
});

test("skip stops every remaining coach mark", async ({ page }) => {
  await page.getByText("Next", { exact: true }).click();
  await page.getByText("Begin your journey", { exact: true }).nth(1).click();
  await page.getByLabel("Skip onboarding").click();

  await page.getByRole("tab", { name: "Journey" }).click();
  await expect(page.getByText("Your Journey", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "You" }).click();
  await expect(page.getByText("Your sanctuary", { exact: true })).toHaveCount(0);
});
