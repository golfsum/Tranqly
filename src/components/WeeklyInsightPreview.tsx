"use client";

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

export default function WeeklyInsightPreview({
  onViewJourney,
}: {
  onNeedPremium: () => void;
  onViewJourney: () => void;
}) {
  const checkIns = useApp((s) => s.checkIns);
  const premium = useApp((s) => s.settings.premium);
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
      <div className="flex gap-1.5" aria-label={`${progress} of 7 check-ins complete`}>
        {blocks.map((filled, index) => (
          <span
            key={index}
            className={`h-2 flex-1 rounded-full ${
              filled ? "bg-gradient-to-r from-calm to-sea" : "bg-ink/80"
            }`}
          />
        ))}
      </div>
      {enough && (
        <button
          onClick={() => {
            tap();
            if (enough || premium) {
              onViewJourney();
            }
          }}
          className="mt-3 min-h-[40px] w-full rounded-2xl border border-calm/20 bg-button text-sm font-black text-fg"
        >
          Read Weekly Reflection
        </button>
      )}
    </section>
  );
}
