"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { success, tap } from "@/lib/haptics";
import { localDeepInsight } from "@/lib/coach";
import { useApp } from "@/lib/store";
import { currentStreak } from "@/lib/streak";
import { DeepInsight } from "@/lib/types";

export default function DeepInsightCard({
  onNeedPremium,
}: {
  onNeedPremium: () => void;
}) {
  const checkIns = useApp((s) => s.checkIns);
  const moods = useApp((s) => s.moods);
  const name = useApp((s) => s.settings.name);
  const premium = useApp((s) => s.settings.premium);
  const lastDeepInsight = useApp((s) => s.lastDeepInsight);
  const setDeepInsight = useApp((s) => s.setDeepInsight);

  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    tap();
    if (!premium) {
      onNeedPremium();
      return;
    }
    setLoading(true);
    const streak = currentStreak(checkIns);
    const recentEntries = checkIns.slice(0, 40);
    const reflectionDays = new Set(recentEntries.map((entry) => entry.dateKey)).size;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          userPlan: premium ? "plus" : "free",
          streak,
          totalEntries: checkIns.length,
          reflectionDays,
          recentEntries: recentEntries.map((c) => ({
            text: c.text,
            dateKey: c.dateKey,
            prompt: c.prompt,
            dailyInsight: c.reply?.preview ?? c.reply?.summary ?? c.reply?.message,
          })),
          recentMoods: Object.entries(moods)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 14)
            .map(([dateKey, mood]) => ({ dateKey, mood })),
        }),
      });
      const data = await res.json();
      const insight: DeepInsight = data.fallback
        ? localDeepInsight(checkIns, moods, streak)
        : { ...data, createdAt: new Date().toISOString() };
      setDeepInsight(insight);
      success();
    } catch {
      setDeepInsight(localDeepInsight(checkIns, moods, streak));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="shrink-0 rounded-xl2 border border-calm/25 bg-gradient-to-br from-card to-[#171430] p-3 shadow-card short-fit:p-2.5">
      <div className="flex items-center justify-between short-fit:flex-1">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            🔮
          </span>
          <h2 className="text-sm font-semibold text-dim short-fit:text-xs">Deeper insight</h2>
        </div>
        {!premium && (
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-calm">
            Premium
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {premium && lastDeepInsight && !loading && (
          <motion.div
            key={lastDeepInsight.createdAt}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex flex-col gap-2.5"
          >
            <h3 className="text-lg font-bold leading-snug">
              {lastDeepInsight.headline}
            </h3>
            <p className="text-sm leading-relaxed text-dim">
              {lastDeepInsight.insight}
            </p>
            <div className="rounded-2xl border border-calm/25 bg-calm/10 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-calm">
                This week&apos;s experiment
              </p>
              <p className="mt-1 text-sm">{lastDeepInsight.suggestion}</p>
            </div>
            <p className="text-sm italic text-sea">
              &quot;{lastDeepInsight.affirmation}&quot;
            </p>
          </motion.div>
        )}

        {!premium && (
          <motion.p
            key="locked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 hidden text-sm leading-relaxed text-dim short-fit:mt-1.5"
          >
            A weekly look across all your reflections, the patterns, the quiet
            progress, and one gentle experiment for the week ahead.
          </motion.p>
        )}

        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex flex-col gap-2"
          >
            {[0.9, 0.7, 0.5].map((w, i) => (
              <motion.div
                key={i}
                className="h-4 rounded bg-ink"
                style={{ width: `${w * 100}%` }}
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={analyze}
        disabled={loading}
        className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-calm to-sea font-bold text-ink shadow-glow disabled:opacity-60 short-fit:mt-1.5 short-fit:min-h-[38px] short-fit:text-sm"
      >
        {loading
          ? "Reflecting on your journey..."
          : premium
            ? lastDeepInsight
              ? "Reflect again"
              : "Reveal my patterns"
            : "🔒 Unlock deeper insights"}
      </motion.button>
    </section>
  );
}
