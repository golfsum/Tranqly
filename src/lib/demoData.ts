import { CheckIn, CoachReply, DeepInsight, Mood, dateKeyOf } from "./types";
import type { ComplimentaryAccess } from "./access";

export const DEMO_ID_PREFIX = "tranqly-demo-";
export const FIRST_WEEK_DEMO_ID_PREFIX = "tranqly-first-week-demo-";
export const DEMO_NOTE_PREFIX = "[demo] ";

type DemoEntrySeed = {
  daysAgo: number;
  time: string;
  text: string;
  prompt: string;
  summary: string;
  message: string;
  nextStep: string;
  pattern: string;
  tags: string[];
  tone: string;
  source: "voice" | "typed";
  mood: Mood;
};

const DEMO_ENTRIES: DemoEntrySeed[] = [
  {
    daysAgo: 0,
    time: "08:14",
    text: "I actually got some sleep last night and I did not feel like I needed to sleep in. I had enough energy to make breakfast before work.",
    prompt: "What felt easier than expected?",
    summary: "Better sleep changed the tone of the morning.",
    message:
      "Getting real sleep changed the tone of today. The important detail is not just that you rested, it is that your body did not feel like it needed to recover as hard this morning.",
    nextStep: "Notice what helped you sleep better last night. That detail may be worth repeating.",
    pattern: "Sleep may be tied closely to your morning energy and how much space the day feels like it has.",
    tags: ["sleep", "energy", "calm"],
    tone: "rested and clear",
    source: "voice",
    mood: "good",
  },
  {
    daysAgo: 1,
    time: "18:42",
    text: "I had a job interview today. I was nervous, but I prepared more than I usually do and felt proud that I showed up.",
    prompt: "What took courage today?",
    summary: "You showed up for a new opportunity.",
    message:
      "You took a step toward something new today. The nerves make sense, but the stronger signal is that you prepared and still showed up.",
    nextStep: "Before bed, write down one answer from the interview that you handled well.",
    pattern: "You tend to move forward even when uncertainty is present.",
    tags: ["work", "growth", "courage"],
    tone: "nervous but proud",
    source: "typed",
    mood: "good",
  },
  {
    daysAgo: 2,
    time: "20:05",
    text: "Work felt packed with meetings. I took a short walk outside after lunch and it helped me reset before the afternoon.",
    prompt: "What helped you feel steadier?",
    summary: "Outside time helped you reset during a busy workday.",
    message:
      "The walk mattered. It gave your day a small break point instead of letting the meetings blur together.",
    nextStep: "Try protecting one ten minute reset tomorrow, even if the day gets busy.",
    pattern: "Outside time keeps showing up as a reliable way to clear your head.",
    tags: ["work", "nature", "calm"],
    tone: "busy but grounded",
    source: "voice",
    mood: "okay",
  },
  {
    daysAgo: 3,
    time: "21:16",
    text: "I felt irritated most of the afternoon. I think I was hungry and trying to keep pushing instead of pausing.",
    prompt: "What felt heavy today?",
    summary: "You noticed a basic need underneath irritation.",
    message:
      "You caught something useful today. The irritation was not random, it may have been your body asking for a pause before your mind had words for it.",
    nextStep: "Tomorrow, check in with food and water before you label the day as bad.",
    pattern: "Physical needs may be affecting your mood more than they first appear.",
    tags: ["stress", "health", "awareness"],
    tone: "irritated but reflective",
    source: "typed",
    mood: "meh",
  },
  {
    daysAgo: 4,
    time: "19:33",
    text: "I called my sister after dinner. We laughed about something small and I realized I had been needing that kind of easy conversation.",
    prompt: "What gave you energy today?",
    summary: "Easy family connection lifted your evening.",
    message:
      "That conversation gave you something simple and real. It sounds like connection helped the day feel lighter without needing to fix everything.",
    nextStep: "Send a short message this week to someone who helps you feel like yourself.",
    pattern: "Family connection often brings your language back toward ease and humor.",
    tags: ["family", "gratitude", "energy"],
    tone: "connected and lighter",
    source: "voice",
    mood: "amazing",
  },
  {
    daysAgo: 5,
    time: "07:55",
    text: "I woke up thinking about everything I needed to do. I wrote a short list and only picked three things. That helped.",
    prompt: "What made the day feel manageable?",
    summary: "Choosing fewer priorities made the morning calmer.",
    message:
      "You made the day smaller in a good way. Picking three things gave your attention somewhere to land.",
    nextStep: "Use the same three item list tomorrow morning before the day starts making noise.",
    pattern: "You seem calmer when you reduce the day to a few clear next steps.",
    tags: ["work", "calm", "focus"],
    tone: "focused and practical",
    source: "typed",
    mood: "okay",
  },
  {
    daysAgo: 6,
    time: "20:48",
    text: "I was grateful for dinner at home tonight. Nothing big happened, but it felt peaceful to not rush anywhere.",
    prompt: "What are you grateful for today?",
    summary: "A quiet evening at home felt restorative.",
    message:
      "This is the kind of detail worth keeping. A peaceful dinner may look ordinary, but it gave your system a slower ending to the day.",
    nextStep: "Notice one small home routine that makes evenings feel easier.",
    pattern: "Gratitude appears most clearly when the day slows down.",
    tags: ["gratitude", "home", "calm"],
    tone: "peaceful and appreciative",
    source: "typed",
    mood: "good",
  },
  {
    daysAgo: 7,
    time: "17:58",
    text: "I spent time outside after work and felt my shoulders drop. I forget how much being near trees helps.",
    prompt: "What helped you feel calm today?",
    summary: "Time near trees helped your body relax.",
    message:
      "Your body gave you a clear signal today. Being outside did not solve everything, but it helped your shoulders let go.",
    nextStep: "If tomorrow feels tight, step outside before you try to push through.",
    pattern: "Nature keeps appearing as a calming cue in your reflections.",
    tags: ["nature", "calm", "body"],
    tone: "relieved and grounded",
    source: "voice",
    mood: "good",
  },
  {
    daysAgo: 8,
    time: "22:02",
    text: "I stayed up too late again scrolling. I felt tired today and noticed I was less patient with people.",
    prompt: "What would you like to let go of today?",
    summary: "Late scrolling seemed connected to lower patience.",
    message:
      "You noticed a connection that matters. The late night did not just affect sleep, it changed how much patience you had available today.",
    nextStep: "Put the phone across the room for the first ten minutes after getting into bed.",
    pattern: "Sleep and patience seem connected for you.",
    tags: ["sleep", "stress", "habit"],
    tone: "tired and honest",
    source: "typed",
    mood: "rough",
  },
  {
    daysAgo: 9,
    time: "18:27",
    text: "I finished the project draft I had been avoiding. It was not perfect, but it is finally moving.",
    prompt: "What is one thing you are proud of?",
    summary: "You moved an avoided project forward.",
    message:
      "You broke the freeze today. The win is not perfection, it is that the project is moving again.",
    nextStep: "Name the next smallest piece of the project before you stop for the night.",
    pattern: "Progress starts for you when the goal becomes smaller and more concrete.",
    tags: ["work", "growth", "win"],
    tone: "proud and relieved",
    source: "typed",
    mood: "good",
  },
  {
    daysAgo: 10,
    time: "21:10",
    text: "I felt a little lonely tonight, but I made tea and sat quietly instead of trying to distract myself right away.",
    prompt: "What else is on your mind?",
    summary: "You stayed present with a lonely feeling.",
    message:
      "You gave yourself company tonight. Making tea and sitting quietly was a gentle way of not abandoning the feeling.",
    nextStep: "Let tomorrow include one small point of contact, even a short text.",
    pattern: "When evenings feel lonely, quiet rituals help you stay steady.",
    tags: ["reflection", "calm", "relationships"],
    tone: "lonely but tender",
    source: "voice",
    mood: "meh",
  },
  {
    daysAgo: 11,
    time: "07:42",
    text: "I exercised before work. It was only twenty minutes, but I noticed I was less tense during the first meeting.",
    prompt: "What gave you energy today?",
    summary: "A short workout helped reduce morning tension.",
    message:
      "Twenty minutes was enough to change the texture of your morning. That is useful information, especially before work starts asking for so much.",
    nextStep: "Repeat the smallest version of this, not the perfect version.",
    pattern: "Movement before work may help lower the tension you carry into meetings.",
    tags: ["exercise", "work", "energy"],
    tone: "energized and steady",
    source: "typed",
    mood: "good",
  },
  {
    daysAgo: 12,
    time: "19:05",
    text: "I had dinner with friends. I laughed more than I expected and came home feeling lighter.",
    prompt: "What made you smile today?",
    summary: "Time with friends made the day feel lighter.",
    message:
      "That laughter stands out. It sounds like being around people who feel easy helped you come back to yourself.",
    nextStep: "Save this as evidence that connection can change the whole tone of a day.",
    pattern: "Unforced social time often leaves you feeling lighter.",
    tags: ["relationships", "gratitude", "calm"],
    tone: "light and grateful",
    source: "voice",
    mood: "amazing",
  },
  {
    daysAgo: 13,
    time: "20:21",
    text: "The day was messy, but I still checked in. I do not have a big takeaway. I just want to keep showing up.",
    prompt: "What do you want to remember from today?",
    summary: "You checked in even without a big takeaway.",
    message:
      "This is still a real reflection. Some days do not hand you a lesson, but showing up keeps the thread intact.",
    nextStep: "Keep the bar low tomorrow. One honest sentence is enough.",
    pattern: "Consistency matters to you even when the day feels unclear.",
    tags: ["consistency", "reflection", "growth"],
    tone: "steady and honest",
    source: "typed",
    mood: "okay",
  },
];

function dateForDemo(daysAgo: number, time: string, base = new Date()) {
  const date = new Date(base);
  date.setDate(date.getDate() - daysAgo);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function demoReply(seed: DemoEntrySeed, createdAt: string): CoachReply {
  return {
    title: "Today I noticed...",
    preview: seed.summary,
    nudgeLabel: "Something to Notice",
    message: seed.message,
    nextStep: seed.nextStep,
    pattern: seed.pattern,
    summary: seed.summary,
    themes: seed.tags,
    tags: seed.tags,
    emotionalTone: seed.tone,
    followUpQuestions: ["What helped shape that moment today?"],
    source: "ai",
    createdAt,
  };
}

export function buildDemoCheckIns(): CheckIn[] {
  return DEMO_ENTRIES.map((seed, index) => {
    const date = dateForDemo(seed.daysAgo, seed.time);
    const createdAt = date.toISOString();
    return {
      id: `${DEMO_ID_PREFIX}${index}`,
      text: seed.text,
      createdAt,
      dateKey: dateKeyOf(date),
      source: seed.source,
      prompt: seed.prompt,
      promptType: "demo_personalized",
      promptWhy: "Demo data shows how Tranqly can learn from patterns over time.",
      reply: demoReply(seed, createdAt),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function buildFirstWeekTrialDemo(now = new Date()): {
  checkIns: CheckIn[];
  deepInsight: DeepInsight;
  moods: Record<string, Mood>;
  complimentaryAccess: ComplimentaryAccess;
} {
  const weekSeeds = DEMO_ENTRIES.slice(0, 7);
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 7);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() - 1);
  periodEnd.setHours(23, 59, 59, 999);
  const checkIns = weekSeeds.map((seed, index) => {
    const date = dateForDemo(7 - index, seed.time, now);
    const createdAt = date.toISOString();
    return {
      id: `${FIRST_WEEK_DEMO_ID_PREFIX}${index}`,
      text: seed.text,
      createdAt,
      dateKey: dateKeyOf(date),
      source: seed.source,
      prompt: seed.prompt,
      promptType: "first_week_demo",
      promptWhy: "Tranqly chose this from the themes in your first week.",
      reply: demoReply(seed, createdAt),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const moods: Record<string, Mood> = {};
  for (const entry of checkIns) {
    const seed = weekSeeds.find((item) => item.text === entry.text);
    if (seed) moods[entry.dateKey] = seed.mood;
  }
  const weekStart = checkIns[checkIns.length - 1]?.dateKey;
  const weekEnd = checkIns[0]?.dateKey;
  const createdAt = now.toISOString();
  return {
    checkIns,
    moods,
    deepInsight: {
      ...buildDemoDeepInsight(),
      headline: "Your first week showed what helps you steady yourself",
      insight:
        "Across your reflections this week, a clear thread appeared: rest, small pauses, and easy connection seemed to make the week feel more manageable. You began noticing which moments helped you feel steadier and more like yourself.",
      pattern:
        "Your calmer reflections followed days with sleep, a short walk, or a simpler plan.",
      suggestion:
        "Protect one small reset during the coming week. A short walk, a smaller list, or a quieter evening may be enough.",
      affirmation:
        "You showed up for seven quiet moments, and that gave Tranqly something real to learn from.",
      gentleFocusTitle: "Next gentle focus",
      evidenceLevel: "strong",
      completionMessage: "You made space to reflect every day this week.",
      reflectionDays: 7,
      reflectionCount: 7,
      rewardUnlocked: true,
      rewardId: "forest-haven",
      recurring_themes: ["sleep", "work pressure", "outside time", "connection"],
      mood_trend: "The week became steadier when rest and pauses appeared.",
      next_focus: "Keep one small reset close, especially before busy days.",
      source: "local",
      createdAt,
      isDemo: true,
      weekStart,
      weekEnd,
    },
    complimentaryAccess: {
      startedAt: periodStart.toISOString(),
      endsAt: periodEnd.toISOString(),
      status: "completed",
      source: "first_week",
      weeklyReflectionDeliveredAt: createdAt,
      conversionPromptShownAt: null,
      isDemo: true,
    },
  };
}

export function buildDemoMoods(): Record<string, Mood> {
  const moods: Record<string, Mood> = {};
  for (const seed of DEMO_ENTRIES) {
    const date = dateForDemo(seed.daysAgo, seed.time);
    moods[dateKeyOf(date)] = seed.mood;
  }
  return moods;
}

export function buildDemoCoachNotes(): string[] {
  return [
    "Sleep seems closely tied to your morning energy.",
    "Outside time and short walks often help you reset.",
    "Family and easy conversations tend to make the day feel lighter.",
    "You make progress when big work is broken into smaller next steps.",
  ].map((note) => `${DEMO_NOTE_PREFIX}${note}`);
}

export function buildDemoDeepInsight(): DeepInsight {
  return {
    headline: "Your week got steadier when you slowed down",
    insight:
      "Across this demo week, sleep, outside time, and smaller work goals kept showing up before calmer reflections. The pattern is practical: when the day had a pause point, your language became clearer and more grounded.",
    pattern:
      "Work pressure was easier to carry on days with a walk, movement, or a smaller plan.",
    suggestion:
      "This week, try one ten minute reset before the busiest part of the day. Keep it small enough that it still works on a messy day.",
    affirmation:
      "You do not need a perfect routine to understand what helps you.",
    recurring_themes: ["sleep", "outside time", "work pressure", "family connection"],
    mood_trend: "Calmer language increased after rest and outdoor time.",
    next_focus: "Protect one small pause before the day speeds up.",
    confidence: 0.86,
    safety_flags: [],
    source: "local",
    createdAt: new Date().toISOString(),
    isDemo: true,
  };
}

export function isDemoCheckIn(entry: CheckIn) {
  return entry.id.startsWith(DEMO_ID_PREFIX) || entry.id.startsWith(FIRST_WEEK_DEMO_ID_PREFIX);
}

export function isDemoNote(note: string) {
  return note.startsWith(DEMO_NOTE_PREFIX);
}

export function stripDemoNotePrefix(note: string) {
  return note.startsWith(DEMO_NOTE_PREFIX) ? note.slice(DEMO_NOTE_PREFIX.length) : note;
}
