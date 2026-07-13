import { expect, test } from "@playwright/test";

test("landing navigation, legal links, support, and image preview work", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop navigation is hidden at phone width.");
  await page.goto("/");

  for (const [label, hash] of [
    ["Features", "#features"],
    ["How it works", "#how-it-works"],
    ["Sanctuaries", "#sanctuaries"],
    ["Lock in $3.99/mo", "#waitlist"],
  ] as const) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${hash.replace("#", "#")}$`));
    await expect(page.locator(hash)).toBeVisible();
  }

  await expect(page.getByRole("link", { name: "Support", exact: true })).toHaveAttribute(
    "href",
    "mailto:support@tranqly.com",
  );

  const preview = page.getByRole("button", { name: /^Preview / }).first();
  await preview.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "Terms", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
});

