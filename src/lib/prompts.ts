import { CheckIn, MemoryProfile, PromptSelection } from "./types";

export const DAILY_PROMPTS = [
  "What made you smile today?",
  "What challenged you today?",
  "What are you grateful for today?",
  "What's one thing you're proud of?",
  "What surprised you today?",
  "What gave you energy today?",
  "What felt heavy today?",
  "What do you want to remember from today?",
  "What are you looking forward to tomorrow?",
  "What's one small win from today?",
  "What did you learn today?",
  "What helped you feel calm today?",
  "What would you like to let go of today?",
  "What was your favorite moment today?",
  "What else is on your mind?",
  "What felt different today?",
  "What did you need more of today?",
  "What did you handle better than before?",
  "What felt easier than expected?",
  "What took more energy than you thought?",
  "What helped you keep going today?",
  "What do you want to carry into tomorrow?",
  "What do you want to leave behind tonight?",
  "Where did you feel most like yourself today?",
  "What would make tomorrow feel a little lighter?",
];

const TOPIC_GROUPS = [
  {
    key: "work",
    keywords: ["work", "job", "meeting", "client", "project", "boss", "deadline", "office"],
    tone: "mixed" as const,
  },
  {
    key: "sleep",
    keywords: ["sleep", "slept", "rest", "tired", "drained", "exhausted", "energy"],
    tone: "heavy" as const,
  },
  {
    key: "stress",
    keywords: ["stress", "stressed", "pressure", "overwhelmed", "anxious", "hard", "heavy"],
    tone: "heavy" as const,
  },
  {
    key: "gratitude",
    keywords: ["grateful", "gratitude", "thankful", "appreciate"],
    tone: "encouraging" as const,
  },
  {
    key: "family",
    keywords: ["family", "mom", "dad", "partner", "friend", "friends", "kids", "wife", "husband"],
    tone: "steady" as const,
  },
  {
    key: "calm",
    keywords: ["calm", "quiet", "peace", "settled", "present", "breathe", "slow"],
    tone: "encouraging" as const,
  },
  {
    key: "growth",
    keywords: ["better", "progress", "learned", "proud", "showed up", "kept going", "improving"],
    tone: "encouraging" as const,
  },
  {
    key: "outside",
    keywords: ["walk", "outside", "fresh air", "run", "gym", "workout", "hike"],
    tone: "encouraging" as const,
  },
] as const;

const VALUE_GROUPS = [
  { key: "growth", keywords: ["progress", "learned", "improve", "better", "proud"] },
  { key: "connection", keywords: ["family", "friend", "partner", "together", "support"] },
  { key: "calm", keywords: ["calm", "quiet", "rest", "peace", "slow"] },
  { key: "health", keywords: ["sleep", "energy", "walk", "exercise", "outside", "body"] },
];

const ACTION_GROUPS = [
  { key: "walking outside", keywords: ["walk", "outside", "fresh air", "hike"] },
  { key: "moving your body", keywords: ["run", "gym", "workout", "exercise"] },
  { key: "slowing down", keywords: ["breathe", "calm", "quiet", "slow", "present"] },
  { key: "reaching out", keywords: ["friend", "family", "partner", "talked"] },
];

const WIN_GROUPS = [
  { key: "showing up", keywords: ["showed up", "kept going", "did it anyway"] },
  { key: "progress at work", keywords: ["interview", "project", "finished", "completed", "done"] },
  { key: "taking care of yourself", keywords: ["rested", "walk", "outside", "breathe", "slept"] },
];

const STRUGGLE_GROUPS = [
  { key: "sleep has felt difficult", keywords: ["sleep", "slept", "tired", "exhausted", "drained"] },
  { key: "work has been taking a lot of space", keywords: ["work", "job", "meeting", "deadline", "project"] },
  { key: "stress has been building", keywords: ["stress", "pressure", "overwhelmed", "hard", "anxious"] },
];

const SANCTUARY_PROMPTS: Record<string, readonly string[]> = {
  blossom: [
    "What helped you grow today, even quietly?",
    "What part of today deserves a little peace?",
  ],
  twilight: [
    "As the day settles, what would you like to leave behind?",
    "What felt softer by the end of today?",
  ],
  ocean: [
    "What helped you feel steady today?",
    "What came in waves today, and what passed?",
  ],
  forest: [
    "What helped you feel grounded today?",
    "Where did you find a little shelter today?",
  ],
  sunrise: [
    "What felt possible today?",
    "What would you like to begin again tomorrow?",
  ],
  misty: [
    "What became a little clearer today?",
    "What needed patience today?",
  ],
  mountain: [
    "What felt worth the effort today?",
    "What helped you stay steady when the day got steep?",
  ],
  desert: [
    "What helped you protect your energy today?",
    "What felt essential today, and what did not?",
  ],
  snowfall: [
    "What deserves gentleness today?",
    "What felt quiet, still, or simple?",
  ],
  cloud: [
    "What helped you rise above the noise today?",
    "What feels clearer from a little distance?",
  ],
  northern: [
    "What surprised you with a little light today?",
    "What quiet spark stayed with you today?",
  ],
};

type PromptCandidate = PromptSelection & { priority: number };

function daySeed(offset = 0) {
  return Math.floor(Date.now() / 86_400_000) + offset;
}

function rotate<T>(items: readonly T[], seed: number) {
  return items[Math.abs(seed) % items.length];
}

function includesAny(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function timeBucket(dateIso: string): "morning" | "afternoon" | "evening" | "night" {
  const hour = new Date(dateIso).getHours();
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function buildMemoryProfile(
  checkIns: CheckIn[],
  notes: string[] = [],
  sanctuaryTheme = "twilight"
): MemoryProfile {
  const recent = checkIns.slice(0, 20);
  const combinedTexts = recent.map((item) => item.text.toLowerCase());
  const notesText = notes.join(" ").toLowerCase();

  const recurringTopics = TOPIC_GROUPS.map((group) => {
    const count = combinedTexts.filter((text) => includesAny(text, group.keywords)).length + (includesAny(notesText, group.keywords) ? 1 : 0);
    const latestMatch = recent.find((item) => includesAny(item.text.toLowerCase(), group.keywords));
    return count > 0
      ? {
          topic: group.key,
          count,
          lastMentionedAt: latestMatch?.createdAt ?? new Date().toISOString(),
          trend: count >= 3 ? "increasing" : "steady",
          tone: group.tone,
        }
      : null;
  }).filter(Boolean) as MemoryProfile["recurringTopics"];

  const values = VALUE_GROUPS.map((group) => {
    const count = combinedTexts.filter((text) => includesAny(text, group.keywords)).length;
    const latestMatch = recent.find((item) => includesAny(item.text.toLowerCase(), group.keywords));
    return count > 0 ? { label: group.key, count, lastSeenAt: latestMatch?.createdAt ?? new Date().toISOString() } : null;
  }).filter(Boolean) as MemoryProfile["values"];

  const helpfulActions = ACTION_GROUPS.map((group) => {
    const count = combinedTexts.filter((text) => includesAny(text, group.keywords)).length;
    const latestMatch = recent.find((item) => includesAny(item.text.toLowerCase(), group.keywords));
    return count >= 2 ? { label: group.key, count, lastSeenAt: latestMatch?.createdAt ?? new Date().toISOString() } : null;
  }).filter(Boolean) as MemoryProfile["helpfulActions"];

  const recurringStruggles = STRUGGLE_GROUPS.map((group) => {
    const count = combinedTexts.filter((text) => includesAny(text, group.keywords)).length;
    const latestMatch = recent.find((item) => includesAny(item.text.toLowerCase(), group.keywords));
    return count >= 2 ? { label: group.key, count, lastSeenAt: latestMatch?.createdAt ?? new Date().toISOString() } : null;
  }).filter(Boolean) as MemoryProfile["recurringStruggles"];

  const wins = WIN_GROUPS.map((group) => {
    const count = combinedTexts.filter((text) => includesAny(text, group.keywords)).length;
    const latestMatch = recent.find((item) => includesAny(item.text.toLowerCase(), group.keywords));
    return count > 0 ? { label: group.key, count, lastSeenAt: latestMatch?.createdAt ?? new Date().toISOString() } : null;
  }).filter(Boolean) as MemoryProfile["wins"];

  const inputCounts = recent.reduce(
    (acc, item) => {
      acc[item.source === "voice" ? "voice" : "typed"] += 1;
      return acc;
    },
    { voice: 0, typed: 0 }
  );
  const avgLength =
    recent.length > 0 ? recent.reduce((total, item) => total + item.text.trim().split(/\s+/).length, 0) / recent.length : 0;
  const timeCounts = recent.reduce(
    (acc, item) => {
      acc[timeBucket(item.createdAt)] += 1;
      return acc;
    },
    { morning: 0, afternoon: 0, evening: 0, night: 0 }
  );
  const preferredTimeOfDay = (Object.entries(timeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "evening") as MemoryProfile["reflectionStyle"]["preferredTimeOfDay"];

  const promptFlavor =
    sanctuaryTheme === "twilight" || sanctuaryTheme === "snowfall"
      ? "peaceful_growth"
      : sanctuaryTheme === "forest" || sanctuaryTheme === "mountain"
        ? "grounded_progress"
        : "gentle_reflection";

  const summaryLines = [
    recurringTopics[0]
      ? `${capitalize(recurringTopics[0].topic)} has appeared a few times.`
      : "Patterns are still forming.",
    recurringStruggles[0]
      ? `${capitalize(recurringStruggles[0].label)}.`
      : "Tranqly is still learning what weighs on you.",
    helpfulActions[0]
      ? `${capitalize(helpfulActions[0].label)} seems to help.`
      : "Helpful routines will become clearer over time.",
    `You reflect most often in the ${preferredTimeOfDay}.`,
  ];

  return {
    recurringTopics,
    values,
    helpfulActions,
    recurringStruggles,
    wins,
    reflectionStyle: {
      preferredTimeOfDay,
      preferredInput:
        inputCounts.voice > inputCounts.typed ? "voice" : inputCounts.typed > inputCounts.voice ? "typed" : "mixed",
      typicalLength: avgLength < 18 ? "short" : avgLength < 45 ? "medium" : "long",
      tonePreference: "gentle",
    },
    sanctuaryStyle: {
      currentTheme: sanctuaryTheme,
      promptFlavor,
    },
    summaryLines,
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function recentPromptTypes(checkIns: CheckIn[]) {
  return checkIns
    .slice(0, 10)
    .map((item) => item.promptType)
    .filter((value): value is string => Boolean(value));
}

function wasPromptUsedRecently(checkIns: CheckIn[], prompt: string, days = 30) {
  const cutoff = Date.now() - days * 86_400_000;
  return checkIns.some((item) => item.prompt === prompt && new Date(item.createdAt).getTime() >= cutoff);
}

function candidateAllowed(candidate: PromptCandidate, checkIns: CheckIn[]) {
  const recentTypes = recentPromptTypes(checkIns).slice(0, 7);
  if (wasPromptUsedRecently(checkIns, candidate.prompt, 30)) return false;
  if (recentTypes.includes(candidate.promptType)) return false;
  return true;
}

function withFallback(candidate: PromptCandidate, checkIns: CheckIn[]) {
  return candidateAllowed(candidate, checkIns) ? candidate : null;
}

export function selectDailyPrompt({
  checkIns,
  notes = [],
  sanctuaryTheme = "twilight",
  mood,
  streak = 0,
  offset = 0,
}: {
  checkIns: CheckIn[];
  notes?: string[];
  sanctuaryTheme?: string;
  mood?: string | null;
  streak?: number;
  offset?: number;
}): PromptSelection {
  const memory = buildMemoryProfile(checkIns, notes, sanctuaryTheme);
  const seed = daySeed(offset) + checkIns.length + streak;
  const latest = checkIns[0]?.text.toLowerCase() ?? "";
  const yesterday = checkIns[1]?.text.toLowerCase() ?? "";
  const candidates: PromptCandidate[] = [];

  const hasDistress =
    /(panic|hopeless|can't do this|can’t do this|breaking|done with everything|numb)/.test(latest) ||
    mood === "rough";
  if (hasDistress) {
    candidates.push({
      prompt: rotate(
        [
          "What deserves a little kindness right now?",
          "What would make tonight feel a little lighter?",
          "What's one small thing you can let be enough today?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking gently because today sounds heavier than usual.",
      promptType: "gentle_reset",
      memoryUsed: ["recent_tone"],
      confidence: 0.88,
      priority: 1,
    });
  }

  const topStruggle = memory.recurringStruggles[0];
  if (topStruggle?.label.includes("sleep")) {
    candidates.push({
      prompt: rotate(
        [
          "Rest has been showing up a lot lately. What did your body seem to need today?",
          "Sleep and energy have been linked in your reflections. What gave you energy today, even a little?",
          "What did your energy seem to be asking for today?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because rest and energy have been showing up together.",
      promptType: "energy_prompt",
      memoryUsed: ["sleep", "energy"],
      confidence: 0.82,
      priority: 2,
    });
  }

  const topTopic = memory.recurringTopics[0];
  if (topTopic?.topic === "work") {
    candidates.push({
      prompt: rotate(
        [
          "Work has been taking a lot of space lately. Did today feel lighter, heavier, or just different?",
          "Work has been close to the surface lately. What part of today stayed with you most?",
          "What changed for you today around work, pressure, or pace?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because work has taken a lot of space in your reflections.",
      promptType: "recurring_pattern",
      memoryUsed: ["work"],
      confidence: 0.84,
      priority: 3,
    });
  }
  if (topTopic?.topic === "stress") {
    candidates.push({
      prompt: rotate(
        [
          "You've been carrying a lot lately. What helped you get through today?",
          "Pressure has been building in your recent reflections. What helped you feel a little steadier today?",
          "What took the most out of you today, and what gave a little back?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because your recent check-ins have felt heavier.",
      promptType: "recurring_pattern",
      memoryUsed: ["stress"],
      confidence: 0.83,
      priority: 3,
    });
  }

  const topAction = memory.helpfulActions[0];
  if (topAction) {
    candidates.push({
      prompt: rotate(
        [
          "Did you get a chance to do something that usually clears your head?",
          "What helped you feel a little more steady today?",
          "Did anything support you more than you expected today?",
        ],
        seed
      ),
      whyThisQuestion: `I'm asking because ${topAction.label} seems to help.`,
      promptType: "helpful_action",
      memoryUsed: [topAction.label],
      confidence: 0.78,
      priority: 4,
    });
  }

  const topValue = memory.values[0];
  if (topValue) {
    candidates.push({
      prompt: rotate(
        [
          "What mattered most to you today?",
          "Where did you feel most like yourself today?",
          "What felt worth protecting your time or energy for today?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because what matters to you is becoming clearer.",
      promptType: "values_prompt",
      memoryUsed: [topValue.label],
      confidence: 0.74,
      priority: 5,
    });
  }

  if (checkIns.length >= 2 && latest && yesterday && latest !== yesterday) {
    candidates.push({
      prompt: rotate(
        [
          "Did today feel lighter or heavier than yesterday?",
          "What felt different about today?",
          "What surprised you about your mood or energy today?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because your recent days have not all felt the same.",
      promptType: "contrast_prompt",
      memoryUsed: ["recent_change"],
      confidence: 0.72,
      priority: 6,
    });
  }

  const topWin = memory.wins[0];
  if (topWin) {
    candidates.push({
      prompt: rotate(
        [
          "What are you quietly proud of today?",
          "What did you show up for today?",
          "What went a little better than you expected today?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because you've been showing up, even on uneven days.",
      promptType: "win_prompt",
      memoryUsed: [topWin.label],
      confidence: 0.7,
      priority: 7,
    });
  }

  const sanctuaryOptions = SANCTUARY_PROMPTS[sanctuaryTheme] ?? SANCTUARY_PROMPTS.twilight;
  candidates.push({
    prompt: rotate([...sanctuaryOptions], seed),
    whyThisQuestion: "I'm asking because this sanctuary is about slowing down and noticing what's growing.",
    promptType: "sanctuary_prompt",
    memoryUsed: [sanctuaryTheme],
    confidence: 0.62,
    priority: 8,
  });

  candidates.push({
    prompt: DAILY_PROMPTS[(daySeed(offset) + offset) % DAILY_PROMPTS.length],
    whyThisQuestion: "I'm asking to help you notice one honest part of today.",
    promptType: "generic_fallback",
    memoryUsed: [],
    confidence: 0.4,
    priority: 9,
  });

  const selected =
    candidates
      .sort((a, b) => a.priority - b.priority)
      .map((candidate) => withFallback(candidate, checkIns))
      .find(Boolean) ??
    candidates[candidates.length - 1];

  return {
    prompt: selected.prompt,
    whyThisQuestion: selected.whyThisQuestion,
    promptType: selected.promptType,
    memoryUsed: selected.memoryUsed,
    confidence: selected.confidence,
  };
}

export function promptForToday(checkIns: CheckIn[], notes: string[] = [], offset = 0) {
  return selectDailyPrompt({ checkIns, notes, offset }).prompt;
}
