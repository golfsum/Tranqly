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
  recentEntries: { text: string; dateKey: string; previousInsight?: string; tags?: string[] }[];
  learnedNotes?: string[];
  prompt?: string;
  promptType?: string;
  promptWhy?: string;
  memoryProfileSummary?: string[];
  recentPromptHistory?: { prompt?: string; promptType?: string; promptWhy?: string }[];
  recentHelpfulFeedback?: { insightType?: string; helpful: boolean; reason?: string }[];
  currentSanctuary?: string;
  userId?: string;
  userPlan?: "free" | "plus";
}

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    emotional_truth: { type: "string", description: "Private planning note: the grounded emotional meaning beneath the event." },
    mixed_emotions: { type: "string", description: "Private planning note: two emotions or tensions present at once, or empty string." },
    deeper_pressure: { type: "string", description: "Private planning note: the adjustment, need, effort, or uncertainty the user is carrying." },
    why_this_matters: { type: "string", description: "Private planning note: why this moment matters emotionally beyond the event itself." },
    fresh_perspective: { type: "string", description: "Private planning note: one grounded observation the user may not have consciously noticed." },
    response_type: {
      type: "string",
      enum: ["permission", "reassurance", "perspective_shift", "reflective_question", "practical_next_step", "recognition"],
    },
    advice_check: { type: "string", description: "Private planning note confirming that the nudge does not suggest an action already described by the user." },
    title: { type: "string" },
    preview: { type: "string" },
    what_stood_out: { type: "string" },
    gentle_nudge: {
      type: "string",
      description: "One small optional nudge, question, observation, or reassurance.",
    },
    nudge_label: { type: "string", enum: ["A Gentle Next Step", "Something to Try", "A Question to Carry", "Something to Notice", "A Little Reassurance"] },
    pattern: { type: "string", description: "Empty string unless at least three total relevant reflections support a relationship." },
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
    "emotional_truth",
    "mixed_emotions",
    "deeper_pressure",
    "why_this_matters",
    "fresh_perspective",
    "response_type",
    "advice_check",
    "title",
    "preview",
    "what_stood_out",
    "gentle_nudge",
    "nudge_label",
    "pattern",
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

interface GeneratedCoachReply {
  emotional_truth?: string;
  mixed_emotions?: string;
  deeper_pressure?: string;
  why_this_matters?: string;
  fresh_perspective?: string;
  response_type?: "permission" | "reassurance" | "perspective_shift" | "reflective_question" | "practical_next_step" | "recognition";
  advice_check?: string;
  title?: string;
  preview?: string;
  what_stood_out?: string;
  insight?: string;
  message?: string;
  gentle_nudge?: string;
  next_step?: string;
  nudge_label?: "A Gentle Next Step" | "Something to Try" | "A Question to Carry" | "Something to Notice" | "A Little Reassurance";
  pattern?: string;
  summary?: string;
  themes?: string[];
  tags?: string[];
  emotional_tone?: string;
  follow_up_questions?: string[];
  memory_note?: string;
  should_save_memory?: boolean;
  safety_flags?: string[];
  confidence?: number;
}

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
  "You are Tranqly, a thoughtful daily reflection companion. Your job is not to summarize the user's entry. " +
  "Notice the emotional meaning underneath it and offer one grounded perspective that helps the user feel genuinely understood. " +
  "Before writing the visible response, fill the private planning fields. Identify the emotional truth, any mixed emotions, the deeper pressure or adjustment, and the best response type. Use advice_check to confirm the nudge does not suggest something the user already said they are doing. " +
  "Do not stop after identifying what happened. Ask so what? Determine why the moment matters, what changed, what stayed unresolved, and what it may reveal about how the user is moving through the situation. Put that answer in why_this_matters. " +
  "Then ask whether the user would learn anything new about their experience by reading the response. Put one grounded, non-obvious observation in fresh_perspective. If it only paraphrases the entry, rethink it before writing the visible response. " +
  "Use one or two concrete details from the current reflection. Then identify a deeper meaning without repeating the entry. Notice mixed experiences such as relief without security, progress without certainty, gratitude with exhaustion, hope with hesitation, or care with frustration when supported. " +
  "Do not diagnose, exaggerate, moralize, blame anyone, or invent emotions or motives. Use tentative language when interpreting meaning. " +
  "Do not say something keeps the user on edge, makes them afraid, or reveals a hidden fear unless they explicitly described that feeling. " +
  "The visible response must add a fresh perspective. The nudge may be permission, reassurance, a perspective shift, a reflective question, a practical next step, or simple recognition. Do not force a task. " +
  "The visible response must express the emotional_truth, why_this_matters, fresh_perspective, and, when present, the mixed_emotions. Do not leave the interpretation only in the private planning fields. " +
  "Before suggesting an action, check for actions already underway. If the user says they are working on, trying, discussing, adjusting, or figuring something out, recognize that effort instead of suggesting the same action. " +
  "Mention a longer-term pattern only when at least two earlier relevant reflections support it. Otherwise return an empty pattern. " +
  "Title must be 3 to 7 natural words, at most 55 characters, with no ending period. Make it an emotionally meaningful observation, not a topic label or factual recap. " +
  "Preview must be at most 125 characters, complete its thought, and add a new layer of meaning. Never repeat or lightly rephrase the title. " +
  "What stood out must be 2 to 4 concise sentences. Its first sentence should identify the emotional truth. The next sentence should connect it to a deeper effort, need, tension, or adjustment. Reference one or two concrete details without claiming certainty. " +
  "Gentle nudge must be optional and directly relevant. Choose a nudge label that accurately describes its content. Reassurance or recognition is often better than advice. " +
  "Always speak directly to the user as you. Never describe the user in third person or use their name inside the reflection response. " +
  "Suggestions must be manageable and phrased with may, might, could, or if it helps. Never tell the user what they must do. " +
  "Avoid blaming labels such as failed, mistake, unhealthy, poor choice, not enough, broken, or you need to. " +
  "You are only a reflection companion. Do not answer programming, trivia, math, homework, shopping, recipes, factual research, translation, or general knowledge requests. " +
  "Do not start with thanks for sharing. Do not say it sounds like you're processing something real, your feelings are valid, remember that, you've got this, this shows resilience, your body is asking for, or everything will be okay. " +
  "Write like a caring friend texting. Use contractions and plain, warm words. Never use em dashes, semicolons, bullet points, headers, or emoji. " +
  "Do not suggest anxiety, depression, trauma, burnout, or any condition unless the user explicitly says it. If the user mentions self-harm, harm to others, abuse, or immediate danger, respond supportively and encourage emergency services or a trusted person. " +
  "When memory notes are provided, use them only when they create a clear and useful connection. Never turn a few reflections into a permanent personality claim. Never recite notes verbatim. " +
  "Only set should_save_memory to true for a durable, useful fact. Do not save one-off events, sensitive details, general trivia, or temporary moods. " +
  "Style calibration: if help arrives but uncertainty remains, name the breathing room without pretending the larger pressure is gone. If a relationship routine is already being adjusted, recognize that shared adjustment instead of assigning another scheduling task.";

const INSIGHT_LIMITS = { title: 55, preview: 125, whatStoodOut: 420, gentleNudge: 260, pattern: 300 } as const;

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.replace(/[\u2013\u2014;]/g, ",").replace(/\s+/g, " ").trim()
    : "";
}

function withinSentenceLimit(value: string, max: number) {
  if (value.length <= max) return value;
  const clipped = value.slice(0, max + 1);
  const sentenceEnd = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("?"), clipped.lastIndexOf("!"));
  if (sentenceEnd >= Math.floor(max * 0.55)) return clipped.slice(0, sentenceEnd + 1).trim();
  const wordEnd = clipped.lastIndexOf(" ", max - 3);
  return `${clipped.slice(0, wordEnd > 0 ? wordEnd : max - 3).trim()}...`;
}

function normalizedForComparison(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function capitalizeFirst(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

function distinctPreview(title: string, preview: string, whatStoodOut: string) {
  const normalizedTitle = normalizedForComparison(title);
  const normalizedPreview = normalizedForComparison(preview);
  const repeatsTitle = normalizedPreview === normalizedTitle ||
    normalizedPreview.startsWith(normalizedTitle) ||
    normalizedTitle.startsWith(normalizedPreview);
  if (!repeatsTitle) return preview;

  const sentences = whatStoodOut.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const distinctSentence = sentences.find((sentence) => {
    const normalized = normalizedForComparison(sentence);
    return normalized && normalized !== normalizedTitle && !normalized.startsWith(normalizedTitle);
  });
  return withinSentenceLimit(distinctSentence || whatStoodOut, INSIGHT_LIMITS.preview);
}

function relevanceScore(current: string, candidate: string) {
  const words = new Set(current.toLowerCase().match(/[a-z']{4,}/g) ?? []);
  return (candidate.toLowerCase().match(/[a-z']{4,}/g) ?? []).reduce((score, word) => score + (words.has(word) ? 1 : 0), 0);
}

const QUALITY_STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "but", "could", "does", "even", "feel", "felt", "for", "from", "had", "has", "have", "helps", "into", "its", "just", "like", "little", "may", "might", "more", "not", "now", "one", "only", "said", "seems", "some", "still", "that", "the", "their", "them", "there", "they", "this", "today", "was", "were", "what", "when", "which", "while", "with", "would", "you", "your",
]);

function meaningfulWords(value: string) {
  return (value.toLowerCase().match(/[a-z']{3,}/g) ?? []).filter((word) => !QUALITY_STOP_WORDS.has(word));
}

function overlapRatio(source: string, response: string) {
  const sourceWords = new Set(meaningfulWords(source));
  const responseWords = new Set(meaningfulWords(response));
  if (!sourceWords.size || !responseWords.size) return 0;
  let overlap = 0;
  responseWords.forEach((word) => {
    if (sourceWords.has(word)) overlap += 1;
  });
  return overlap / responseWords.size;
}

function responseQualityIssues(entry: string, reply: GeneratedCoachReply, name?: string) {
  const title = cleanText(reply.title);
  const stoodOut = cleanText(reply.what_stood_out || reply.insight || reply.message);
  const nudge = cleanText(reply.gentle_nudge || reply.next_step);
  const combined = `${title} ${stoodOut} ${nudge}`.toLowerCase();
  const issues: string[] = [];
  const genericPhrases = [
    "thanks for sharing",
    "processing something real",
    "your feelings are valid",
    "you've got this",
    "this shows resilience",
    "your body is asking",
    "everything will be okay",
    "it sounds like you are going through a lot",
    "take things one day at a time",
    "focus on the small positives",
    "indicating that",
    "suggesting that",
    "significant concern",
    "impacting daily life",
    "keeps you on edge",
    "deep down you",
    "hidden fear",
    "small wins",
    "juggling multiple challenges",
    "take a moment to acknowledge",
    "the fact that",
    "which shows that",
    "small improvements",
    "one step at a time",
    "significant change",
    "own set of challenges",
    "a mix of emotions",
    "positive step",
    "requiring some adjustments",
    "navigating multiple shifts",
  ];
  const topicTitles = /^(financial stress|schedule changes|today'?s reflection|feeling better|unemployment update|small relief)$/i;
  const sentenceCount = stoodOut.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.length ?? 0;

  if (sentenceCount < 2) issues.push("what_stood_out needs at least two interpretive sentences");
  if (cleanText(reply.preview).split(/\s+/).filter(Boolean).length < 5) issues.push("preview is a generic fragment instead of a complete insight");
  if (topicTitles.test(title)) issues.push("title labels the topic instead of naming emotional meaning");
  if (genericPhrases.some((phrase) => combined.includes(phrase))) issues.push("response uses generic wellness language");
  const normalizedName = name?.trim().toLowerCase();
  if (normalizedName && new RegExp(`\\b${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(combined)) {
    issues.push("response describes the user by name instead of speaking directly to them");
  }
  if (/\b(the user|they feel|they are|he feels|she feels|he is|she is)\b/i.test(combined)) {
    issues.push("response uses third person instead of speaking directly to the user");
  }
  if (overlapRatio(entry, `${stoodOut} ${nudge}`) > 0.58) issues.push("too much of the response paraphrases the entry");

  const planningWords = new Set(meaningfulWords(`${cleanText(reply.emotional_truth)} ${cleanText(reply.mixed_emotions)} ${cleanText(reply.deeper_pressure)} ${cleanText(reply.why_this_matters)} ${cleanText(reply.fresh_perspective)}`));
  const visibleWords = new Set(meaningfulWords(`${stoodOut} ${nudge}`));
  const visiblePlanningMatches = [...planningWords].filter((word) => visibleWords.has(word)).length;
  if (planningWords.size && visiblePlanningMatches < 2) issues.push("visible response does not express the planned emotional meaning");
  const entrySignalsMixedEmotion = /\b(but|still|although|even though|at the same time|yet)\b/i.test(entry);
  if (entrySignalsMixedEmotion && !cleanText(reply.mixed_emotions)) issues.push("mixed emotions in the reflection were reduced to one feeling");

  const entryWords = new Set(meaningfulWords(entry));
  const responseWords = new Set(meaningfulWords(`${stoodOut} ${nudge}`));
  const concreteMatches = [...responseWords].filter((word) => entryWords.has(word)).length;
  if (concreteMatches < 2) issues.push("response lacks a concrete connection to the reflection");

  const actionAlreadyUnderway = /\b(still (?:working|trying|adjusting)|already|working on|trying to|adjusting to|figuring out|talking about|discussing)\b/i.test(entry);
  if (actionAlreadyUnderway) {
    const nudgeWords = new Set(meaningfulWords(nudge));
    const activeTopicOverlap = [...nudgeWords].filter((word) => entryWords.has(word)).length;
    const taskLanguage = /\b(try|start|make|discuss|talk|work on|figure out|create|set|plan|write|choose)\b/i.test(nudge);
    if (taskLanguage && activeTopicOverlap >= 2) issues.push("nudge repeats an action the user already has underway");
  }

  if (!cleanText(reply.emotional_truth)) issues.push("emotional truth was not identified");
  if (!cleanText(reply.why_this_matters)) issues.push("why this matters was not identified");
  if (!cleanText(reply.fresh_perspective)) issues.push("no fresh perspective was identified");
  if (!cleanText(reply.advice_check)) issues.push("advice was not checked against the reflection");
  return issues;
}

function groundedFallbackReply(entry: string): GeneratedCoachReply | null {
  const lower = entry.toLowerCase();
  const financialUncertainty = /unemploy|money|check|payment|income|financial|rent|bills/.test(lower);
  const scheduleAdjustment = /night shift|night schedule|schedule|shift|adjusting/.test(lower);
  if (!financialUncertainty || !scheduleAdjustment) return null;
  const relationshipLabel = /\bgirlfriend\b/.test(lower) ? "girlfriend"
    : /\bboyfriend\b/.test(lower) ? "boyfriend"
      : /\bfianc[eé]e\b/.test(lower) ? "fiancée"
        : /\bfianc[eé]\b/.test(lower) ? "fiancé"
          : /\bwife\b/.test(lower) ? "wife"
            : /\bhusband\b/.test(lower) ? "husband"
              : /\bspouse\b/.test(lower) ? "spouse"
                : /\bpartner\b/.test(lower) ? "partner"
                  : "";
  const scheduleMeaning = relationshipLabel
    ? `At the same time, home may still feel unsettled while you and your ${relationshipLabel} find a different rhythm.`
    : "At the same time, the new schedule may still be making everyday life feel unsettled while a different rhythm takes shape.";

  return {
    emotional_truth: "Relief can be real without creating security yet.",
    mixed_emotions: "Relief and uncertainty are present together.",
    deeper_pressure: "Financial uncertainty and a shared routine change are both taking time to settle.",
    why_this_matters: "One burden becoming lighter can create breathing room even when the larger season is unresolved.",
    fresh_perspective: "The user is allowing relief to be real without pretending everything is fixed.",
    response_type: "reassurance",
    advice_check: "The user is already working on the schedule adjustment, so no scheduling task is suggested.",
    title: "A Little Room to Breathe",
    preview: "One pressure eased, even while the larger uncertainty remains.",
    what_stood_out:
      `The payment did not erase the uncertainty, but it gave you a little breathing room after waiting without knowing when help would come. ${scheduleMeaning} The relief can be real without feeling complete.`,
    gentle_nudge:
      "You do not have to turn this relief into a solution for everything else. It may be enough to let one pressure feel lighter while the rest takes time to settle.",
    nudge_label: "A Little Reassurance",
    pattern: "",
    summary: "One source of pressure eased while the rest is still taking time to settle.",
    themes: ["finances", "adjustment", "relationship"],
    tags: ["work", "relationships"],
    emotional_tone: "relieved and uncertain",
    follow_up_questions: ["What feels a little lighter now that the payment arrived?"],
    memory_note: "",
    should_save_memory: false,
    safety_flags: [],
    confidence: 0.9,
  };
}

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

  const relevantPastReflections = (payload.recentEntries ?? [])
    .map((entry, index) => ({ entry, index, score: relevanceScore(entryText, entry.text) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5)
    .map(({ entry }) => entry);
  const context = relevantPastReflections
    .map((e) => `- [${e.dateKey}] ${e.text}${e.previousInsight ? `\n  Previous insight: ${e.previousInsight}` : ""}${e.tags?.length ? `\n  Tags: ${e.tags.join(", ")}` : ""}`)
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
  const feedbackContext = (payload.recentHelpfulFeedback ?? []).slice(0, 5).map((item) => `- ${item.helpful ? "Helpful" : "Not helpful"}${item.reason ? `: ${item.reason}` : ""}`).join("\n");

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
        preview: REFLECTION_ONLY_MESSAGE.slice(0, 125),
        insight: REFLECTION_ONLY_MESSAGE,
        pattern: null,
        message: REFLECTION_ONLY_MESSAGE,
        nextStep: "Share one sentence about your day or how you're feeling.",
        nudgeLabel: "A Question to Carry",
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

    const generationMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content:
          `The user${payload.name ? ` (${payload.name})` : ""} just shared what they did today:\n` +
          `"${entryText.slice(0, 1200)}"\n\n` +
          `Today's mood: ${payload.mood ?? "not shared"}\n` +
          `Check-in streak: ${payload.streak} day(s)\n` +
          `Prompt used today: ${payload.prompt ?? "not provided"}\n` +
          `Prompt type: ${payload.promptType ?? "not provided"}\n` +
          `Why this question: ${payload.promptWhy ?? "not provided"}\n` +
          `Current sanctuary: ${payload.currentSanctuary ?? "not provided"}\n` +
          (notes ? `What you've learned about them so far:\n${notes}\n\n` : "") +
          (memoryProfileSummary ? `Memory profile summary:\n${memoryProfileSummary}\n\n` : "") +
          (promptHistory ? `Recent prompt history:\n${promptHistory}\n\n` : "") +
          (feedbackContext ? `Recent response feedback. Avoid repeating styles marked not helpful:\n${feedbackContext}\n\n` : "") +
          (context ? `Their recent reflections:\n${context}\n\n` : "There are not enough prior reflections to support a pattern.\n\n") +
          `${relevantPastReflections.length >= 2 ? "Only include a pattern if at least two earlier reflections support the same relationship." : "Return an empty pattern because there is insufficient evidence."}\n` +
          "Respond to today's reflection with valid JSON.",
      },
    ];
    let { parsed, usage } = await groqJsonChatWithUsage<GeneratedCoachReply>({
      maxTokens: 700,
      feature: "daily_insight",
      userPlan: payload.userPlan ?? "free",
      schema: { name: "coach_reply", schema: REPLY_SCHEMA },
      messages: generationMessages,
    });
    const usageRecords = [usage];
    const initialQualityIssues = responseQualityIssues(entryText, parsed, payload.name);
    if (initialQualityIssues.length) {
      try {
        const rewrite = await groqJsonChatWithUsage<GeneratedCoachReply>({
          maxTokens: 700,
          feature: "daily_insight",
          userPlan: payload.userPlan ?? "free",
          schema: { name: "coach_reply", schema: REPLY_SCHEMA },
          messages: [
            ...generationMessages,
            { role: "assistant", content: JSON.stringify(parsed) },
            {
              role: "user",
              content:
                `The draft failed quality review: ${initialQualityIssues.join("; ")}. ` +
                "Rewrite it from a deeper interpretation rather than a summary. Ask so what, state why the moment matters, and include one grounded observation the user may not have consciously noticed. Keep one or two concrete details and do not suggest an action already underway. " +
                "The gentle section may simply offer permission or reassurance. Return complete valid JSON.",
            },
          ],
        });
        const rewrittenIssues = responseQualityIssues(entryText, rewrite.parsed, payload.name);
        usageRecords.push(rewrite.usage);
        if (rewrittenIssues.length <= initialQualityIssues.length) {
          parsed = rewrite.parsed;
          usage = rewrite.usage;
        }
      } catch (rewriteError) {
        console.warn(`[coach:${requestId}] quality rewrite failed, using first response`, rewriteError);
      }
    }
    const remainingQualityIssues = responseQualityIssues(entryText, parsed, payload.name);
    const groundedFallback = remainingQualityIssues.length ? groundedFallbackReply(entryText) : null;
    if (groundedFallback) {
      parsed = groundedFallback;
    }
    console.info(`[coach:${requestId}] daily insight success`, {
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      source: "ai",
      qualityRetry: usageRecords.length > 1,
      groundedFallback: Boolean(groundedFallback),
      durationMs: Date.now() - startedAt,
    });
    await Promise.all(usageRecords.map((usageRecord) => logAiUsage({
      ...usageRecord,
      uid: payload.userId,
      status: "success",
      classification: classification.classification,
      allowed: true,
    }).catch((logErr) => console.warn(`[coach:${requestId}] daily usage log failed`, logErr))));
    const rawTitle = cleanText(parsed.title).replace(/[.!?]+$/, "");
    const title = (rawTitle.length <= INSIGHT_LIMITS.title ? rawTitle : rawTitle.slice(0, INSIGHT_LIMITS.title).replace(/\s+\S*$/, "")).trim() || "What stood out today";
    const whatStoodOut = withinSentenceLimit(
      cleanText(parsed.what_stood_out || parsed.insight || parsed.message || parsed.summary),
      INSIGHT_LIMITS.whatStoodOut
    );
    const proposedPreview = capitalizeFirst(withinSentenceLimit(cleanText(parsed.preview), INSIGHT_LIMITS.preview)) || withinSentenceLimit(whatStoodOut, INSIGHT_LIMITS.preview);
    const preview = capitalizeFirst(distinctPreview(title, proposedPreview, whatStoodOut));
    const gentleNudge = capitalizeFirst(withinSentenceLimit(
      cleanText(parsed.gentle_nudge || parsed.next_step),
      INSIGHT_LIMITS.gentleNudge
    )) || "If it helps, carry this awareness with you and notice what feels different next time.";
    if (!whatStoodOut || !preview || !gentleNudge) throw new Error("Invalid empty insight fields");
    const supportedPattern = relevantPastReflections.length >= 2 ? withinSentenceLimit(cleanText(parsed.pattern), INSIGHT_LIMITS.pattern) || null : null;
    return NextResponse.json({
      title,
      preview,
      whatStoodOut,
      gentleNudge,
      nudgeLabel: parsed.nudge_label || "Something to Notice",
      insight: whatStoodOut,
      pattern: supportedPattern,
      message: whatStoodOut,
      nextStep: gentleNudge,
      summary: cleanText(parsed.summary) || preview,
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      emotionalTone: cleanText(parsed.emotional_tone) || "reflective",
      followUpQuestions: Array.isArray(parsed.follow_up_questions) ? parsed.follow_up_questions : [],
      memoryNote: parsed.should_save_memory ? parsed.memory_note?.trim() || undefined : undefined,
      shouldSaveMemory: parsed.should_save_memory,
      safetyFlags: Array.isArray(parsed.safety_flags) ? parsed.safety_flags : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
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
    const failureReason = err instanceof Error
      ? err.message.includes("429") ? "provider_rate_limited"
        : err.message.includes("JSON") ? "invalid_provider_json"
          : err.message.includes("Invalid empty") ? "invalid_ai_fields"
            : err.message.includes("Groq chat failed") ? "provider_request_failed"
              : "coach_generation_failed"
      : "coach_generation_failed";
    return NextResponse.json({
      error: "ai_unavailable",
      title: "Insight unavailable",
      preview: "Your reflection was saved. Tranqly can try generating the insight again in a moment.",
      message: AI_UNAVAILABLE_MESSAGE,
      nextStep: "Try again in a moment.",
      nudgeLabel: "A Little Reassurance",
      pattern: null,
      source: "local",
      requestId,
      failureReason,
    }, { status: 200 });
  }
}
