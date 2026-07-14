import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/app");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("web onboarding uses the controlled sequence and measured targets", async ({ page }, testInfo) => {
  await expect(page.getByText("Step 1 of 5", { exact: true })).toBeVisible();
  await expect(page.getByText("Your first week with Tranqly", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Your name").fill("Taylor");
  await page.getByText("Next", { exact: true }).click();
  await expect(page.getByText("Step 2 of 5", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Begin your journey" })).toBeVisible();
  await expect(page.getByText("No payment required. Nothing renews automatically.", { exact: true })).toBeVisible();
  await expect(page.getByText("$59.99", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Begin your journey" }).click();

  await expect(page.getByText("Your first reflection", { exact: true })).toBeVisible();
  await expect(page.getByText("Step 3 of 5", { exact: true })).toBeVisible();
  await expect(page.getByTestId("coach-target-highlight")).toBeVisible();
  await page.getByText("Next", { exact: true }).click();
  await expect(page.getByText("Your Journey", { exact: true })).toBeVisible();
  await expect(page.getByText("Step 4 of 5", { exact: true })).toBeVisible();
  await expect(page.getByTestId("coach-target-highlight")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh Prompt" }).first()).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath("journey-target.png") });

  await page.getByText("Next", { exact: true }).click();
  await expect(page.getByText("Your sanctuary", { exact: true })).toBeVisible();
  await expect(page.getByText("Step 5 of 5", { exact: true })).toBeVisible();
  await expect(page.getByTestId("coach-target-highlight")).toBeVisible();
  await page.getByText("Done", { exact: true }).click();
  await expect(page.getByText("Your sanctuary", { exact: true })).toHaveCount(0);
  await expect(page.getByText("You're all set", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start reflecting" }).click();
  await expect(page.getByRole("button", { name: "Refresh Prompt" }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("Your first week with Tranqly", { exact: true })).toHaveCount(0);
});
