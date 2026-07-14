import { expect, test } from "@playwright/test";

function desktopState() {
  const now = new Date();
  const checkIns = Array.from({ length: 8 }, (_, index) => {
    const createdAt = new Date(now);
    createdAt.setDate(now.getDate() - index);
    return {
      id: `scroll-test-${index}`,
      text: `Reflection ${index + 1} about work, rest, gratitude, and taking a quiet walk.`,
      createdAt: createdAt.toISOString(),
      dateKey: createdAt.toISOString().slice(0, 10),
      source: "typed",
    };
  });

  return {
    state: {
      checkIns,
      moods: {},
      settings: {
        name: "Taylor",
        premium: false,
        soundOn: true,
        theme: "twilight",
        onboarded: true,
        onboardingCoachCompleted: true,
        onboardingCoachStep: null,
        onboardingStatus: "completed",
        currentOnboardingStep: null,
      },
      lastDeepInsight: null,
      weeklyInsights: [],
      coachUsage: { dateKey: now.toISOString().slice(0, 10), count: 0 },
      coachNotes: [],
      updatedAt: now.toISOString(),
    },
    version: 0,
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/app");
  await page.evaluate((state) => {
    window.localStorage.setItem("tranqly-v1", JSON.stringify(state));
  }, desktopState());
  await page.reload();
});

for (const tab of ["journey", "settings"] as const) {
  test(`desktop ${tab} panel scrolls to all content`, async ({ page }) => {
    await page.getByTestId(`desktop-tab-${tab}`).click();
    const panel = page.getByTestId("desktop-content-scroll");

    await expect(panel).toBeVisible();
    await expect
      .poll(() => panel.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBe(true);

    await panel.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect
      .poll(() =>
        panel.evaluate(
          (element) => element.scrollTop + element.clientHeight >= element.scrollHeight - 2
        )
      )
      .toBe(true);
  });
}
