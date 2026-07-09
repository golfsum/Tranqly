"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import CoachAvatar from "@/components/CoachAvatar";
import CoachChat from "@/components/CoachChat";
import Confetti from "@/components/Confetti";
import HistoryView from "@/components/HistoryView";
import Onboarding from "@/components/Onboarding";
import OnboardingCoachMarks from "@/components/OnboardingCoachMarks";
import PremiumModal from "@/components/PremiumModal";
import SettingsView from "@/components/SettingsView";
import TabBar, { Tab } from "@/components/TabBar";
import ThemeUserAvatar from "@/components/ThemeUserAvatar";
import WeeklyInsightPreview from "@/components/WeeklyInsightPreview";
import { themeByKey } from "@/lib/themes";
import { currentStreak } from "@/lib/streak";
import { useApp } from "@/lib/store";
import { useSync } from "@/lib/sync";

export default function AppShell() {
  const hydrated = useApp((s) => s.hydrated);
  const setPremium = useApp((s) => s.setPremium);
  const name = useApp((s) => s.settings.name);
  const themeKey = useApp((s) => s.settings.theme);
  const checkIns = useApp((s) => s.checkIns);
  const { user, syncing } = useSync();

  const [tab, setTab] = useState<Tab>("today");
  const [showPremium, setShowPremium] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const [coachReplyModal, setCoachReplyModal] = useState<{
    entry: string;
    message: string;
    nextStep: string;
    pattern?: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upgrade = params.get("upgrade");
    if (upgrade === "success") {
      setPremium(true);
      setCelebrate((c) => c + 1);
      window.history.replaceState({}, "", "/");
    } else if (upgrade === "cancelled") {
      window.history.replaceState({}, "", "/");
    }
  }, [setPremium]);

  if (!hydrated) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div className="animate-pulse text-4xl">T</div>
      </main>
    );
  }

  const firstName = name.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi, ${firstName}.` : "Hi there.";
  const streak = currentStreak(checkIns);
  const theme = themeByKey(themeKey);
  const latestInsights = checkIns.filter((entry) => entry.reply).slice(0, 3);
  const openReply = (entry: string, reply: NonNullable<(typeof checkIns)[number]["reply"]>) =>
    setCoachReplyModal({
      entry,
      message: reply.message,
      nextStep: reply.nextStep,
      pattern: reply.pattern,
    });

  const activePanel = (
    <AnimatePresence mode="wait">
      {tab === "today" && (
        <motion.div
          key="today"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden short-fit:gap-1.5 lg:gap-4"
        >
          <header className="shrink-0 px-1 pt-1 short-fit:pt-0 lg:hidden">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <img src="/tranqly_logo.png" alt="" className="h-8 w-8 shrink-0 object-contain" />
                  <p className="truncate text-lg font-black tracking-tight">Tranqly: Daily Reflections</p>
                </div>
                <p className="text-xs font-medium text-dim">
                  {greeting}
                  {syncing ? " syncing" : ""}
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-edge bg-card px-3 py-1 text-xs font-bold text-dim">
                {streak} day streak
              </div>
            </div>
            <p className="mt-1 text-sm leading-snug text-dim">
              Talk for 60 seconds. Understand yourself over time.
            </p>
            <p className="mt-1 text-xs font-semibold leading-snug text-calm">
              Discover something new about yourself. Every day.
            </p>
          </header>

          <CoachChat
            onCheckedIn={() => setCelebrate((c) => c + 1)}
            onNeedPremium={() => setShowPremium(true)}
            onViewJourney={() => setTab("journey")}
            onReply={openReply}
          />
          <div className="lg:hidden">
            <WeeklyInsightPreview
              onNeedPremium={() => setShowPremium(true)}
              onViewJourney={() => setTab("journey")}
            />
          </div>
        </motion.div>
      )}

      {tab === "journey" && (
        <motion.div
          key="journey"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto"
        >
          <div className="flex flex-col gap-4 pb-4">
            <HistoryView
              onViewCoachReply={openReply}
              onNeedPremium={() => setShowPremium(true)}
            />
          </div>
        </motion.div>
      )}

      {tab === "settings" && (
        <motion.div
          key="settings"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto"
          style={{ touchAction: "pan-y" }}
        >
          <SettingsView />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <main className="min-h-dvh w-full overflow-hidden bg-bg text-fg">
      <Onboarding />
      <OnboardingCoachMarks currentTab={tab} onTabChange={setTab} />
      <Confetti trigger={celebrate} />

      <div className="mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden px-4 pt-3 short-fit:pt-2 shorter:pt-1.5 lg:hidden">
        <div className="flex min-h-0 flex-1 flex-col pb-24">
          {activePanel}
        </div>
        <TabBar tab={tab} onChange={setTab} />
      </div>

      <div className="hidden h-dvh grid-cols-[260px_minmax(0,1fr)_340px] gap-6 overflow-hidden p-6 lg:grid xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className="flex min-h-0 flex-col rounded-[2rem] border border-edge bg-card/80 p-4 shadow-card">
          <div className="mb-8 flex items-center gap-3">
            <img src="/tranqly_logo.png" alt="" className="h-12 w-12 object-contain" />
            <div>
              <p className="text-lg font-black leading-tight">Tranqly: Daily Reflections</p>
              <p className="text-xs font-bold text-calm">Private reflection</p>
            </div>
          </div>
          <nav className="flex flex-col gap-2">
            {[
              ["today", "Insights", "Daily reflection"],
              ["journey", "Journey", "Growth over time"],
              ["settings", "You", "Preferences"],
            ].map(([key, label, desc]) => {
              const active = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key as Tab)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-calm/45 bg-calm/15 text-fg"
                      : "border-transparent bg-ink/45 text-dim hover:border-edge"
                  }`}
                >
                  <span className="block text-sm font-black">{label}</span>
                  <span className="mt-0.5 block text-xs text-faint">{desc}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl border border-edge bg-ink/60 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-calm">Quick Actions</p>
            <button onClick={() => setTab("today")} className="mt-3 w-full rounded-xl bg-button px-3 py-2 text-sm font-black">
              New reflection
            </button>
            <button onClick={() => setTab("journey")} className="mt-2 w-full rounded-xl border border-edge bg-card px-3 py-2 text-sm font-bold text-dim">
              View journey
            </button>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-edge bg-ink/35 p-5 shadow-card">
          <header className="mb-5 flex shrink-0 items-start justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-calm">
                {tab === "today" ? "Insights" : tab === "journey" ? "Growth Over Time" : "Profile"}
              </p>
              <div className="mt-1 flex items-center gap-3">
                <img src="/tranqly_logo.png" alt="" className="h-10 w-10 object-contain" />
                <h1 className="text-3xl font-black tracking-tight">Tranqly: Daily Reflections</h1>
              </div>
              <p className="mt-1 text-sm text-dim">
                {greeting} Talk for 60 seconds. Understand yourself over time.
                {syncing ? " Syncing." : ""}
              </p>
            </div>
            <div className="rounded-full border border-edge bg-card px-4 py-2 text-sm font-bold text-dim">
              {streak} day streak
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden">
            {activePanel}
          </div>
        </section>

        <aside className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto">
          <section className="rounded-[2rem] border border-edge bg-card p-4 shadow-card">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-calm">Sanctuary</p>
            <div className="relative mt-3 overflow-hidden rounded-2xl border border-edge">
              <img src={theme.artwork} alt="" className="aspect-[1.35] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/85 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-lg font-black">{theme.label}</p>
                <p className="line-clamp-2 text-xs font-semibold text-dim">{theme.description}</p>
              </div>
            </div>
          </section>
          <WeeklyInsightPreview
            onNeedPremium={() => setShowPremium(true)}
            onViewJourney={() => setTab("journey")}
          />
          <section className="rounded-[2rem] border border-edge bg-card p-4 shadow-card">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-calm">Recent Insights</p>
            <div className="mt-3 flex flex-col gap-3">
              {latestInsights.length ? (
                latestInsights.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => entry.reply && openReply(entry.text, entry.reply)}
                    className="rounded-2xl border border-edge bg-ink/70 p-3 text-left"
                  >
                    <p className="line-clamp-1 text-sm font-black">{entry.reply?.title ?? "Today I noticed..."}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-dim">{entry.reply?.message}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm leading-relaxed text-faint">Insights will appear here after your reflections.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {coachReplyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setCoachReplyModal(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-edge bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setCoachReplyModal(null)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm text-dim hover:text-fg"
            >
              x
            </button>
            <div className="mb-4 flex items-center gap-3">
              <ThemeUserAvatar themeKey={themeKey} size={36} />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-calm">
                  {firstName || "You"}
                </p>
                <p className="text-sm italic text-dim">
                  &ldquo;{coachReplyModal.entry}&rdquo;
                </p>
              </div>
            </div>
            <div className="mb-3 flex items-center gap-3">
              <CoachAvatar size={30} />
              <p className="text-[11px] font-bold uppercase tracking-wide text-calm">
                Tranqly
              </p>
            </div>
            <p className="text-base leading-relaxed text-fg">
              {coachReplyModal.message}
            </p>
            <div className="mt-4 rounded-xl border border-sea/25 bg-sea/10 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sea">
                One gentle step
              </p>
              <p className="mt-0.5 text-sm">{coachReplyModal.nextStep}</p>
            </div>
            {coachReplyModal.pattern && (
              <div className="mt-3 rounded-xl border border-edge bg-ink px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-calm">
                  Pattern to watch
                </p>
                <p className="mt-0.5 text-sm text-dim">{coachReplyModal.pattern}</p>
              </div>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-edge pt-4">
              <p className="text-sm font-semibold text-faint">Was this helpful?</p>
              <div className="flex gap-2">
                <button className="rounded-full border border-edge px-3 py-1.5 text-xs font-bold text-dim">
                  Thumbs up
                </button>
                <button className="rounded-full border border-edge px-3 py-1.5 text-xs font-bold text-dim">
                  Thumbs down
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PremiumModal
        open={showPremium}
        onClose={() => setShowPremium(false)}
        onUpgraded={() => {
          setShowPremium(false);
          setCelebrate((c) => c + 1);
        }}
      />
    </main>
  );
}
