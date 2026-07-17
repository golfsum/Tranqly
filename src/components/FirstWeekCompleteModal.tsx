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
  const gains = [
    effectiveDays >= 3 ? "Your first Weekly Reflection" : "A weekly reflection beginning to form",
    "Personalized AI insights",
    effectiveDays >= 3 ? "Your first emotional patterns" : "The first moments Tranqly can learn from",
    ...(rewardUnlocked ? ["Forest Haven, yours to keep"] : []),
    `${effectiveDays || "A few"} meaningful reflection ${effectiveDays === 1 ? "day" : "days"}`,
  ];
  const nextWeek = [
    "Deeper patterns across more of your days",
    "Reflections that remember more about you",
    "A Weekly Reflection that becomes more personal",
    "Progress toward your next sanctuary",
  ];
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
            aria-label="Your first week reflection"
          >
            <div className="shrink-0 border-b border-edge/70 p-5 pb-4">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-edge" />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-calm/30 bg-calm/10 text-xl text-calm" aria-hidden="true">&#10022;</div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-calm">Your first week</p>
                <h2 className="mt-1 text-3xl font-black leading-tight">
                  {rewardUnlocked ? "You've completed your first week." : "Your first week is ready to revisit."}
                </h2>
                <p className="mt-2 text-sm font-bold leading-relaxed text-dim">
                  {rewardUnlocked
                    ? "Seven days ago you began reflecting. Tranqly is already beginning to understand what helps you feel more like yourself."
                    : "What you shared has given Tranqly a meaningful place to begin. Your reflections will always be here when you want to return."}
                </p>
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
              {summary.map((item, index) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.08 * index, type: "spring", stiffness: 260, damping: 20 }}
                  className="rounded-2xl border border-calm/30 bg-calm/10 p-2 text-center shadow-glow"
                >
                  <span className="mx-auto mb-1 grid h-5 w-5 place-items-center rounded-full border border-calm/60 text-[11px] font-black text-calm" aria-hidden="true">&#10003;</span>
                  <p className="text-[11px] font-black leading-snug text-fg">{item}</p>
                </motion.div>
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
              <p className="mt-2 text-sm leading-relaxed text-dim">
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
                      You've started building your sanctuary collection. Forest Haven is now yours forever.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <section className="mt-4 rounded-3xl border border-edge bg-ink/60 p-4">
              <h3 className="text-lg font-black">This Week You Gained</h3>
              <div className="mt-3 space-y-2.5">
                {gains.map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm font-bold leading-relaxed text-dim">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-calm/50 text-[11px] text-calm" aria-hidden="true">&#10003;</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-calm/25 bg-calm/10 p-4">
              <h3 className="text-lg font-black">Next Week You'll Discover</h3>
              <div className="mt-3 space-y-2.5">
                {nextWeek.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-bold leading-relaxed text-dim">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-calm" aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="my-5 h-px bg-edge" />

            <div>
              <h3 className="text-left text-2xl font-black">Continue Your Journey</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">
                Every reflection teaches Tranqly a little more about you. The more you share, the more personal your insights become.
              </p>
              <p className="mt-2 text-sm font-black leading-relaxed text-calm">
                Your journey has already begun. The weeks ahead are where your insights become even more personal.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={selectedPlan === "yearly"}
                  onClick={() => setSelectedPlan("yearly")}
                  className={`min-h-28 rounded-2xl border px-3 py-3 text-left ${selectedPlan === "yearly" ? "border-calm bg-calm/10 shadow-glow" : "border-edge bg-ink"}`}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-black">
                    Yearly <span className="text-[9px] uppercase tracking-wider text-calm">Best value</span>
                  </span>
                  <span className="mt-1 block text-sm font-bold">$59.99 per year</span>
                  <span className="block text-xs text-faint">About $5 per month. Save compared to monthly.</span>
                </button>
                <button
                  type="button"
                  aria-pressed={selectedPlan === "monthly"}
                  onClick={() => setSelectedPlan("monthly")}
                  className={`rounded-2xl border px-3 py-3 text-left ${selectedPlan === "monthly" ? "border-calm bg-calm/10" : "border-edge bg-ink"}`}
                >
                  <span className="block text-sm font-black">Monthly</span>
                  <span className="mt-1 block text-sm font-bold">$5.99 per month</span>
                  <span className="block text-xs text-faint">Continue month to month.</span>
                </button>
              </div>
              <p className="mt-3 text-center text-xs font-bold leading-relaxed text-faint">
                Your first week, Weekly Reflection, and unlocked sanctuaries remain yours whether you continue or not.
              </p>
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
                Continue my Journey
              </button>
              <button
                type="button"
                onClick={onNotNow}
                className="mt-2 min-h-[44px] w-full text-sm font-bold text-faint"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
