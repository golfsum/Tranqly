import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebaseAdmin";

const ID_PATTERN = /^[a-zA-Z0-9-]{8,80}$/;
const PAGE_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const visitorId = String(body.visitorId ?? "");
    const sessionId = String(body.sessionId ?? "");
    const page = String(body.page ?? "home");
    if (!ID_PATTERN.test(visitorId) || !ID_PATTERN.test(sessionId) || !PAGE_PATTERN.test(page)) {
      return NextResponse.json({ error: "Invalid analytics event." }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const visitorRef = admin.db.collection("siteVisitors").doc(`${today}_${visitorId}`);
    const sessionRef = admin.db.collection("siteSessions").doc(`${today}_${sessionId}`);
    const dayRef = admin.db.collection("siteAnalytics").doc(`day-${today}`);
    const monthRef = admin.db.collection("siteAnalytics").doc(`month-${month}`);

    await admin.db.runTransaction(async (transaction) => {
      const [visitor, session] = await Promise.all([transaction.get(visitorRef), transaction.get(sessionRef)]);
      const uniqueVisitor = !visitor.exists;
      const uniqueSession = !session.exists;
      const aggregate = (period: "day" | "month", key: string) => ({
        period,
        key,
        pageViews: FieldValue.increment(1),
        uniqueVisitors: FieldValue.increment(uniqueVisitor ? 1 : 0),
        sessions: FieldValue.increment(uniqueSession ? 1 : 0),
        pages: { [page]: FieldValue.increment(1) },
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(dayRef, aggregate("day", today), { merge: true });
      transaction.set(monthRef, aggregate("month", month), { merge: true });
      if (uniqueVisitor) transaction.set(visitorRef, { visitorId, day: today, firstPage: page, createdAt: FieldValue.serverTimestamp() });
      if (uniqueSession) transaction.set(sessionRef, { sessionId, visitorId, day: today, firstPage: page, createdAt: FieldValue.serverTimestamp() });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analytics logging failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
