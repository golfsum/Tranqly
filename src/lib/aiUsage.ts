import { addDoc, collection, doc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebase } from "./firebase";
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
  const fb = getFirebase();
  if (!fb) return;

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
    createdAt: serverTimestamp(),
  };

  await addDoc(collection(fb.db, "aiUsageLogs"), safePayload);

  const month = monthKey();
  const today = dayKey();
  await Promise.all([
    setDoc(
      doc(fb.db, "adminAiUsage", `day-${today}`),
      {
        period: "day",
        key: today,
        totalCalls: increment(1),
        totalTokens: increment(input.totalTokens),
        estimatedCost: increment(input.estimatedCost),
        models: {
          [input.model]: {
            calls: increment(1),
            cost: increment(input.estimatedCost),
          },
        },
        features: {
          [input.feature]: {
            calls: increment(1),
            cost: increment(input.estimatedCost),
          },
        },
        rejectedNonReflection: input.allowed === false ? increment(1) : increment(0),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
    setDoc(
      doc(fb.db, "adminAiUsage", `month-${month}`),
      {
        period: "month",
        key: month,
        totalCalls: increment(1),
        totalTokens: increment(input.totalTokens),
        estimatedCost: increment(input.estimatedCost),
        models: {
          [input.model]: {
            calls: increment(1),
            cost: increment(input.estimatedCost),
          },
        },
        features: {
          [input.feature]: {
            calls: increment(1),
            cost: increment(input.estimatedCost),
          },
        },
        rejectedNonReflection: input.allowed === false ? increment(1) : increment(0),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
    setDoc(
      doc(fb.db, "adminAiUserUsage", uid),
      {
        uid,
        totalCalls: increment(1),
        totalTokens: increment(input.totalTokens),
        estimatedCost: increment(input.estimatedCost),
        rejectedNonReflection: input.allowed === false ? increment(1) : increment(0),
        lastClassification: input.classification ?? null,
        lastAllowed: input.allowed ?? null,
        lastFeature: input.feature,
        lastModel: input.model,
        lastUsedAt: serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}
