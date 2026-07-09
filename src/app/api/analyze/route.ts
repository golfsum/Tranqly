import { NextRequest, NextResponse } from "next/server";
import { logAiUsage } from "@/lib/aiUsage";
import { groqJsonChatWithUsage, modelForFeature } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Premium "Deeper insight", a pattern-level reflection across the user's
 * recent check-ins and moods, in the same warm coaching voice.
 */
interface AnalyzePayload {
  name?: string;
  streak: number;
  totalEntries: number;
  recentEntries: { text: string; dateKey: string }[];
  recentMoods: { dateKey: string; mood: string }[];
  userId?: string;
  userPlan?: "free" | "plus";
}

const INSIGHT_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "Gentle, uplifting 4-8 word headline about their pattern",
    },
    insight: {
      type: "string",
      description:
        "3-4 sentences of warm pattern-level observation across their reflections and moods. Reference specific entries. Find the thread they might not see themselves.",
    },
    suggestion: {
      type: "string",
      description:
        "One gentle, realistic experiment for the coming week (under 30 words)",
    },
    affirmation: {
      type: "string",
      description: "One sentence of genuine, non-cheesy encouragement",
    },
    pattern: { type: "string" },
    recurring_themes: { type: "array", items: { type: "string" } },
    mood_trend: { type: "string" },
    next_focus: { type: "string" },
    confidence: { type: "number" },
    safety_flags: { type: "array", items: { type: "string" } },
  },
  required: [
    "headline",
    "insight",
    "pattern",
    "suggestion",
    "affirmation",
    "recurring_themes",
    "mood_trend",
    "next_focus",
    "confidence",
    "safety_flags",
  ],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT =
  "You are Tranqly, a calm reflection companion that helps users notice patterns over time.\n\n" +
  "Look across the user's recent reflections and moods. Surface gentle patterns the user may not see up close. " +
  "Be honest, but never harsh. Be warm, but do not force positivity. Acknowledge effort when it is actually present. " +
  "If something looks difficult, name it softly. Do not diagnose. Do not overclaim. Do not use clinical language. " +
  "Do not say the user has anxiety, depression, burnout, trauma, or any mental health condition. " +
  "Use soft language like seems, may, might, and could.\n\n" +
  "Write like a caring friend who has been paying attention. Never use em dashes or semicolons. " +
  "No bullet points. No emoji. Keep the response short and useful. End with one realistic next step the user can try this week.";

export async function POST(req: NextRequest) {
  let payload: AnalyzePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ fallback: true }, { status: 200 });
  }

  const entriesText = (payload.recentEntries ?? [])
    .slice(0, 40)
    .map((e) => `- [${e.dateKey}] ${e.text}`)
    .join("\n");
  const moodsText = (payload.recentMoods ?? [])
    .slice(0, 14)
    .map((m) => `- ${m.dateKey}: ${m.mood}`)
    .join("\n");

  try {
    const { parsed, usage } = await groqJsonChatWithUsage<{
      headline: string;
      insight: string;
      pattern: string;
      suggestion: string;
      affirmation: string;
      recurring_themes: string[];
      mood_trend: string;
      next_focus: string;
      confidence: number;
      safety_flags: string[];
    }>({
      maxTokens: 1024,
      feature: "weekly_summary",
      userPlan: payload.userPlan ?? "plus",
      schema: { name: "deep_insight", schema: INSIGHT_SCHEMA },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `User: ${payload.name || "friend"}\n` +
            `Check-in streak: ${payload.streak} day(s)\n` +
            `Total reflections: ${payload.totalEntries}\n\n` +
            `Recent reflections:\n${entriesText || "(none yet)"}\n\n` +
            `Recent moods:\n${moodsText || "(none logged)"}\n\n` +
            "Write their deeper insight for this week.",
        },
      ],
    });
    await logAiUsage({
      ...usage,
      uid: payload.userId,
      status: "success",
    });
    return NextResponse.json({ ...parsed, source: "ai" });
  } catch (err) {
    console.error("Deep insight failed:", err);
    await logAiUsage({
      model: modelForFeature("weekly_summary", payload.userPlan ?? "plus"),
      fallbackModelsTried: [],
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      feature: "weekly_summary",
      userPlan: payload.userPlan ?? "plus",
      uid: payload.userId,
      status: "error",
      errorCode: err instanceof Error ? err.message.slice(0, 120) : "weekly_failed",
    });
    return NextResponse.json({ fallback: true }, { status: 200 });
  }
}
