"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createWaitlistSignup,
  listWaitlistSignups,
  WAITLIST_MAX_SPOTS,
  WAITLIST_SUPPORT_EMAIL,
} from "@/lib/adminSupport";
import { firebaseConfigured } from "@/lib/firebase";

export default function WaitlistSignup({
  compact = false,
  showFooterNote = true,
}: {
  compact?: boolean;
  showFooterNote?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!firebaseConfigured()) return;
    void listWaitlistSignups().then((items) => setCount(items.length));
  }, []);

  const spotsLeft = Math.max(0, WAITLIST_MAX_SPOTS - count);
  const full = count >= WAITLIST_MAX_SPOTS;
  const claimedPercent = Math.min(100, Math.max(0, (count / WAITLIST_MAX_SPOTS) * 100));
  const summary = useMemo(
    () => full ? "All early access spots are filled." : `Only ${spotsLeft} spots left at $3.99/mo for life`,
    [spotsLeft, full]
  );

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setNotice("Enter your email first.");
      return;
    }
    if (!firebaseConfigured()) {
      setNotice(`Firebase is not configured. Send signups to ${WAITLIST_SUPPORT_EMAIL}.`);
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const result = await createWaitlistSignup(normalizedEmail);
      setCount(result.count);
      setEmail("");
      setNotice(
        result.alreadyJoined
          ? `You are already on the list with ${normalizedEmail}.`
          : `Saved. Your spot request is now routed to ${WAITLIST_SUPPORT_EMAIL}.`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not join the waitlist.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.95rem] font-black text-[#f2cf73]">{summary}</p>
          <p className="text-[0.82rem] text-white/48">{Math.min(count, WAITLIST_MAX_SPOTS)} / {WAITLIST_MAX_SPOTS} filled</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8f3fff] to-[#ffd45c]"
            style={{ width: `${claimedPercent}%` }}
          />
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className={`flex ${compact ? "flex-col gap-3 sm:flex-row sm:items-center" : "flex-col gap-4 sm:flex-row sm:items-center"}`}
      >
        <div className="flex h-16 flex-1 items-center gap-3 rounded-full border border-[#6a4ca0] bg-[#120d1f]/90 px-5 shadow-[0_0_0_1px_rgba(194,125,255,0.16),0_0_36px_rgba(157,82,255,0.22)]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#c89eff]" fill="none" aria-hidden>
            <path d="M4 7.5 12 13l8-5.5M5.5 18h13A1.5 1.5 0 0 0 20 16.5v-9A1.5 1.5 0 0 0 18.5 6h-13A1.5 1.5 0 0 0 4 7.5v9A1.5 1.5 0 0 0 5.5 18Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={full ? "Waitlist full" : "support@tranqly.app"}
            disabled={busy || full}
            className="h-full flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#8f78b5] disabled:cursor-not-allowed disabled:text-white/40"
          />
        </div>
        <button
          type="submit"
          disabled={busy || full}
          className="h-16 rounded-full bg-gradient-to-r from-[#8f3fff] to-[#b15cff] px-9 text-base font-bold text-white shadow-[0_14px_40px_rgba(149,80,255,0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[210px]"
        >
          {busy ? "Saving..." : full ? "Waitlist full" : "Lock in $3.99/mo"}
        </button>
      </form>
      {showFooterNote ? (
        <div className="mt-3 space-y-1 text-[0.95rem] text-white/45">
          <p>{notice || "No spam. Just 1 email reminder."}</p>
          {!notice && !full ? (
            <p>You&apos;ll only be charged when we launch. Cancel anytime. Spots are first-come, first-served.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
