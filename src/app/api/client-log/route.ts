import { NextRequest, NextResponse } from "next/server";
import { logAdminError } from "@/lib/adminErrors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await logAdminError({
    requestId: typeof payload.requestId === "string" ? payload.requestId : undefined,
    errorCode: typeof payload.errorCode === "string" ? payload.errorCode : "client_error",
    errorMessage: typeof payload.errorMessage === "string" ? payload.errorMessage : "Client error",
    featureArea: typeof payload.featureArea === "string" ? payload.featureArea : "client",
    severity: payload.severity === "warning" || payload.severity === "info" ? payload.severity : "error",
    platform: typeof payload.platform === "string" ? payload.platform : "mobile",
    statusCode: typeof payload.statusCode === "number" ? payload.statusCode : undefined,
    durationMs: typeof payload.durationMs === "number" ? payload.durationMs : undefined,
    route: typeof payload.route === "string" ? payload.route : undefined,
    metadata: typeof payload.metadata === "object" && payload.metadata !== null ? payload.metadata as Record<string, unknown> : undefined,
  });

  return NextResponse.json({ ok: true });
}
