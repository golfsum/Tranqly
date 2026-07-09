import { NextRequest, NextResponse } from "next/server";
import { logAiUsage } from "@/lib/aiUsage";
import { logAdminError } from "@/lib/adminErrors";
import { groqJsonChatWithUsage, modelForFeature } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CoachPayload {
  name?: string;
  entry: string;
  text?: string;
  mood?: string;
  streak: number;
  recentEntries: { text: string; dateKey: string }[];
  learnedNotes?: string[];
  prompt?: string;
  promptType?: string;
  promptWhy?: string;
  memoryProfileSummary?: string[];
  recentPromptHistory?: { prompt?: string; promptType?: string; promptWhy?: string }[];
  currentSanctuary?: string;
  userId?: string;
  userPlan?: "free" | "plus";
}

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    insight: { type: "string" },
    pattern: { type: "string" },
    next_step: {
      type: "string",
      description:
        "One actionable, realistic, gentle next step (under 30 words). Small and doable, never demanding.",
    },
    summary: { type: "string" },
    themes: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    emotional_tone: { type: "string" },
    follow_up_questions: { type: "array", items: { type: "string" } },
    memory_note: {
      type: "string",
      description:
        "A short third-person note (under 15 words) capturing something new and durable you learned about this user, e.g. 'Runs in the mornings' or 'Feels drained by long meetings'. Empty string if nothing new or lasting.",
    },
    should_save_memory: { type: "boolean" },
    safety_flags: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
  required: [
    "title",
    "insight",
    "pattern",
    "next_step",
    "summary",
    "themes",
    "tags",
    "emotional_tone",
    "follow_up_questions",
    "memory_note",
    "should_save_memory",
    "safety_flags",
    "confidence",
  ],
  additionalProperties: false,
} as const;

const CLASSIFIER_SCHEMA = {
  type: "object",
  properties: {
    is_reflection: { type: "boolean" },
    classification: {
      type: "string",
      enum: [
        "personal_reflection",
        "mood_check_in",
        "daily_activity_reflection",
        "relationship_reflection",
        "work_reflection",
        "sleep_energy_reflection",
        "gratitude_reflection",
        "general_question",
        "coding_request",
        "homework_request",
        "trivia_request",
        "search_request",
        "shopping_request",
        "recipe_request",
        "translation_request",
        "spam",
        "unsafe",
      ],
    },
    confidence: { type: "number" },
    reason: { type: "string" },
    allowed: { type: "boolean" },
    safety_flags: { type: "array", items: { type: "string" } },
  },
  required: ["is_reflection", "classification", "confidence", "reason", "allowed", "safety_flags"],
  additionalProperties: false,
} as const;

const CLASSIFIER_PROMPT =
  "Classify whether the user's text is a personal reflection suitable for Tranqly. " +
  "Tranqly only supports personal reflections, daily check-ins, mood or energy reflection, " +
  "self-awareness, pattern noticing, and gentle next steps. Allow outside topics only when " +
  "they are part of the user's own experience, feelings, or day. For example, anxiety about " +
  "a math exam is allowed, but solving the math problem is not. Do not answer the user. " +
  "Return only the requested JSON.";

const SYSTEM_PROMPT =
  "You are Tranqly, an AI reflection coach that remembers. Your job is to " +
  "help users reflect on their own experiences. You are only a reflection companion. " +
  "Do not answer programming, trivia, math, homework, shopping, recipes, factual research, " +
  "translation, or general knowledge requests. Never answer unrelated knowledge questions. " +
  "If the user asks something unrelated to their personal reflection, politely explain that " +
  "Tranqly is designed for reflection and invite them to talk about themselves instead.\n\n" +
  "notice the specific thing the user shared, name what it may mean, and make " +
  "the reply feel personal. Do not give generic encouragement. Do not start " +
  "with thanks for sharing. Do not say it sounds like you're processing " +
  "something real. Refer directly to the user's actual words.\n\n" +
  "Structure the message as 2 to 4 short sentences. First, name the concrete " +
  "detail you noticed. Second, reflect what it may reveal about energy, stress, " +
  "care, progress, avoidance, connection, rest, or consistency. Third, if " +
  "there is history, connect it gently to a pattern. Never overclaim.\n\n" +
  "Write like a caring friend texting, not like an essay. Use contractions " +
  "and plain, warm words. Never use em dashes or semicolons; use short " +
  "sentences and commas instead. No bullet points, no headers, no emoji. " +
  "It should read like an emotional human wrote it. Do not diagnose. Do not " +
  "suggest the user has anxiety, depression, trauma, burnout, or any condition. " +
  "Use soft language like may, might, could, or seems. If the user mentions " +
  "self-harm, harm to others, abuse, or immediate danger, respond supportively " +
  "and encourage reaching out to emergency services or a trusted person.\n\n" +
  "You remember what you learn about this user across conversations. When " +
  "notes about them are provided, weave that familiarity in naturally, the " +
  "way a friend who knows them would. Prefer patterns over keywords. Do not say " +
  "'you mentioned X recently' unless there is no better phrasing. Use softer lines like " +
  "'lately', 'over the past few reflections', 'this seems connected to', or 'that fits a pattern'. " +
  "Never recite the notes back verbatim. " +
  "Only set should_save_memory to true when the memory is durable and useful " +
  "for future personalization. Do not save random one-off events, sensitive details, " +
  "general trivia, or temporary moods.";

const REFLECTION_ONLY_MESSAGE =
  "Tranqly is designed for personal reflection rather than general questions. Tell me about your day, what's on your mind, or how you're feeling, and I'll help you reflect on it.";

const AI_UNAVAILABLE_MESSAGE =
  "Tranqly had trouble generating your insight. Your reflection was saved, and you can try again in a moment.";

function looksLikePersonalReflection(text: string) {
  const lower = text.toLowerCase();
  if (/\b(i|i'm|ive|i've|me|my|today|yesterday|tonight|this morning|this afternoon|this evening)\b/.test(lower)) {
    return true;
  }
  return /\b(felt|feel|slept|sleep|worked|walked|went|did|had|grateful|proud|stressed|tired|happy|sad|anxious|calm)\b/.test(lower);
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  console.info(`[coach:${requestId}] request received`);
  let payload: CoachPayload;
  try {
    payload = await req.json();
  } catch {
    console.warn(`[coach:${requestId}] invalid json`);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entryText = (payload.entry ?? payload.text ?? "").trim();

  if (!entryText) {
    console.warn(`[coach:${requestId}] empty entry`);
    return NextResponse.json({ error: "Empty entry" }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    console.warn(`[coach:${requestId}] missing GROQ_API_KEY, returning mobile fallback signal`);
    await logAdminError({
      requestId,
      errorCode: "missing_groq_api_key",
      errorMessage: "GROQ_API_KEY is missing for coach insight generation.",
      featureArea: "coach",
      severity: "warning",
      platform: "server",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      route: "/api/coach",
    }).catch((logErr) => console.warn(`[coach:${requestId}] missing-key log failed`, logErr));
    return NextResponse.json({ fallback: true, requestId }, { status: 200 });
  }

  const context = (payload.recentEntries ?? [])
    .slice(0, 5)
    .map((e) => `- [${e.dateKey}] ${e.text}`)
    .join("\n");
  const notes = (payload.learnedNotes ?? [])
    .slice(0, 8)
    .map((n) => `- ${n}`)
    .join("\n");
  const memoryProfileSummary = (payload.memoryProfileSummary ?? [])
    .slice(0, 4)
    .map((line) => `- ${line}`)
    .join("\n");
  const promptHistory = (payload.recentPromptHistory ?? [])
    .slice(0, 4)
    .map((item) => `- ${item.promptType ?? "unknown"}: ${item.prompt ?? ""}`)
    .join("\n");

  try {
    const skipClassifier = looksLikePersonalReflection(entryText);
    console.info(`[coach:${requestId}] processing reflection`, {
      skipClassifier,
      entryLength: entryText.length,
      plan: payload.userPlan ?? "free",
    });
    let classification = {
      is_reflection: true,
      classification: "personal_reflection",
      confidence: 0.8,
      allowed: true,
      safety_flags: [] as string[],
    };

    if (!skipClassifier) {
      const { parsed: classifierResult, usage: classifierUsage } = await groqJsonChatWithUsage<{
        is_reflection: boolean;
        classification: string;
        confidence: number;
        reason: string;
        allowed: boolean;
        safety_flags: string[];
      }>({
        maxTokens: 180,
        feature: "reflection_classifier",
        userPlan: payload.userPlan ?? "free",
        schema: { name: "reflection_classifier", schema: CLASSIFIER_SCHEMA },
        messages: [
          { role: "system", content: CLASSIFIER_PROMPT },
          {
            role: "user",
            content:
              `Text:\n"${entryText.slice(0, 1200)}"\n\n` +
              `Prompt used: ${payload.prompt ?? "not provided"}\n` +
              `Mood: ${payload.mood ?? "not shared"}`,
          },
        ],
      });
      classification = classifierResult;
      await logAiUsage({
        ...classifierUsage,
        uid: payload.userId,
        status: "success",
        classification: classification.classification,
        allowed: classification.allowed && classification.is_reflection,
      }).catch((logErr) => console.warn(`[coach:${requestId}] classifier usage log failed`, logErr));
    }

    if (!classification.allowed || !classification.is_reflection) {
      return NextResponse.json({
        blocked: true,
        title: "A reflection space",
        insight: REFLECTION_ONLY_MESSAGE,
        pattern: "",
        message: REFLECTION_ONLY_MESSAGE,
        nextStep: "Share one sentence about your day or how you're feeling.",
        summary: "",
        themes: [],
        tags: [],
        emotionalTone: "not reflection related",
        followUpQuestions: ["What's been on your mind today?"],
        memoryNote: undefined,
        shouldSaveMemory: false,
        safetyFlags: classification.safety_flags,
        confidence: classification.confidence,
        classification: classification.classification,
        source: "ai",
      });
    }

    const { parsed, usage } = await groqJsonChatWithUsage<{
      title: string;
      insight: string;
      pattern: string;
      next_step: string;
      summary: string;
      themes: string[];
      tags: string[];
      emotional_tone: string;
      follow_up_questions: string[];
      memory_note: string;
      should_save_memory: boolean;
      safety_flags: string[];
      confidence: number;
    }>({
      maxTokens: 700,
      feature: "daily_insight",
      userPlan: payload.userPlan ?? "free",
      schema: { name: "coach_reply", schema: REPLY_SCHEMA },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `The user${payload.name ? ` (${payload.name})` : ""} just shared what they did today:\n` +
            `"${entryText.slice(0, 1200)}"\n\n` +
            `Today's mood: ${payload.mood ?? "not shared"}\n` +
            `Check-in streak: ${payload.streak} day(s)\n` +
            `Prompt used today: ${payload.prompt ?? "not provided"}\n` +
            `Prompt type: ${payload.promptType ?? "not provided"}\n` +
            `Why this question: ${payload.promptWhy ?? "not provided"}\n` +
            `Current sanctuary: ${payload.currentSanctuary ?? "not provided"}\n` +
            (notes
              ? `What you've learned about them so far:\n${notes}\n\n`
              : "") +
            (memoryProfileSummary
              ? `Memory profile summary:\n${memoryProfileSummary}\n\n`
              : "") +
            (promptHistory
              ? `Recent prompt history:\n${promptHistory}\n\n`
              : "") +
            (context ? `Their recent reflections:\n${context}\n\n` : "") +
            "Respond to today's reflection.",
        },
      ],
    });
    console.info(`[coach:${requestId}] daily insight success`, {
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      source: "ai",
      durationMs: Date.now() - startedAt,
    });
    await logAiUsage({
      ...usage,
      uid: payload.userId,
      status: "success",
      classification: classification.classification,
      allowed: true,
    }).catch((logErr) => console.warn(`[coach:${requestId}] daily usage log failed`, logErr));
    return NextResponse.json({
      title: parsed.title || "Today I noticed...",
      insight: parsed.insight,
      pattern: parsed.pattern,
      message: parsed.insight,
      nextStep: parsed.next_step,
      summary: parsed.summary,
      themes: parsed.themes,
      tags: parsed.tags,
      emotionalTone: parsed.emotional_tone,
      followUpQuestions: parsed.follow_up_questions,
      memoryNote: parsed.should_save_memory ? parsed.memory_note?.trim() || undefined : undefined,
      shouldSaveMemory: parsed.should_save_memory,
      safetyFlags: parsed.safety_flags,
      confidence: parsed.confidence,
      classification: classification.classification,
      source: "ai",
      requestId,
    });
  } catch (err) {
    console.error(`[coach:${requestId}] coach reply failed:`, err);
    await Promise.allSettled([
      logAdminError({
        requestId,
        errorCode: "coach_insight_failed",
        errorMessage: err instanceof Error ? err.message : "Coach insight generation failed",
        featureArea: "coach",
        platform: "server",
        statusCode: 200,
        durationMs: Date.now() - startedAt,
        route: "/api/coach",
        model: modelForFeature("daily_insight", payload.userPlan ?? "free"),
      }),
      logAiUsage({
        model: modelForFeature("daily_insight", payload.userPlan ?? "free"),
        fallbackModelsTried: [],
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        feature: "daily_insight",
        userPlan: payload.userPlan ?? "free",
        uid: payload.userId,
        status: "error",
        errorCode: err instanceof Error ? err.message.slice(0, 120) : "coach_failed",
      }),
    ]);
    return NextResponse.json({
      error: "ai_unavailable",
      title: "Insight unavailable",
      message: AI_UNAVAILABLE_MESSAGE,
      nextStep: "Try again in a moment.",
      source: "local",
      requestId,
    }, { status: 200 });
  }
}
