import { expect, test } from "@playwright/test";

test("prompt refresh and reflection composer work", async ({ page }) => {
  await page.goto("/");

  const prompt = page.getByTestId("daily-prompt");
  const originalPrompt = await prompt.textContent();
  await page.getByTestId("refresh-prompt").click();
  await expect(prompt).not.toHaveText(originalPrompt ?? "");

  const input = page.getByTestId("reflection-input");
  await input.fill("I slowed down and finished one important thing today.");
  await expect(input).toHaveValue("I slowed down and finished one important thing today.");
  await expect(page.getByText("Ready for insights.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("submit-reflection")).toBeEnabled();
});

test("tabs, sanctuary modals, and profile state work", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("tab", { name: "Journey" }).click();
  await expect(page.getByText("Your journey", { exact: true })).toBeVisible();

  await page.getByTestId("journey-explore-sanctuary").click();
  await expect(page.getByText("Current Sanctuary", { exact: true })).toBeVisible();
  await page.getByTestId("close-sanctuary").click();
  await expect(page.getByTestId("close-sanctuary")).toBeHidden();

  await page.getByRole("tab", { name: "You" }).click();
  const nameInput = page.getByPlaceholder("What should Tranqly call you?");
  await nameInput.fill("ND Test");
  await expect(nameInput).toHaveValue("ND Test");

  await page.getByTestId("change-sanctuary").click();
  await expect(page.getByText("Choose Sanctuary", { exact: true })).toBeVisible();
  await page.getByTestId("close-theme-picker").click();
  await expect(page.getByTestId("close-theme-picker")).toBeHidden();
  await expect(nameInput).toHaveValue("ND Test");
});
