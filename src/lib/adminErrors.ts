import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirebase } from "./firebase";

export interface AdminErrorLogInput {
  requestId?: string;
  errorCode: string;
  errorMessage: string;
  featureArea: string;
  severity?: "info" | "warning" | "error";
  platform?: string;
  statusCode?: number;
  durationMs?: number;
  route?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export async function logAdminError(input: AdminErrorLogInput) {
  try {
    const fb = getFirebase();
    if (!fb) return;

    await addDoc(collection(fb.db, "adminErrors"), {
      requestId: input.requestId ?? null,
      errorCode: input.errorCode.slice(0, 120),
      errorMessage: input.errorMessage.slice(0, 1000),
      featureArea: input.featureArea,
      severity: input.severity ?? "error",
      platform: input.platform ?? "server",
      statusCode: input.statusCode ?? null,
      durationMs: input.durationMs ?? null,
      route: input.route ?? null,
      model: input.model ?? null,
      metadata: input.metadata ?? null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Failed to write admin error log", err);
  }
}
