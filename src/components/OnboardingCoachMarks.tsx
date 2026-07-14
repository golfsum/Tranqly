"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { tap } from "@/lib/haptics";
import { useApp } from "@/lib/store";
import { createFirstWeekAccess } from "@/lib/access";

type CoachStep = "reflectionCoach" | "journeyCoach" | "sanctuaryCoach";
type TargetRect = { left: number; top: number; width: number; height: number; centerX: number; centerY: number };

const STEP_COPY: Record<CoachStep, { target: string; label: string; title: string; body: string; index: number }> = {
  reflectionCoach: {
    target: "mic",
    label: "Today's Reflection",
    title: "Your first reflection",
    body: "Tap the microphone to speak, or type in the box below.",
    index: 3,
  },
  journeyCoach: {
    target: "journey",
    label: "Journey",
    title: "Your Journey",
    body: "Watch your reflections become a story over time.",
    index: 4,
  },
  sanctuaryCoach: {
    target: "sanctuary",
    label: "Sanctuary",
    title: "Your sanctuary",
    body: "Choose the environment that feels most calming while you reflect.",
    index: 5,
  },
};

export default function OnboardingCoachMarks({ onComplete }: { onComplete?: () => void }) {
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const reduceMotion = useReducedMotion();
  const [showComplete, setShowComplete] = useState(false);
  const step = settings.onboardingStatus === "in_progress" &&
    (settings.currentOnboardingStep === "reflectionCoach" || settings.currentOnboardingStep === "journeyCoach" || settings.currentOnboardingStep === "sanctuaryCoach")
    ? settings.currentOnboardingStep
    : null;
  const [target, setTarget] = useState<TargetRect | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!step) {
      setReady(false);
      setTarget(null);
      return;
    }
    setReady(false);
    setTarget(null);
    const measure = () => {
      const element = [...document.querySelectorAll<HTMLElement>(`[data-onboarding-target="${STEP_COPY[step].target}"]`)]
        .find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      if (!element) {
        setTarget(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      setTarget({ left: rect.left, top: rect.top, width: rect.width, height: rect.height, centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2 });
    };
    const frame = requestAnimationFrame(measure);
    const delayed = window.setTimeout(measure, 80);
    const reveal = window.setTimeout(() => setReady(true), 240);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(delayed);
      window.clearTimeout(reveal);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  if (!step && !showComplete) return null;

  if (showComplete) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
        className="fixed inset-0 z-[60] grid place-items-center bg-black/55 px-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-label="Onboarding complete"
      >
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ width: "min(20rem, calc(100vw - 2rem))" }}
          className="rounded-[1.5rem] border border-calm/40 bg-card/95 p-5 text-center shadow-card"
        >
          <h2 className="text-2xl font-black tracking-tight text-fg">You're all set</h2>
          <p className="mx-auto mt-3 text-sm leading-relaxed text-dim">
            Your first week starts now. Take your time. Your first weekly reflection will be waiting in seven days.
          </p>
          <button
            onClick={() => {
              tap();
              setShowComplete(false);
              onComplete?.();
            }}
            className="mt-5 min-h-[46px] w-full rounded-2xl bg-gradient-to-r from-calm to-sea px-4 text-sm font-black text-ink shadow-glow"
          >
            Start reflecting
          </button>
        </motion.div>
      </motion.div>
    );
  }

  if (!step || !ready) return null;
  const copy = STEP_COPY[step];

  const skip = () => {
    const timestamp = new Date().toISOString();
    tap();
    updateSettings({
      onboardingStatus: "skipped",
      currentOnboardingStep: null,
      onboardingCoachCompleted: true,
      onboardingCoachStep: null,
      reflectionCoachMarkSeen: true,
      journeyCoachMarkSeen: true,
      sanctuaryCoachMarkSeen: true,
      onboardingSkippedAt: timestamp,
      onboardingCompletedAt: timestamp,
      complimentaryAccess: settings.complimentaryAccess ?? createFirstWeekAccess(),
    });
    onComplete?.();
  };

  const next = () => {
    tap();
    setTarget(null);
    setReady(false);
    if (step === "reflectionCoach") {
      updateSettings({ currentOnboardingStep: "journeyCoach", reflectionCoachMarkSeen: true });
      return;
    }
    if (step === "journeyCoach") {
      updateSettings({ currentOnboardingStep: "sanctuaryCoach", journeyCoachMarkSeen: true });
      return;
    }
    const timestamp = new Date().toISOString();
    updateSettings({
      onboardingStatus: "completed",
      currentOnboardingStep: null,
      onboardingCoachCompleted: true,
      onboardingCoachStep: null,
      reflectionCoachMarkSeen: true,
      journeyCoachMarkSeen: true,
      sanctuaryCoachMarkSeen: true,
      onboardingCompletedAt: timestamp,
      complimentaryAccess: settings.complimentaryAccess ?? createFirstWeekAccess(),
    });
    setShowComplete(true);
  };

  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 390 : window.innerWidth;
  const estimatedCardHeight = 166;
  const cardTop = target
    ? step === "reflectionCoach"
      ? Math.min(viewportHeight - estimatedCardHeight - 96, Math.max(20, viewportHeight * 0.58))
      : Math.min(viewportHeight - estimatedCardHeight - 20, Math.max(20, target.top - estimatedCardHeight - 14))
    : Math.max(20, viewportHeight * 0.58);
  const pointerX = target ? Math.min(viewportWidth - 28, Math.max(28, target.centerX)) : viewportWidth / 2;
  const pointerStartY = step === "reflectionCoach" ? cardTop : Math.min(viewportHeight - 8, cardTop + estimatedCardHeight);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
      className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`${copy.label} introduction`}
    >
      {target ? (
        <motion.div
          aria-hidden
          data-testid="coach-target-highlight"
          className="pointer-events-none fixed rounded-full border-2 border-calm shadow-[0_0_0_7px_rgb(var(--calm-rgb)/0.14),0_0_30px_rgb(var(--calm-rgb)/0.75)]"
          animate={{ left: target.left - 8, top: target.top - 8, width: target.width + 16, height: target.height + 16 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.22 }}
        />
      ) : null}
      <motion.div
        key={step}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed left-4 right-4 mx-auto max-w-sm"
        style={{ top: cardTop }}
      >
        <div className="relative z-10 rounded-[1.25rem] border border-calm/40 bg-card/95 p-3.5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-calm">{copy.label}</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-fg">{copy.title}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <p className="rounded-full border border-edge bg-ink/70 px-2.5 py-1 text-[10px] font-black text-faint">Step {copy.index} of 5</p>
              <button
                onClick={skip}
                aria-label="Skip onboarding"
                className="grid h-7 w-7 place-items-center rounded-full border border-edge bg-ink/70 text-xs font-black text-faint"
              >
                X
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-dim">{copy.body}</p>
          <button onClick={next} className="mt-3 min-h-[42px] w-full rounded-2xl bg-gradient-to-r from-calm to-sea px-4 text-sm font-black text-ink shadow-glow">
            {step === "sanctuaryCoach" ? "Done" : "Next"}
          </button>
        </div>
      </motion.div>
      {target ? (
        <svg aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full overflow-visible">
          <path
            d={`M ${pointerX} ${pointerStartY} Q ${pointerX} ${(pointerStartY + target.centerY) / 2} ${target.centerX} ${target.centerY}`}
            fill="none"
            stroke="rgb(var(--calm-rgb))"
            strokeWidth="2"
            strokeDasharray="5 7"
            opacity="0.85"
          />
          <circle cx={target.centerX} cy={target.centerY} r="4" fill="rgb(var(--calm-rgb))" />
        </svg>
      ) : null}
    </motion.div>
  );
}
