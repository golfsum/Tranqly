"use client";

import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { currentStreak, lastNDays } from "@/lib/streak";
import { growthEmoji, todayKey } from "@/lib/types";

/**
 * Slim one-row streak summary for the no-scroll Today screen.
 * The growth emoji pops whenever the streak changes.
 */
export default function StreakStrip() {
  const checkIns = useApp((s) => s.checkIns);
  const streak = currentStreak(checkIns);
  const week = lastNDays(checkIns, 7);

  return (
    <section className="flex shrink-0 items-center justify-between rounded-xl2 border border-edge bg-card px-4 py-2.5 shadow-card short-fit:px-3 short-fit:py-2 shorter:py-1.5">
      <div className="flex items-center gap-2.5 shorter:gap-2">
        <motion.span
          key={streak}
          initial={{ scale: 0.4, rotate: -16, opacity: 0 }}
          animate={{ scale: [0.4, 1.3, 1], rotate: [-16, 8, 0], opacity: 1 }}
          transition={{ duration: 0.7, times: [0, 0.6, 1], ease: "easeOut" }}
          className="text-2xl short-fit:text-xl shorter:text-lg"
          style={{ filter: "drop-shadow(0 0 10px rgb(var(--sea-rgb) / 0.45))" }}
        >
          {growthEmoji(streak)}
        </motion.span>
        <p className="text-sm font-semibold short-fit:text-xs shorter:text-[11px]">
          <span className="text-gradient text-lg font-extrabold tabular-nums short-fit:text-base shorter:text-sm">
            {streak}
          </span>{" "}
          <span className="text-dim">
            day{streak === 1 ? "" : "s"} of showing up
          </span>
        </p>
      </div>

      <div className="flex items-center gap-1">
        {week.map(({ key, count }) => {
          const isToday = key === todayKey();
          return (
            <span
              key={key}
              title={key}
              className={`h-2.5 w-2.5 rounded-full ${
                count > 0
                  ? "bg-gradient-to-br from-calm to-sea"
                  : isToday
                  ? "border border-dashed border-faint"
                  : "bg-ink"
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}
