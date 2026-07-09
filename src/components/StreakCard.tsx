"use client";

import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { bestStreak, currentStreak, lastNDays } from "@/lib/streak";
import { growthEmoji, todayKey } from "@/lib/types";

export default function StreakCard() {
  const checkIns = useApp((s) => s.checkIns);

  const streak = currentStreak(checkIns);
  const best = bestStreak(checkIns);
  const week = lastNDays(checkIns, 7);

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-xl2 border border-edge bg-card p-5 shadow-card short-fit:p-3"
    >
      <div className="aura pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full bg-calm/15 blur-3xl" />

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <motion.span
              key={streak}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="text-gradient text-5xl font-extrabold tabular-nums short-fit:text-3xl"
            >
              {streak}
            </motion.span>
            <span className="text-lg font-semibold text-dim short-fit:text-sm">
              day{streak === 1 ? "" : "s"} of showing up
            </span>
          </div>
          <p className="mt-1 text-sm text-dim short-fit:text-xs">
            {streak === 0
              ? "Today is a lovely day to begin"
              : streak >= best && streak > 1
                ? "Your longest stretch yet, beautifully done"
                : `Longest so far: ${best} days`}
          </p>
        </div>
        <motion.div
          key={streak}
          initial={{ scale: 0.4, rotate: -16, opacity: 0 }}
          animate={{
            scale: [0.4, 1.25, 1],
            rotate: [-16, 8, 0],
            opacity: 1,
          }}
          transition={{ duration: 0.7, times: [0, 0.6, 1], ease: "easeOut" }}
          className="text-6xl short-fit:text-4xl"
          style={{ filter: "drop-shadow(0 0 18px rgb(var(--sea-rgb) / 0.45))" }}
        >
          {growthEmoji(streak)}
        </motion.div>
      </div>

      <div className="mt-4 flex justify-between short-fit:mt-2">
        {week.map(({ key, count }) => {
          const d = new Date(key + "T12:00:00");
          const isToday = key === todayKey();
          return (
            <div key={key} className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm short-fit:h-6 short-fit:w-6 short-fit:text-xs ${
                  count > 0
                    ? "bg-gradient-to-br from-calm to-sea"
                    : isToday
                      ? "border-2 border-dashed border-faint"
                      : "bg-ink"
                }`}
              >
                {count > 0 ? "✓" : ""}
              </span>
              <span
                className={`text-[10px] font-medium ${
                  isToday ? "text-fg" : "text-faint"
                }`}
              >
                {d.toLocaleDateString(undefined, { weekday: "narrow" })}
              </span>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
