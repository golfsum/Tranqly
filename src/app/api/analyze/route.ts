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
  recentEntries: { text: string; dateKey: string; prompt?: string; dailyInsight?: string }[];
  recentMoods: { dateKey: string; mood: string }[];
  periodStart?: string;
  periodEnd?: string;
  reflectionDays?: number;
  previousWeeklyThemes?: string[];
  responseStylePreference?: string;
  reflectionGoal?: string;
  memoryEnabled?: boolean;
  userId?: string;
  userPlan?: "free" | "plus";
}

const INSIGHT_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "Short personalized weekly reflection title",
    },
    insight: {
      type: "string",
      description:
        "Two to four short paragraphs that connect the week with evidence-aware language",
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
    gentleFocusTitle: { type: "string" },
    evidenceLevel: { type: "string", enum: ["limited", "emerging", "meaningful", "strong"] },
    completionMessage: { type: "string" },
    reflectionDays: { type: "number" },
    reflectionCount: { type: "number" },
    rewardUnlocked: { type: "boolean" },
    rewardId: { type: "string" },
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
    "gentleFocusTitle",
    "evidenceLevel",
    "completionMessage",
    "reflectionDays",
    "reflectionCount",
    "rewardUnlocked",
    "rewardId",
    "recurring_themes",
    "mood_trend",
    "next_focus",
    "confidence",
    "safety_flags",
  ],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT =
  "You are Tranqly, a warm and thoughtful reflection companion.\n\n" +
  "Create a weekly reflection from the user's reflections from the past seven-day period. Help the user feel understood, notice meaningful themes, and leave with one gentle focus for next week.\n\n" +
  "Important rules:\n" +
  "Never shame the user for days they did not reflect. Never call the week incomplete, failed, inconsistent, insufficient, or broken. A few honest reflections can still be meaningful. Do not invent recurring patterns when evidence is limited. Match confidence to the amount of evidence. Do not diagnose, label, or make clinical claims. Do not claim to know what the user truly feels beyond what they shared. Avoid negative or judgmental language. Do not use em dashes, semicolons, emoji, bullet points, or the phrase thanks for sharing. Refer to concrete details from the user's reflections when safe and relevant. Keep it concise enough to read comfortably on a phone.\n\n" +
  "Language confidence rules:\n" +
  "For 1 reflection, use language like one moment stood out, what you shared offers a glimpse, or there may not be a full pattern yet. For 2 to 3 reflection days, use language like a small thread appeared, you returned more than once to, or there may be an early pattern around. For 4 to 6 reflection days, use language like across several reflections or a recurring theme seemed to be. For 7 reflection days, you may use across your week, a clear thread appeared, or you repeatedly noticed. Do not say clear pattern unless the data strongly supports it.";

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
    .slice(0, 14)
    .map((e) => `[${e.dateKey}]\nPrompt: ${e.prompt || "Not recorded"}\nReflection: ${e.text}\nDaily insight: ${e.dailyInsight || "Not recorded"}`)
    .join("\n");
  const moodsText = (payload.recentMoods ?? [])
    .slice(0, 14)
    .map((m) => `- ${m.dateKey}: ${m.mood}`)
    .join("\n");

  try {
    const reflectionCount = payload.recentEntries?.length ?? 0;
    const reflectionDays = payload.reflectionDays ?? new Set((payload.recentEntries ?? []).map((entry) => entry.dateKey)).size;
    const { parsed, usage } = await groqJsonChatWithUsage<{
      headline: string;
      insight: string;
      pattern: string;
      suggestion: string;
      affirmation: string;
      gentleFocusTitle: string;
      evidenceLevel: "limited" | "emerging" | "meaningful" | "strong";
      completionMessage: string;
      reflectionDays: number;
      reflectionCount: number;
      rewardUnlocked: boolean;
      rewardId: string;
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
            `Weekly period: ${payload.periodStart || "unknown"} to ${payload.periodEnd || "unknown"}\n` +
            `Reflection days this week: ${reflectionDays} out of 7\n` +
            `Reflection count this week: ${reflectionCount}\n` +
            `Total reflections: ${payload.totalEntries}\n` +
            `Preferred support style: ${payload.responseStylePreference || "warm and direct"}\n` +
            `Reflection goal: ${payload.reflectionGoal || "understand patterns over time"}\n\n` +
            `Reflections:\n${entriesText || "No reflections were shared this week."}\n\n` +
            `Moods:\n${moodsText || "None logged"}\n\n` +
            `Previous weekly themes:\n${payload.memoryEnabled === false ? "Memory disabled" : (payload.previousWeeklyThemes ?? []).join(", ") || "None"}\n\n` +
            "Create this user's weekly reflection when there are at least 3 reflection days. Do not treat days without reflections as a problem. If there are fewer than 3 reflection days, avoid claiming a weekly pattern. Sanctuary rewards are handled separately from weekly reflections, so always set rewardUnlocked to false and rewardId to none.",
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
