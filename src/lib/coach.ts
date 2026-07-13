import { CoachReply, DeepInsight, Mood } from "./types";

/**
 * Local fallback coach, used when GROQ_API_KEY isn't configured or the
 * API call fails, so every check-in still gets a warm response. Same voice
 * as the AI: acknowledge effort, positive angle, one gentle step. Written
 * to sound like a caring human, no em dashes, no corporate polish.
 */
export function localCoachReply(entry: string, streak: number): CoachReply {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  const lower = entry.toLowerCase();
  const struggled = /(tired|fail|didn'?t|couldn'?t|hard|stress|bad|nothing|lazy|skip)/.test(
    lower
  );

  const openers = struggled
    ? [
        "Thank you for being honest about a hard day. That takes real courage, way more than pretending everything's fine.",
        "You showed up to reflect on a tough day, and honestly, that's its own quiet win. Most people just scroll past days like this.",
        "Rough days are information, not a verdict on you. You noticed it, you named it, and that's how things start to shift.",
      ]
    : [
        "Look at that. You did the thing, and then you took a moment to notice it. That's the whole practice right there.",
        "I love that you captured this. Little moments like these are what momentum is actually made of.",
        "That's real effort, and it counts. Writing it down makes it twice as real.",
      ];

  const streakLine =
    streak >= 7
      ? ` And ${streak} days of showing up in a row? You're building something that lasts.`
      : streak >= 2
      ? ` That's ${streak} days in a row of checking in. The habit is taking root.`
      : "";

  const nextSteps = struggled
    ? [
        "Tonight, just pick one tiny thing for tomorrow. Something two minutes small. Gentle beats grand.",
        "Before bed, take three slow breaths and let today be done. Tomorrow gets a fresh page.",
        "Tomorrow, aim for one small kindness toward yourself. A walk, a glass of water, a real break.",
      ]
    : [
        "Tomorrow, try doing the same thing five minutes earlier. Early wins tend to snowball.",
        "Pick tonight what tomorrow's first small win will be. Deciding ahead makes it almost automatic.",
        "Maybe tell one person about this. Sharing progress quietly doubles it.",
      ];

  const sleepRelated = /sleep|slept|tired|rest/.test(lower);
  const workRelated = /work|job|meeting|deadline|interview/.test(lower);
  const connectionRelated = /family|friend|partner|fianc|sister|brother/.test(lower);
  const title = sleepRelated ? "Rest shaped the day" : workRelated ? "Making space around work" : connectionRelated ? "Connection mattered today" : struggled ? "A demanding day, noticed clearly" : "A moment worth keeping";
  const preview = sleepRelated
    ? "Your energy today may make more sense when viewed alongside the rest you had available."
    : workRelated
      ? "The important detail may be how you made room for yourself while work was asking for your attention."
      : connectionRelated
        ? "A moment of connection seems to have changed the shape of the day."
        : "One detail from today may be more meaningful than it first appeared.";

  return {
    title,
    preview,
    nudgeLabel: struggled ? "A Little Reassurance" : "Something to Notice",
    message: pick(openers) + streakLine,
    pattern: undefined,
    nextStep: pick(nextSteps),
    summary: entry.slice(0, 140),
    themes: struggled ? ["challenge", "self-awareness"] : ["progress", "consistency"],
    tags: struggled ? ["hard day"] : ["daily check-in"],
    emotionalTone: struggled ? "heavy but reflective" : "steady and reflective",
    followUpQuestions: ["What felt most important about this today?"],
    source: "local",
    createdAt: new Date().toISOString(),
  };
}

/** Local fallback for the premium "deeper insight" analysis. */
export function localDeepInsight(
  entries: { text: string; dateKey: string }[],
  moods: Record<string, Mood>,
  streak: number
): DeepInsight {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  let insight: string;
  if (streak >= 7) {
    insight = `You've reflected ${streak} days in a row. That kind of consistency is rare, and it's exactly how self-awareness compounds. Your entries show someone who keeps showing up no matter how the day went.`;
  } else if (entries.length > 3) {
    insight = `Across your ${entries.length} recent check-ins there's a clear thread: you keep coming back. The days differ, the effort doesn't. That's the foundation everything else gets built on.`;
  } else {
    insight =
      "You're at the very beginning, which is honestly the best place to notice things. The first few reflections teach you more about your patterns than months of autopilot.";
  }

  return {
    headline: pick([
      "You keep showing up",
      "Quiet consistency, real growth",
      "The pattern is you",
    ]),
    insight,
    suggestion: pick([
      "Try checking in at the same time each evening. Anchoring it to an existing habit makes it effortless.",
      "This week, add one line about how you felt, not just what you did. Feelings are where the patterns hide.",
      "Re-read last week's entries once. Seeing your own progress in your own words is powerful fuel.",
    ]),
    affirmation: pick([
      "You're allowed to grow at your own pace.",
      "Every reflection is proof you haven't given up on yourself.",
      "Progress that feels slow is still progress.",
    ]),
    source: "local",
    createdAt: new Date().toISOString(),
  };
}
