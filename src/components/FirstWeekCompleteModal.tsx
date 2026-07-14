"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { themeByKey } from "@/lib/themes";
import type { DeepInsight } from "@/lib/types";

export default function FirstWeekCompleteModal({
  open,
  insight,
  reflectionDays = 0,
  reflectionCount = 0,
  onNotNow,
  onContinue,
}: {
  open: boolean;
  insight?: DeepInsight | null;
  reflectionDays?: number;
  reflectionCount?: number;
  onNotNow: () => void;
  onContinue: (plan: "monthly" | "yearly") => void;
}) {
  const [selectedPlan, setSelectedPlan] = useState<"yearly" | "monthly">("yearly");
  const forestTheme = themeByKey("forest");
  const effectiveDays = reflectionDays;
  const effectiveCount = reflectionCount;
  const rewardUnlocked = effectiveDays === 7;
  const planLabel = selectedPlan === "yearly" ? "Yearly plan selected" : "Monthly plan selected";
  const planBilling = selectedPlan === "yearly" ? "$59.99 billed annually" : "$5.99 billed monthly";
  const summary =
    effectiveDays >= 7
      ? ["7 reflection days", "1 weekly reflection", "Forest Haven unlocked"]
      : effectiveDays >= 2
        ? [`${effectiveDays} reflection days`, "1 weekly reflection", "A few meaningful themes noticed"]
          : effectiveDays === 1
          ? ["1 reflection day", "1 weekly reflection", "1 moment worth revisiting"]
          : ["Your space is still here", "1 gentle weekly note"];
  const reflectionText = (insight?.insight ??
    (effectiveCount > 0
      ? "You took time to check in with yourself this week. What you shared may not form a full pattern yet, but it still gives you something meaningful to return to."
      : "You did not share a reflection this week, so there is not a personal pattern to bring together yet. Your space is still here whenever you feel ready to return."))
    .replace(
      /Across these seven reflections, Tranqly noticed a clear thread:/i,
      "Across your reflections this week, a clear thread appeared:"
    )
    .replace(
      /Across these seven reflections/i,
      "Across your reflections this week"
    )
    .replace(
      /You were beginning to notice which moments helped you feel steadier and return to yourself\./i,
      "You began noticing which moments helped you feel steadier and more like yourself."
    );
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm"
            onClick={onNotNow}
          />
          <motion.div
            initial={{ opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="fixed inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),1rem)] z-[61] mx-auto flex max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-calm/30 bg-card shadow-card"
            role="dialog"
            aria-modal="true"
            aria-label="Your first week is complete"
          >
            <div className="shrink-0 border-b border-edge/70 p-5 pb-4">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-edge" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-calm">Day 7</p>
                <h2 className="mt-1 text-3xl font-black leading-tight">Your first week is complete.</h2>
              </div>
              <button
                type="button"
                onClick={onNotNow}
                aria-label="Close"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-edge bg-ink text-sm font-black text-dim"
              >
                x
              </button>
            </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-32">

            <div className="mb-4 grid grid-cols-3 gap-2">
              {summary.map((item) => (
                <div key={item} className="rounded-2xl border border-edge bg-ink/60 p-2 text-center">
                  <p className="text-[11px] font-black leading-snug text-dim">{item}</p>
                </div>
              ))}
            </div>
            {!rewardUnlocked && effectiveDays > 0 ? (
              <p className="mb-4 rounded-2xl border border-edge bg-ink/50 px-3 py-2 text-sm font-bold leading-relaxed text-dim">
                You made meaningful space for yourself throughout the week.
              </p>
            ) : null}

            <section className="rounded-3xl border border-edge bg-ink/75 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-calm">Weekly reflection</p>
              <h3 className="mt-2 text-xl font-black">
                {insight?.headline ?? "A few moments from your week"}
              </h3>
              <p className="mt-2 line-clamp-5 text-sm leading-relaxed text-dim">
                {reflectionText}
              </p>
              <div className="mt-3 rounded-2xl border border-calm/20 bg-calm/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-calm">{insight?.gentleFocusTitle ?? "Next gentle focus"}</p>
                <p className="mt-1 text-sm leading-relaxed text-fg">
                  {insight?.suggestion ?? "Notice one moment this week where you feel a little more settled, supported, or clear."}
                </p>
              </div>
            </section>

            {rewardUnlocked ? (
              <div className="mt-4 rounded-3xl border border-calm/30 bg-calm/10 p-3">
                <div className="flex gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-edge bg-ink">
                    <img src={forestTheme.artwork} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-calm">Seven days of reflection</p>
                    <h3 className="mt-1 text-lg font-black">Forest Haven unlocked</h3>
                    <p className="mt-1 text-sm leading-relaxed text-dim">
                      You made space for yourself every day this week. Forest Haven is now available in your sanctuary collection.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="my-5 h-px bg-edge" />

            <div>
              <h3 className="text-left text-2xl font-black">Continue your journey</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">
                Keep receiving thoughtful responses, weekly reflections, and insights that build on what you share.
              </p>
              <p className="mt-2 text-xs font-bold leading-relaxed text-faint">
                Your first week and existing reflections will remain yours whether you continue or not.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={selectedPlan === "monthly"}
                  onClick={() => setSelectedPlan("monthly")}
                  className={`rounded-2xl border px-3 py-3 text-left ${selectedPlan === "monthly" ? "border-calm bg-calm/10" : "border-edge bg-ink"}`}
                >
                  <span className="block text-sm font-black">Monthly</span>
                  <span className="mt-1 block text-sm font-bold">$5.99 per month</span>
                  <span className="block text-xs text-faint">Billed monthly</span>
                </button>
                <button
                  type="button"
                  aria-pressed={selectedPlan === "yearly"}
                  onClick={() => setSelectedPlan("yearly")}
                  className={`rounded-2xl border px-3 py-3 text-left ${selectedPlan === "yearly" ? "border-calm bg-calm/10" : "border-edge bg-ink"}`}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-black">
                    Yearly <span className="text-[9px] uppercase tracking-wider text-calm">Best value</span>
                  </span>
                  <span className="mt-1 block text-sm font-bold">$59.99 per year</span>
                  <span className="block text-xs text-faint">About $5 per month</span>
                </button>
              </div>
            </div>
            </div>

            <div className="shrink-0 border-t border-edge bg-card/95 px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur">
              <div className="mb-3 rounded-2xl border border-edge bg-ink/70 px-4 py-3">
                <p className="text-sm font-black text-fg">{planLabel}</p>
                <p className="mt-0.5 text-xs font-bold text-dim">{planBilling}</p>
              </div>
              <button
                type="button"
                onClick={() => onContinue(selectedPlan)}
                className="min-h-[50px] w-full rounded-2xl bg-gradient-to-r from-calm to-sea text-sm font-black text-ink shadow-glow"
              >
                Begin Week Two
              </button>
              <button
                type="button"
                onClick={onNotNow}
                className="mt-2 min-h-[44px] w-full text-sm font-bold text-faint"
              >
                Not now
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
