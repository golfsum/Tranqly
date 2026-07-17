import { expect, test } from "@playwright/test";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildExpiredFirstWeekState() {
  const now = new Date();
  const startedAt = new Date(now);
  startedAt.setDate(startedAt.getDate() - 8);
  startedAt.setHours(9, 0, 0, 0);
  const endsAt = new Date(startedAt);
  endsAt.setDate(endsAt.getDate() + 7);

  const checkIns = Array.from({ length: 7 }, (_, index) => {
    const created = new Date(startedAt);
    created.setDate(startedAt.getDate() + index);
    created.setHours(19, 0, 0, 0);
    return {
      id: `first-week-${index}`,
      text: [
        "I took a short walk and felt a little clearer.",
        "Work was busy, but I kept the evening simple.",
        "I slept better and had more patience today.",
        "I noticed that stepping outside helped me reset.",
        "Dinner with family felt easy and grounding.",
        "I finished less than planned, but I did not spiral.",
        "I made space for one quiet minute again.",
      ][index],
      createdAt: created.toISOString(),
      dateKey: dayKey(created),
      source: "typed",
      prompt: "What helped you feel steady today?",
      promptType: "first_week_test",
    };
  }).reverse();

  const weeklyInsight = {
    headline: "Your first week showed what helps you steady yourself",
    insight:
      "Across your reflections this week, a clear thread appeared: rest, small pauses, and easy connection seemed to make the week feel more manageable. You began noticing which moments helped you feel steadier and more like yourself.",
    suggestion:
      "Protect one small reset during the coming week. A short walk, a smaller list, or a quieter evening may be enough.",
    affirmation:
      "You showed up for seven quiet moments, and that gave Tranqly something real to learn from.",
    createdAt: now.toISOString(),
    weekStart: checkIns[checkIns.length - 1].dateKey,
    weekEnd: checkIns[0].dateKey,
    gentleFocusTitle: "Next gentle focus",
    reflectionDays: 7,
    reflectionCount: 7,
    rewardUnlocked: true,
    rewardId: "forest-haven",
  };

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
        onboardingCompletedAt: now.toISOString(),
        complimentaryAccess: {
          startedAt: startedAt.toISOString(),
          endsAt: endsAt.toISOString(),
          status: "expired",
          source: "first_week",
          weeklyReflectionDeliveredAt: now.toISOString(),
          conversionPromptShownAt: null,
        },
      },
      lastDeepInsight: weeklyInsight,
      weeklyInsights: [weeklyInsight],
      coachUsage: { dateKey: dayKey(now), count: 0 },
      coachNotes: [],
      updatedAt: now.toISOString(),
    },
    version: 0,
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/app");
  await page.evaluate(() => window.localStorage.clear());
});

test("first week completion appears, stays readable, and week two prompt gates new reflections", async ({ page }) => {
  await page.evaluate((state) => {
    window.localStorage.setItem("tranqly-v1", JSON.stringify(state));
  }, buildExpiredFirstWeekState());
  await page.reload();

  await expect(page.getByRole("dialog", { name: "Your first week reflection" })).toBeVisible();
  await expect(page.getByText("You've completed your first week.", { exact: true })).toBeVisible();
  await expect(page.getByText("7 reflection days", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Forest Haven unlocked" })).toBeVisible();
  await expect(page.getByText("Yearly plan selected", { exact: true })).toBeVisible();
  await expect(page.getByText("This Week You Gained", { exact: true })).toBeVisible();
  await expect(page.getByText("Next Week You'll Discover", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue My Journey" })).toBeVisible();

  await page.getByRole("button", { name: "Maybe Later" }).click();
  await expect(page.getByRole("dialog", { name: "Your first week reflection" })).toHaveCount(0);
  await expect(page.locator("span:visible", { hasText: "Welcome back." }).first()).toBeVisible();

  await page.locator('[data-testid="desktop-tab-journey"]:visible, button[aria-label="Journey"]:visible').click();
  const weeklyReflectionButton = page.locator("button:visible", { hasText: "Read Weekly Reflection" }).first();
  await expect(weeklyReflectionButton).toBeVisible();
  await weeklyReflectionButton.click();
  await expect(page.getByText("Weekly Reflection History", { exact: true })).toBeVisible();
  await expect(page.getByText("Your first week showed what helps you steady yourself", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.locator('[data-testid="desktop-tab-today"]:visible, button[aria-label="Insights"]:visible').click();
  await page.getByRole("textbox").fill("I want to keep reflecting this week.");
  await page.getByRole("button", { name: "Get Insights" }).click();
  await expect(page.getByRole("dialog", { name: "Tranqly Plus" })).toBeVisible();
  await expect(page.getByText("Ready for another week?", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Begin Week Two" })).toBeVisible();
});
