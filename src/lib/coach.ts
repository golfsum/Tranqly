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

  const reflectionDays = new Set(entries.map((entry) => entry.dateKey)).size;
  let insight: string;
  let evidenceLevel: DeepInsight["evidenceLevel"] = "limited";
  let completionMessage = "One honest moment can still give you something meaningful to return to.";
  if (reflectionDays >= 7) {
    evidenceLevel = "strong";
    completionMessage = "You made space to reflect every day this week.";
    insight = "Across your week, a clear thread appeared around showing up and noticing what mattered. The days may have looked different, but you kept giving yourself a place to name what was happening. That kind of attention can make patterns easier to see over time.";
  } else if (reflectionDays >= 3) {
    evidenceLevel = "meaningful";
    completionMessage = `You checked in on ${reflectionDays} days this week, and those moments gave Tranqly something meaningful to reflect on.`;
    insight = `Across several reflections, a recurring theme seemed to be your willingness to pause instead of letting the week blur together. What you shared points toward a useful starting place: the more specific your check-ins are, the easier it becomes to notice what helps.`;
  } else if (reflectionDays >= 2) {
    evidenceLevel = "emerging";
    completionMessage = `${reflectionDays} honest check-ins were enough to reveal a meaningful starting point.`;
    insight = "A small thread appeared in what you shared this week. There may not be a full pattern yet, but the fact that you returned more than once gives Tranqly a better glimpse into what stayed with you.";
  } else if (reflectionDays === 1) {
    insight = "One moment stood out from your week. It may not show a full pattern yet, but it gives a clear glimpse into what was asking for your attention. That is still worth keeping.";
  } else {
    insight =
      "You did not share a reflection this week, so there is not a personal pattern to bring together yet. Your space is still here whenever you feel ready to return.";
    completionMessage = "There is no perfect way to reflect. You can return whenever it feels useful.";
  }

  return {
    headline: pick([
      "You keep showing up",
      "Quiet consistency, real growth",
      "The pattern is you",
    ]),
    insight,
    suggestion: pick([
      "Choose one small pause you can protect this week, even if it is only a few quiet minutes.",
      "This week, add one line about how it felt, not just what happened.",
      "Notice one moment this week where you feel a little more settled, supported, or clear.",
    ]),
    affirmation: pick([
      "You're allowed to grow at your own pace.",
      "Every reflection is proof you haven't given up on yourself.",
      "Progress that feels slow is still progress.",
    ]),
    source: "local",
    createdAt: new Date().toISOString(),
    gentleFocusTitle: "Next gentle focus",
    evidenceLevel,
    completionMessage,
    reflectionDays,
    reflectionCount: entries.length,
    rewardUnlocked: false,
    rewardId: "none",
  };
}
