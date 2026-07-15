"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { tap } from "@/lib/haptics";
import { useApp } from "@/lib/store";

type InitialStep = "firstWeek" | "freeWeek";

function OnboardingCard({
  stepNumber,
  title,
  body,
  children,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  primaryDisabled = false,
  support,
}: {
  stepNumber: number;
  title: string;
  body: string;
  children?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  primaryDisabled?: boolean;
  support?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      key={title}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
      className="pointer-events-auto flex h-[min(44rem,calc(100dvh-2rem))] w-full max-w-[25rem] flex-col overflow-hidden rounded-[28px] border border-edge bg-card px-5 pb-5 pt-5 text-center shadow-card sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Tranqly onboarding"
    >
      <div className="mb-3 shrink-0">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-calm">Step {stepNumber} of 5</p>
        <div className="mx-auto mt-2 flex w-fit gap-1.5" aria-hidden>
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className={`h-1.5 w-6 rounded-full ${index < stepNumber ? "bg-calm" : "bg-ink"}`} />
          ))}
        </div>
      </div>
      <div className="flex shrink-0 justify-center">
        <img src="/tranqly_logo.png" alt="Tranqly lotus" className="h-[66px] w-[66px] object-contain drop-shadow-[0_0_20px_rgb(var(--calm-rgb)/0.28)]" />
      </div>
      <div className="mt-3 shrink-0">
        <h2 className="text-2xl font-black tracking-tight text-fg">{title}</h2>
        <p className="mx-auto mt-3 max-w-[21rem] text-[15px] leading-relaxed text-dim">{body}</p>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto py-3">{children}</div>
      <footer className="shrink-0 border-t border-edge/70 pt-4">
        <button
          disabled={primaryDisabled}
          onClick={onPrimary}
          className="flex min-h-[54px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-calm to-sea px-6 font-bold text-ink shadow-glow disabled:opacity-60"
        >
          {primaryLabel}
        </button>
        {support ? <div className="mt-2 text-xs leading-relaxed text-faint">{support}</div> : null}
        {secondaryLabel && onSecondary ? (
          <button onClick={onSecondary} className="mt-2 min-h-[44px] w-full rounded-2xl border border-edge bg-ink/65 px-4 text-sm font-bold text-dim">
            {secondaryLabel}
          </button>
        ) : null}
      </footer>
    </motion.section>
  );
}

export default function Onboarding() {
  const settings = useApp((s) => s.settings);
  const hydrated = useApp((s) => s.hydrated);
  const updateSettings = useApp((s) => s.updateSettings);
  const persistedStep = settings.currentOnboardingStep;
  const initialPersistedStep: InitialStep =
    persistedStep === "freeWeek" || persistedStep === "trial" ? "freeWeek" : "firstWeek";
  const [name, setName] = useState(settings.name ?? "");
  const [step, setStep] = useState<InitialStep>(initialPersistedStep);

  useEffect(() => {
    if (settings.onboarded) return;
    const nextStep: InitialStep =
      settings.currentOnboardingStep === "freeWeek" || settings.currentOnboardingStep === "trial"
        ? "freeWeek"
        : "firstWeek";
    setStep(nextStep);
    setName(settings.name ?? "");
  }, [settings.currentOnboardingStep, settings.name, settings.onboarded]);

  const moveTo = (next: InitialStep) => {
    tap();
    setStep(next);
    updateSettings({ onboardingStatus: "in_progress", currentOnboardingStep: next, onboardingVersion: 2 });
  };

  const beginCoachMarks = () => {
    tap();
    updateSettings({
      onboarded: true,
      name: name.trim(),
      onboardingStatus: "in_progress",
      currentOnboardingStep: "reflectionCoach",
      onboardingVersion: 2,
      onboardingCoachCompleted: false,
      onboardingCoachStep: null,
      reflectionCoachMarkSeen: false,
      journeyCoachMarkSeen: false,
      sanctuaryCoachMarkSeen: false,
      onboardingSkippedAt: null,
      onboardingCompletedAt: null,
    });
  };

  const skipAll = () => {
    const timestamp = new Date().toISOString();
    tap();
    updateSettings({
      onboarded: true,
      name: name.trim(),
      onboardingStatus: "skipped",
      currentOnboardingStep: null,
      onboardingVersion: 2,
      onboardingCoachCompleted: true,
      onboardingCoachStep: null,
      reflectionCoachMarkSeen: true,
      journeyCoachMarkSeen: true,
      sanctuaryCoachMarkSeen: true,
      onboardingSkippedAt: timestamp,
      onboardingCompletedAt: timestamp,
    });
  };

  const open = hydrated && !settings.onboarded && settings.onboardingStatus !== "skipped";

  return (
    <AnimatePresence mode="wait">
      {open ? (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md" />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))]">
            {step === "firstWeek" ? (
              <OnboardingCard
                stepNumber={1}
                title="Your first week with Tranqly"
                body="Over the next seven days, Tranqly will help you reflect, notice recurring themes, and prepare your first weekly reflection."
                primaryLabel="Next"
                onPrimary={() => moveTo("freeWeek")}
              >
                <ol className="space-y-2.5 text-left">
                  {[
                    ["Today", "Take a minute to reflect by voice or text."],
                    ["Over the next week", "Every reflection helps Tranqly notice the themes and moments that matter most to you."],
                    ["Day 7", "At the end of your first week, you will receive a personalized weekly reflection that brings together everything you shared."],
                  ].map(([title, body]) => (
                    <li key={title} className="rounded-2xl border border-edge bg-ink/65 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-calm">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-dim">{body}</p>
                    </li>
                  ))}
                </ol>
                <div className="mx-auto mt-6 w-full max-w-[21rem] text-left">
                  <label htmlFor="onboarding-name" className="mb-2 block text-sm font-semibold text-dim">What should I call you? (Optional)</label>
                  <input
                    id="onboarding-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && moveTo("freeWeek")}
                    placeholder="Your name"
                    autoComplete="given-name"
                    className="min-h-[52px] w-full rounded-2xl border border-edge bg-ink px-4 text-left text-fg placeholder-faint outline-none transition focus:border-calm focus:ring-2 focus:ring-calm/20"
                  />
                </div>
              </OnboardingCard>
            ) : null}

            {step === "freeWeek" ? (
              <OnboardingCard
                stepNumber={2}
                title="Begin your journey"
                body="Your first week is on us. Reflect for seven days, receive your first weekly reflection, then decide whether you'd like to continue."
                primaryLabel="Begin your journey"
                onPrimary={beginCoachMarks}
                support="No payment required. Nothing renews automatically."
              >
                <ol className="space-y-2 text-left">
                  {[
                    ["Today", "Begin reflecting with full access to Tranqly."],
                    ["During the week", "Receive thoughtful responses and begin building your first weekly reflection."],
                    ["Day 7", "Your first weekly reflection will be ready. After you read it, you can decide whether you would like to continue."],
                  ].map(([day, title, body]) => (
                    <li key={day} className="rounded-2xl border border-edge bg-ink/65 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-calm">{day}</p>
                      <p className="mt-1 text-sm leading-relaxed text-dim">{title}</p>
                    </li>
                  ))}
                </ol>
              </OnboardingCard>
            ) : null}
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
