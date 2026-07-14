import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "apps", "mobile", "store-assets", "source");
const port = 8094;
const baseUrl = `http://127.0.0.1:${port}`;

function localDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function richState({ includeToday = false, expired = false } = {}) {
  const now = new Date();
  const reflections = [
    [9, "I had a job interview today and felt nervous, but I was proud that I showed up.", "Work"],
    [8, "I slept better and had more patience with myself this morning.", "Sleep"],
    [7, "A short walk after work helped my thoughts settle.", "Nature"],
    [6, "Dinner with family felt easy and grounding tonight.", "Relationships"],
    [5, "Work was busy, but I finished the one task that mattered most.", "Work"],
    [4, "I noticed I felt calmer after putting my phone away early.", "Calm"],
    [3, "I was grateful for a quiet morning and a good cup of coffee.", "Gratitude"],
    [2, "I gave myself permission to do less and rest.", "Rest"],
    [1, "Getting outside for ten minutes made the afternoon feel lighter.", "Nature"],
  ];

  const checkIns = reflections.map(([daysAgo, text, tag], index) => {
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - Number(daysAgo));
    createdAt.setHours(19, 10 + index, 0, 0);
    return {
      id: `store-reflection-${index}`,
      text,
      createdAt: createdAt.toISOString(),
      dateKey: localDayKey(createdAt),
      source: index % 2 ? "typed" : "voice",
      prompt: "What helped you feel steady today?",
      promptType: "store_capture",
      reply: {
        title: tag === "Sleep" ? "You gave yourself a little grace today" : "One small choice helped the day feel steadier",
        preview: "You noticed what helped instead of brushing the moment aside.",
        summary: "You noticed what helped instead of brushing the moment aside.",
        message: `What stands out is the way you noticed ${String(tag).toLowerCase()} without trying to turn it into a perfect answer. That kind of attention gives you something honest to return to.`,
        nextStep: "Keep one small part of tonight simple and notice whether it gives you a little more space.",
        pattern: "Small pauses and time outside have appeared on several of your steadier days.",
        tags: [tag],
        themes: [tag],
        createdAt: createdAt.toISOString(),
      },
    };
  });

  if (includeToday) {
    checkIns.unshift({
      id: "store-reflection-today",
      text: "I actually got some sleep last night and did not feel like I needed to sleep in.",
      createdAt: now.toISOString(),
      dateKey: localDayKey(now),
      source: "voice",
      prompt: "How did your energy feel today?",
      promptType: "personalized",
      reply: {
        title: "You gave yourself a little grace today",
        preview: "Getting real sleep changed the tone of today and gave the morning more room.",
        summary: "Getting real sleep changed the tone of today and gave the morning more room.",
        message: "Getting real sleep changed the tone of today. What stands out is that you noticed the difference instead of pushing past it. You are paying attention to what helps you feel more like yourself.",
        nextStep: "Notice what helped you sleep better last night. That detail may be worth repeating.",
        pattern: "Sleep may be tied closely to your morning energy and how much space the day feels like it has.",
        tags: ["Sleep", "Calm"],
        themes: ["Sleep", "Calm"],
        createdAt: now.toISOString(),
      },
    });
  }

  const startedAt = new Date(now);
  startedAt.setDate(startedAt.getDate() - (expired ? 8 : 3));
  const endsAt = new Date(startedAt);
  endsAt.setDate(endsAt.getDate() + 7);
  const weeklyInsight = {
    headline: "Your first week showed what helps you steady yourself",
    insight: "Across your reflections this week, a clear thread appeared: rest, small pauses, and easy connection seemed to make the week feel more manageable. You began noticing which moments helped you feel steadier and more like yourself.",
    suggestion: "Protect one small reset during the coming week. A short walk, a smaller list, or a quieter evening may be enough.",
    affirmation: "You showed up for seven quiet moments, and that gave Tranqly something real to learn from.",
    createdAt: now.toISOString(),
    weekStart: checkIns.at(-1).dateKey,
    weekEnd: checkIns[0].dateKey,
    gentleFocusTitle: "Next gentle focus",
    reflectionDays: 7,
    reflectionCount: 7,
    rewardUnlocked: true,
    rewardId: "forest-haven",
  };

  return {
    checkIns,
    premium: !expired,
    coachUsage: { dateKey: localDayKey(now), count: 0 },
    moods: {},
    lastDeepInsight: weeklyInsight,
    weeklyInsights: [weeklyInsight],
    notificationSettings: {},
    sanctuaryUnlockNotifications: {},
    authUser: null,
    displayName: "Robert",
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
    complimentaryAccess: expired
      ? {
          startedAt: startedAt.toISOString(),
          endsAt: endsAt.toISOString(),
          status: "expired",
          source: "first_week",
          weeklyReflectionDeliveredAt: now.toISOString(),
          conversionPromptShownAt: null,
        }
      : null,
  };
}

async function waitForServer(timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Expo web did not start within ${timeoutMs / 1000} seconds.`);
}

async function seed(page, state) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(350);
  await page.evaluate((nextState) => {
    window.localStorage.clear();
    window.localStorage.setItem("tranqly-mobile-v1", JSON.stringify(nextState));
  }, state);
  await page.reload({ waitUntil: "networkidle" });
}

async function capture(page, name) {
  await page.screenshot({ path: path.join(outputDir, name), type: "png" });
}

async function stopServer(serverProcess) {
  if (!serverProcess.pid) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(serverProcess.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.once("close", resolve);
      killer.once("error", resolve);
    });
    return;
  }
  serverProcess.kill("SIGTERM");
}

await mkdir(outputDir, { recursive: true });
const server = spawn(
  `npm --prefix apps/mobile run start -- --web --port ${port}`,
  [],
  {
    cwd: root,
    env: { ...process.env, CI: "1", BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  },
);

server.stdout.on("data", (chunk) => process.stdout.write(chunk));
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await seed(page, richState());
  await page.getByTestId("daily-prompt").waitFor();
  await capture(page, "01-insights-current.png");

  await seed(page, richState({ includeToday: true }));
  await page.getByText("See more", { exact: true }).click();
  await page.getByText("One Gentle Step", { exact: true }).waitFor();
  await page.waitForTimeout(700);
  await capture(page, "02-personal-insight-current.png");

  await seed(page, richState({ includeToday: true, expired: true }));
  await page.getByText("Your first week is complete.", { exact: true }).waitFor();
  await page.waitForTimeout(700);
  await capture(page, "03-first-week-current.png");

  await seed(page, richState({ includeToday: true }));
  await page.getByRole("tab", { name: "Journey" }).click();
  await page.getByText("Your journey", { exact: true }).waitFor();
  await capture(page, "04-journey-current.png");

  await page.getByTestId("journey-explore-sanctuary").click();
  await page.getByText("Current Sanctuary", { exact: true }).waitFor();
  await page.waitForTimeout(700);
  await capture(page, "05-sanctuary-current.png");

  await page.getByTestId("close-sanctuary").click();
  await page.getByRole("tab", { name: "You" }).click();
  await page.getByTestId("change-sanctuary").click();
  await page.getByText("Choose Sanctuary", { exact: true }).waitFor();
  await page.waitForTimeout(700);
  await capture(page, "06-themes-current.png");

  await page.getByTestId("close-theme-picker").click();
  const privacySection = page.getByText("Privacy", { exact: true });
  await privacySection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await capture(page, "07-privacy-current.png");

  await context.close();
  console.log(`Captured current Tranqly screens in ${outputDir}`);
} finally {
  if (browser) await browser.close();
  await stopServer(server);
}
