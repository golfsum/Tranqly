"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";

const VISITOR_KEY = "tranqly-site-visitor-id";
const SESSION_KEY = "tranqly-site-session-id";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function getOrCreateId(key: string) {
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function isAdmin(email?: string | null) {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
}

export default function SiteAnalyticsTracker({ page = "home" }: { page?: string }) {
  useEffect(() => {
    const fb = getFirebase();
    if (!fb) return;

    let cancelled = false;

    return onAuthStateChanged(fb.auth, async (user) => {
      if (cancelled || isAdmin(user?.email)) return;

      const visitorId = getOrCreateId(VISITOR_KEY);
      const sessionId = getOrCreateId(SESSION_KEY);
      const today = dayKey();
      const month = monthKey();
      const visitorDayId = `${today}_${visitorId}`;
      const sessionDayId = `${today}_${sessionId}`;

      const visitorRef = doc(fb.db, "siteVisitors", visitorDayId);
      const sessionRef = doc(fb.db, "siteSessions", sessionDayId);
      const dayRef = doc(fb.db, "siteAnalytics", `day-${today}`);
      const monthRef = doc(fb.db, "siteAnalytics", `month-${month}`);

      const visitorMarker = `tranqly-visited-${today}`;
      const sessionMarker = `tranqly-session-${today}`;
      const isUniqueToday = !localStorage.getItem(visitorMarker);
      const isSessionUniqueToday = !sessionStorage.getItem(sessionMarker);

      try {
        await Promise.all([
          setDoc(
            dayRef,
            {
              period: "day",
              key: today,
              pageViews: increment(1),
              uniqueVisitors: increment(isUniqueToday ? 1 : 0),
              sessions: increment(isSessionUniqueToday ? 1 : 0),
              pages: {
                [page]: increment(1),
              },
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ),
          setDoc(
            monthRef,
            {
              period: "month",
              key: month,
              pageViews: increment(1),
              uniqueVisitors: increment(isUniqueToday ? 1 : 0),
              sessions: increment(isSessionUniqueToday ? 1 : 0),
              pages: {
                [page]: increment(1),
              },
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ),
          isUniqueToday
            ? setDoc(visitorRef, {
                visitorId,
                day: today,
                firstPage: page,
                createdAt: serverTimestamp(),
              })
            : Promise.resolve(),
          isSessionUniqueToday
            ? setDoc(sessionRef, {
                sessionId,
                visitorId,
                day: today,
                firstPage: page,
                createdAt: serverTimestamp(),
              })
            : Promise.resolve(),
        ]);

        localStorage.setItem(visitorMarker, "1");
        sessionStorage.setItem(sessionMarker, "1");
      } catch (error) {
        console.warn("Site analytics logging failed", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [page]);

  return null;
}
