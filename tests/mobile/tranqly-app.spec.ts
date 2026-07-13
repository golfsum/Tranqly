import { expect, test } from "@playwright/test";
import { captureScrollableCoverage } from "./support/visual-coverage";

test("Tranqly complete visual map", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  await expect(page.getByText("Today's Discovery", { exact: true })).toBeVisible();
  await captureScrollableCoverage(page, page.getByTestId("insights-scroll"), "insights", testInfo);

  await page.getByRole("tab", { name: "Journey" }).click();
  await expect(page.getByText("Your journey", { exact: true })).toBeVisible();
  await captureScrollableCoverage(page, page.getByTestId("journey-scroll"), "journey", testInfo);

  await page.getByTestId("journey-explore-sanctuary").click();
  await expect(page.getByText("Current Sanctuary", { exact: true })).toBeVisible();
  await captureScrollableCoverage(page, page.getByTestId("sanctuary-modal-scroll"), "journey-sanctuary", testInfo);
  await page.getByTestId("close-sanctuary").click();

  await page.getByRole("tab", { name: "You" }).click();
  await expect(page.getByPlaceholder("What should Tranqly call you?")).toBeVisible();
  await captureScrollableCoverage(page, page.getByTestId("you-scroll"), "you", testInfo);

  await page.getByTestId("change-sanctuary").click();
  await expect(page.getByText("Choose Sanctuary", { exact: true })).toBeVisible();
  await captureScrollableCoverage(page, page.getByTestId("theme-picker-scroll"), "you-sanctuary-picker", testInfo);
  await page.getByTestId("close-theme-picker").click();

  await page.getByRole("tab", { name: "Insights" }).click();
  await expect(page.getByText("Today's Discovery", { exact: true })).toBeVisible();
});
