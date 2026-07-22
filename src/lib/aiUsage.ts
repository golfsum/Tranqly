import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "./firebaseAdmin";
import { GroqUsageMeta } from "./groq";

export interface AiUsageLogInput extends GroqUsageMeta {
  uid?: string | null;
  status: "success" | "fallback" | "error";
  errorCode?: string;
  classification?: string;
  allowed?: boolean;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function logAiUsage(input: AiUsageLogInput) {
  try {
    const admin = getFirebaseAdmin();
    const uid = input.uid || "anonymous";
    const safePayload = {
      uid,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      estimatedCost: input.estimatedCost,
      feature: input.feature,
      userPlan: input.userPlan,
      classification: input.classification ?? null,
      allowed: input.allowed ?? null,
      status: input.status,
      errorCode: input.errorCode ?? null,
      createdAt: FieldValue.serverTimestamp(),
    };

    await admin.db.collection("aiUsageLogs").add(safePayload);

    const month = monthKey();
    const today = dayKey();
    await Promise.all([
      admin.db.collection("adminAiUsage").doc(`day-${today}`).set(
      {
        period: "day",
        key: today,
        totalCalls: FieldValue.increment(1),
        totalTokens: FieldValue.increment(input.totalTokens),
        estimatedCost: FieldValue.increment(input.estimatedCost),
        models: {
          [input.model]: {
            calls: FieldValue.increment(1),
            cost: FieldValue.increment(input.estimatedCost),
          },
        },
        features: {
          [input.feature]: {
            calls: FieldValue.increment(1),
            cost: FieldValue.increment(input.estimatedCost),
          },
        },
        rejectedNonReflection: FieldValue.increment(input.allowed === false ? 1 : 0),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
      admin.db.collection("adminAiUsage").doc(`month-${month}`).set(
      {
        period: "month",
        key: month,
        totalCalls: FieldValue.increment(1),
        totalTokens: FieldValue.increment(input.totalTokens),
        estimatedCost: FieldValue.increment(input.estimatedCost),
        models: {
          [input.model]: {
            calls: FieldValue.increment(1),
            cost: FieldValue.increment(input.estimatedCost),
          },
        },
        features: {
          [input.feature]: {
            calls: FieldValue.increment(1),
            cost: FieldValue.increment(input.estimatedCost),
          },
        },
        rejectedNonReflection: FieldValue.increment(input.allowed === false ? 1 : 0),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
      admin.db.collection("adminAiUserUsage").doc(uid).set(
      {
        uid,
        totalCalls: FieldValue.increment(1),
        totalTokens: FieldValue.increment(input.totalTokens),
        estimatedCost: FieldValue.increment(input.estimatedCost),
        rejectedNonReflection: FieldValue.increment(input.allowed === false ? 1 : 0),
        lastClassification: input.classification ?? null,
        lastAllowed: input.allowed ?? null,
        lastFeature: input.feature,
        lastModel: input.model,
        lastUsedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    ]);
  } catch (error) {
    console.warn("AI usage logging failed", error instanceof Error ? error.message : error);
  }
}
