"use client";

import { todayKey } from "@/lib/types";

const DAILY_INSPIRATIONS = [
  "Small honesty is still a kind of progress.",
  "You do not have to solve the whole day to learn from it.",
  "A quiet check-in can be enough to shift tomorrow.",
  "Notice the effort. It counts even when it was messy.",
  "The next right step can be very small and still matter.",
  "You are allowed to begin again without making it a big event.",
  "What you pay attention to has a better chance to grow.",
];

function dailyIndex() {
  return (
    todayKey()
      .split("")
      .reduce((total, char) => total + char.charCodeAt(0), 0) %
    DAILY_INSPIRATIONS.length
  );
}

export default function InspirationCard() {
  return (
    <section className="shrink-0 rounded-xl2 border border-edge bg-card p-3 shadow-card short-fit:p-2.5 shorter:p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-calm short-fit:text-[10px] shorter:text-[9px]">
        Daily inspiration
      </p>
      <p className="mt-1 text-sm leading-snug text-dim short-fit:text-xs shorter:text-[11px]">
        {DAILY_INSPIRATIONS[dailyIndex()]}
      </p>
    </section>
  );
}
