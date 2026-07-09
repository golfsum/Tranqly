"use client";

import { motion } from "framer-motion";
import { tap } from "@/lib/haptics";
import { useApp } from "@/lib/store";
import { MOODS, todayKey } from "@/lib/types";

export default function MoodPicker({ embedded = false }: { embedded?: boolean }) {
  const mood = useApp((s) => s.moods[todayKey()]);
  const setMood = useApp((s) => s.setMood);

  return (
    <section
      className={
        embedded
          ? ""
          : "rounded-xl2 border border-edge bg-card p-4 shadow-card short-fit:p-3"
      }
    >
      <h2 className="mb-2 px-1 text-sm font-semibold text-dim short-fit:mb-1.5 short-fit:text-xs shorter:hidden">
        How are you feeling? <span className="text-faint">(any answer is okay)</span>
      </h2>
      <div className="flex justify-between gap-1">
        {MOODS.map(({ key, emoji, label }) => {
          const active = mood === key;
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.85 }}
              onClick={() => {
                tap();
                setMood(key);
              }}
              className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border transition-colors short-fit:min-h-[46px] shorter:min-h-[38px] ${
                active
                  ? "border-calm/60 bg-calm/15"
                  : "border-transparent bg-ink/60"
              }`}
              aria-pressed={active}
            >
              <motion.span
                animate={active ? { scale: [1, 1.3, 1.12] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-2xl short-fit:text-xl shorter:text-lg"
              >
                {emoji}
              </motion.span>
              <span
                className={`text-[10px] font-semibold short-fit:text-[9px] shorter:text-[8px] ${
                  active ? "text-calm" : "text-faint"
                }`}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
