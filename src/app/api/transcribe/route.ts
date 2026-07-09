import { NextRequest, NextResponse } from "next/server";
import { groqTranscribe } from "@/lib/groq";
import { logAdminError } from "@/lib/adminErrors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  console.info(`[transcribe:${requestId}] request received`);

  if (!process.env.GROQ_API_KEY) {
    console.warn(`[transcribe:${requestId}] missing GROQ_API_KEY`);
    await logAdminError({
      requestId,
      errorCode: "missing_groq_api_key",
      errorMessage: "GROQ_API_KEY is missing for transcription.",
      featureArea: "transcription",
      platform: "server",
      statusCode: 503,
      durationMs: Date.now() - startedAt,
      route: "/api/transcribe",
    });
    return NextResponse.json(
      { error: "Missing GROQ_API_KEY", requestId },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    console.error(`[transcribe:${requestId}] invalid multipart body`, err);
    await logAdminError({
      requestId,
      errorCode: "invalid_audio_upload",
      errorMessage: err instanceof Error ? err.message : "Invalid multipart body",
      featureArea: "transcription",
      platform: "server",
      statusCode: 400,
      durationMs: Date.now() - startedAt,
      route: "/api/transcribe",
    });
    return NextResponse.json({ error: "Invalid audio upload", requestId }, { status: 400 });
  }
  const file = form.get("audio") ?? form.get("file");

  if (!file || typeof file === "string") {
    console.warn(`[transcribe:${requestId}] missing audio file`);
    await logAdminError({
      requestId,
      errorCode: "missing_audio_file",
      errorMessage: "No audio file field was present in the transcription upload.",
      featureArea: "transcription",
      platform: "server",
      statusCode: 400,
      durationMs: Date.now() - startedAt,
      route: "/api/transcribe",
    });
    return NextResponse.json({ error: "Missing audio file", requestId }, { status: 400 });
  }

  try {
    console.info(
      `[transcribe:${requestId}] forwarding to Groq`,
      file instanceof File ? { name: file.name, type: file.type, size: file.size } : {}
    );
    const text = await groqTranscribe(file);
    console.info(`[transcribe:${requestId}] success`, { chars: text.length, durationMs: Date.now() - startedAt });
    return NextResponse.json({ text, requestId });
  } catch (err) {
    console.error(`[transcribe:${requestId}] failed`, err);
    await logAdminError({
      requestId,
      errorCode: "groq_transcription_failed",
      errorMessage: err instanceof Error ? err.message : "Transcription failed",
      featureArea: "transcription",
      platform: "server",
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      route: "/api/transcribe",
      model: process.env.GROQ_TRANSCRIPTION_MODEL || "distil-whisper-large-v3-en",
    });
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Transcription failed",
        requestId,
      },
      { status: 500 }
    );
  }
}
