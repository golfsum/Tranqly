"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
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

      try {
        const response = await fetch("/api/site-analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId, sessionId, page }),
          keepalive: true,
        });
        if (!response.ok) throw new Error(`Analytics request failed (${response.status})`);
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
