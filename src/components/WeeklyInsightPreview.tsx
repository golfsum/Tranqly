"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { tap } from "@/lib/haptics";
import { todayKey } from "@/lib/types";

function startOfWeekKey() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${date}`;
}

function mobileWeeklyKey(insight: { createdAt: string; weekStart?: string }) {
  return insight.weekStart ?? insight.createdAt;
}

export default function WeeklyInsightPreview({
  onViewJourney,
}: {
  onNeedPremium: () => void;
  onViewJourney: () => void;
}) {
  const checkIns = useApp((s) => s.checkIns);
  const premium = useApp((s) => s.settings.premium);
  const lastDeepInsight = useApp((s) => s.lastDeepInsight);
  const weeklyInsights = useApp((s) => s.weeklyInsights);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const insights = weeklyInsights.length ? weeklyInsights : lastDeepInsight ? [lastDeepInsight] : [];
  const selected = insights[selectedIndex] ?? insights[0];
  const start = startOfWeekKey();
  const weekDays = new Set(
    checkIns.filter((c) => c.dateKey >= start && c.dateKey <= todayKey()).map((c) => c.dateKey)
  );
  const count = weekDays.size;
  const enough = count >= 7;
  const progress = Math.min(7, count);
  const blocks = Array.from({ length: 7 }, (_, i) => i < progress);

  return (
    <section className="shrink-0 rounded-[1.35rem] border border-calm/30 bg-gradient-to-br from-card via-[#151C2B] to-[#123733] p-3 shadow-card short-fit:p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-black uppercase tracking-wide text-calm short-fit:text-xs">
          Weekly Reflection
        </p>
        <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-sea">
          Sunday
        </span>
      </div>
      <p className="mb-2 text-sm font-black text-fg short-fit:text-xs">
        {progress} of 7 complete
      </p>
      <div className="flex gap-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={7} aria-valuenow={progress} aria-label={`Weekly Reflection, ${progress} of 7 complete`}>
        {blocks.map((filled, index) => (
          <span
            key={index}
            className={`h-2 flex-1 rounded-full ${
              filled ? "bg-gradient-to-r from-calm to-sea" : "bg-ink/80"
            }`}
          />
        ))}
      </div>
      {(enough || insights.length > 0) && (
        <button
          onClick={() => {
            tap();
            if (insights.length) setOpen(true);
            else if (enough || premium) onViewJourney();
          }}
          className="mt-3 min-h-[40px] w-full rounded-2xl border border-calm/20 bg-button text-sm font-black text-fg"
        >
          {insights.length > 1 ? "View Weekly Reflection History" : "Read Weekly Reflection"}
        </button>
      )}
      {open ? <div className="fixed inset-0 z-[70] flex items-end bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-edge bg-card p-5 shadow-card"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-calm">Weekly Reflections</p><h2 className="mt-1 text-2xl font-black">Weekly Reflection History</h2></div><button onClick={() => setOpen(false)} className="min-h-[44px] rounded-full border border-edge bg-ink px-4 text-sm font-bold text-dim">Close</button></div>{selected ? <div className="mt-4 rounded-2xl border border-calm/25 bg-ink/70 p-4"><p className="text-xs text-faint">Week of {new Date(selected.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p><h3 className="mt-2 text-xl font-black">{selected.headline}</h3><p className="mt-2 text-sm leading-relaxed text-dim">{selected.insight}</p><div className="mt-3 rounded-2xl border border-calm/20 bg-calm/10 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-calm">This week&apos;s experiment</p><p className="mt-1 text-sm">{selected.suggestion}</p></div></div> : null}{insights.length > 1 ? <div className="mt-4 space-y-2">{insights.map((insight, index) => <button key={mobileWeeklyKey(insight)} onClick={() => setSelectedIndex(index)} className="min-h-[52px] w-full rounded-2xl border border-edge bg-ink/55 p-3 text-left"><p className="text-xs text-faint">{new Date(insight.createdAt).toLocaleDateString()}</p><p className="font-bold">{insight.headline}</p></button>)}</div> : null}</div></div> : null}
    </section>
  );
}
