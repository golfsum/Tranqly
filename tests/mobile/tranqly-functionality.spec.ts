import { expect, test } from "@playwright/test";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildMobileExpiredFirstWeekState() {
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
      id: `mobile-first-week-${index}`,
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
  const deepInsight = {
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
    checkIns,
    premium: false,
    coachUsage: { dateKey: dayKey(now), count: 0 },
    moods: {},
    lastDeepInsight: deepInsight,
    weeklyInsights: [deepInsight],
    notificationSettings: {},
    sanctuaryUnlockNotifications: {},
    authUser: null,
    displayName: "Taylor",
    sanctuaryTheme: "twilight",
    onboardingCompleted: true,
    onboardingCoachCompleted: true,
    onboardingCoachStep: null,
    onboardingSkippedAt: null,
    onboardingCompletedAt: now.toISOString(),
    reflectionCoachMarkSeen: true,
    journeyCoachMarkSeen: true,
    sanctuaryCoachMarkSeen: true,
    onboardingStatus: "completed",
    currentOnboardingStep: null,
    onboardingVersion: 2,
    complimentaryAccess: {
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: "expired",
      source: "first_week",
      weeklyReflectionDeliveredAt: now.toISOString(),
      conversionPromptShownAt: null,
    },
  };
}

function buildMobileActiveFirstWeekState() {
  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setDate(endsAt.getDate() + 7);
  return {
    checkIns: [],
    premium: false,
    coachUsage: { dateKey: dayKey(now), count: 0 },
    moods: {},
    lastDeepInsight: null,
    weeklyInsights: [],
    notificationSettings: {},
    sanctuaryUnlockNotifications: {},
    authUser: null,
    displayName: "Taylor",
    sanctuaryTheme: "twilight",
    onboardingCompleted: true,
    onboardingCoachCompleted: true,
    onboardingCoachStep: null,
    onboardingSkippedAt: null,
    onboardingCompletedAt: now.toISOString(),
    reflectionCoachMarkSeen: true,
    journeyCoachMarkSeen: true,
    sanctuaryCoachMarkSeen: true,
    onboardingStatus: "completed",
    currentOnboardingStep: null,
    onboardingVersion: 2,
    complimentaryAccess: {
      startedAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      status: "active",
      source: "first_week",
      weeklyReflectionDeliveredAt: null,
      conversionPromptShownAt: null,
    },
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => {
    window.localStorage.clear();
    window.localStorage.setItem("tranqly-mobile-v1", JSON.stringify(state));
  }, buildMobileActiveFirstWeekState());
  await page.reload();
});

test("prompt refresh and reflection composer work", async ({ page }) => {
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

test("day 7 completion appears and post-week reflection asks to begin week two", async ({ page }) => {
  await page.evaluate((state) => {
    window.localStorage.clear();
    window.localStorage.setItem("tranqly-mobile-v1", JSON.stringify(state));
  }, buildMobileExpiredFirstWeekState());
  await page.reload();

  await expect(page.getByText("You've completed your first week.", { exact: true })).toBeVisible();
  await expect(page.getByText("7 reflection days", { exact: true })).toBeVisible();
  await expect(page.getByText("Forest Haven unlocked", { exact: true }).nth(1)).toBeVisible();
  await expect(page.getByText("This Week You Gained", { exact: true })).toBeVisible();
  await expect(page.getByText("Next Week You'll Discover", { exact: true })).toBeVisible();
  await expect(page.getByText("Forest Haven, yours to keep", { exact: true })).toBeVisible();
  await expect(page.getByText("Your journey has already begun. The weeks ahead are where your insights become even more personal.", { exact: true })).toBeVisible();
  await expect(page.getByText("Yearly plan selected", { exact: true })).toBeVisible();
  await expect(page.getByText("Continue My Journey", { exact: true })).toBeVisible();

  await page.getByText("Maybe Later", { exact: true }).click();
  await expect(page.getByText("You've completed your first week.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Welcome back.", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Journey" }).click();
  await expect(page.getByText("Read Weekly Reflection", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: "Insights" }).click();
  await page.getByTestId("reflection-input").fill("I want to keep reflecting this week.");
  await page.getByTestId("submit-reflection").click();
  await expect(page.getByText("Ready for another week?", { exact: true })).toBeVisible();
  await expect(page.getByText("Begin Week Two", { exact: true })).toBeVisible();
});
