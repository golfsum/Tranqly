"use client";

import { useEffect } from "react";
import type { Tab } from "./TabBar";
import { useApp } from "@/lib/store";

type CoachStep = "mic" | "journey" | "sanctuary";

const STEP_COPY: Record<CoachStep, { title: string; body: string; tab: Tab; action: string; label: string; index: number }> = {
  mic: {
    title: "Your first reflection",
    body: "Talk for up to 60 seconds, or type instead.",
    tab: "today",
    action: "Continue →",
    label: "Today's Reflection",
    index: 1,
  },
  journey: {
    title: "Watch your journey grow",
    body: "Your reflections help unlock peaceful sanctuary themes over time.",
    tab: "journey",
    action: "Continue →",
    label: "Journey",
    index: 2,
  },
  sanctuary: {
    title: "Your sanctuary is waiting.",
    body: "As you reflect, you'll unlock peaceful new sanctuaries to explore.",
    tab: "settings",
    action: "Done",
    label: "Sanctuary",
    index: 3,
  },
};

function nowIso() {
  return new Date().toISOString();
}

export default function OnboardingCoachMarks({
  currentTab,
  onTabChange,
}: {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const step = settings.onboardingCoachStep;
  const open = Boolean(settings.onboarded && !settings.onboardingCoachCompleted && step);
  const copy = step ? STEP_COPY[step as CoachStep] : null;

  useEffect(() => {
    if (!open || !copy || currentTab === copy.tab) return;
    onTabChange(copy.tab);
  }, [copy, currentTab, onTabChange, open]);

  if (!open || !copy || !step) return null;

  const finish = (skipped: boolean) => {
    updateSettings({
      onboardingCoachCompleted: true,
      onboardingCoachStep: null,
      onboardingSkippedAt: skipped ? nowIso() : settings.onboardingSkippedAt ?? null,
      onboardingCompletedAt: nowIso(),
    });
    if (!skipped) onTabChange("today");
  };

  const next = () => {
    if (step === "mic") {
      updateSettings({ onboardingCoachStep: "journey" });
      onTabChange("journey");
      return;
    }
    if (step === "journey") {
      updateSettings({ onboardingCoachStep: "sanctuary" });
      onTabChange("settings");
      return;
    }
    finish(false);
  };

  const placement =
    step === "mic"
      ? "bottom-[7.25rem] left-4 right-4 mx-auto max-w-sm lg:left-[calc(260px+2rem)] lg:right-auto lg:bottom-10"
      : step === "journey"
        ? "bottom-[7.25rem] left-4 right-4 mx-auto max-w-sm lg:left-[calc(260px+2rem)] lg:right-auto lg:bottom-10"
        : "bottom-[7.25rem] left-4 right-4 mx-auto max-w-sm lg:right-[calc(340px+2rem)] lg:left-auto lg:bottom-10";

  return (
    <div className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]">
      <div className={`absolute ${placement}`}>
        <div className="rounded-[1.5rem] border border-calm/35 bg-card/95 p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-calm">
                {copy.label}
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-fg">{copy.title}</h2>
            </div>
            <button
              aria-label="Skip onboarding"
              onClick={() => finish(true)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-edge bg-ink text-dim"
            >
              x
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-dim">{copy.body}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-faint">{copy.index} of 3</p>
            <button
              onClick={() => finish(true)}
              className="text-xs font-bold text-faint"
            >
              Skip
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={next}
              className="min-h-[46px] flex-1 rounded-2xl bg-gradient-to-r from-calm to-sea px-4 text-sm font-black text-ink shadow-glow"
            >
              {copy.action}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
