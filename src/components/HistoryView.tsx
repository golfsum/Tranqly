"use client";

import { useMemo, useState } from "react";
import { SanctuaryCard, SanctuaryCollection, SanctuaryCollectionModal, SanctuaryModal } from "./Sanctuary";
import { isDemoCheckIn } from "@/lib/demoData";
import { bestStreak, currentStreak } from "@/lib/streak";
import { useApp } from "@/lib/store";
import type { CheckIn, CoachReply, DeepInsight } from "@/lib/types";
import { currentWeekReflectionDayCount } from "@/lib/sanctuaryProgress";
import { hasTranqlyAccess } from "@/lib/access";

const TAG_RULES = [
  { key: "calm", label: "Calm", pattern: /calm|peace|slow|quiet|rest|walk|outside|breathe|present/i },
  { key: "stress", label: "Stress", pattern: /stress|busy|overwhelm|anxious|pressure|tired|hard|deadline/i },
  { key: "gratitude", label: "Gratitude", pattern: /grateful|thankful|appreciate|love|proud|good|win/i },
  { key: "exercise", label: "Exercise", pattern: /walk|run|gym|workout|exercise|outside|hike|bike/i },
  { key: "family", label: "Family", pattern: /family|mom|dad|parent|child|kids|partner|wife|husband|sister|brother/i },
  { key: "work", label: "Work", pattern: /work|job|meeting|boss|client|deadline|office|project/i },
];

type JourneyTag = (typeof TAG_RULES)[number];
type MonthIconTone = "calm" | "consistency" | "gratitude" | "stress";
type JourneyTagKey = JourneyTag["key"];

const monthIconColors: Record<MonthIconTone, string> = {
  calm: "#A6A6FF",
  consistency: "#76E0D3",
  gratitude: "#F5BD6D",
  stress: "#FF7272",
};

function tagsForText(text: string): JourneyTag[] {
  const tags = TAG_RULES.filter((rule) => rule.pattern.test(text));
  return tags.length ? tags : [TAG_RULES[0]];
}

function TagIcon({ type }: { type: JourneyTagKey }) {
  const common = {
    className: "h-3.5 w-3.5 text-faint",
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  };
  if (type === "work") {
    return (
      <svg {...common}>
        <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M5 7h14a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" />
        <path d="M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "stress") {
    return (
      <svg {...common}>
        <path d="M9 18a4 4 0 0 1-4-4c0-1.7 1-3.2 2.5-3.8A4.5 4.5 0 0 1 16 8.5a3.8 3.8 0 0 1 3 6.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 12v4M16 12v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "gratitude" || type === "family") {
    return (
      <svg {...common}>
        <path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "exercise") {
    return (
      <svg {...common}>
        <path d="M6 19c2.5-1.2 4.2-3.1 5-5.7M11 13.3l3 2.7M10 8l3 2 3-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="5" r="2" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 19c-4-4.4-4-9.5 0-14 4 4.5 4 9.6 0 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18c3.3-1.4 10.7-1.4 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function countMatches(entries: { text: string }[], pattern: RegExp) {
  return entries.reduce((total, entry) => total + (entry.text.match(pattern) ?? []).length, 0);
}

function buildJourneyInsights(checkIns: CheckIn[], coachNotes: string[]) {
  const sorted = [...checkIns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const topTags = TAG_RULES.map((tag) => ({
    ...tag,
    count: sorted.filter((entry) => tag.pattern.test(entry.text)).length,
  })).sort((a, b) => b.count - a.count);
  const activeTags = topTags.filter((tag) => tag.count > 0).slice(0, 3);
  const workStress = countMatches(sorted, /work|job|meeting|deadline|boss|client/gi);
  const walks = countMatches(sorted, /walk|outside|hike|park|fresh air/gi);
  const gratitude = countMatches(sorted, /grateful|thankful|appreciate|love|proud|win/gi);
  const stress = countMatches(sorted, /stress|overwhelm|anxious|pressure|hard|tired/gi);
  const calm = countMatches(sorted, /calm|peace|slow|quiet|rest|present/gi);
  const memoryFacts = [
    walks > 0 ? "Walking or outside time has appeared often." : "Tranqly is still learning what helps clear your mind.",
    workStress > 0 ? "Work stress tends to show up more during weekdays." : "Work patterns will appear here as you check in.",
    gratitude > 0 ? "Gratitude is becoming a visible thread." : "Gratitude patterns will build over time.",
    calm >= stress ? "Your calmer language is keeping pace with stress." : "Your calmer language is still building around stress.",
    ...coachNotes.slice(0, 1),
  ].slice(0, 4);

  return { activeTags, memoryFacts };
}

export default function HistoryView({
  onViewCoachReply,
  onNeedPremium,
}: {
  onViewCoachReply?: (entry: string, reply: CoachReply) => void;
  onNeedPremium?: () => void;
}) {
  const checkIns = useApp((s) => s.checkIns);
  const coachNotes = useApp((s) => s.coachNotes);
  const lastDeepInsight = useApp((s) => s.lastDeepInsight);
  const weeklyInsights = useApp((s) => s.weeklyInsights);
  const settings = useApp((s) => s.settings);
  const premium = hasTranqlyAccess(settings.premium, settings.complimentaryAccess);
  const theme = useApp((s) => s.settings.theme);
  const updateSettings = useApp((s) => s.updateSettings);
  const best = bestStreak(checkIns);
  const streak = currentStreak(checkIns);
  const hasDemoData = checkIns.some(isDemoCheckIn);
  const [showSanctuary, setShowSanctuary] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [selectedWeeklyInsight, setSelectedWeeklyInsight] = useState<DeepInsight | null>(null);
  const [showWeeklyHistory, setShowWeeklyHistory] = useState(false);
  const [showAllReflections, setShowAllReflections] = useState(false);
  const journey = useMemo(() => buildJourneyInsights(checkIns, coachNotes), [checkIns, coachNotes]);
  const sortedReflections = useMemo(
    () => [...checkIns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [checkIns]
  );
  const visibleReflections = showAllReflections ? sortedReflections : sortedReflections.slice(0, 5);
  const monthStats = useMemo(() => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthEntries = checkIns.filter((c) => c.dateKey.startsWith(monthPrefix));
    const uniqueDays = new Set(monthEntries.map((c) => c.dateKey)).size;
    const text = monthEntries.map((c) => c.text).join(" ").toLowerCase();
    const calmHits = (text.match(/calm|peace|slow|quiet|rest|outside|walk/g) ?? []).length;
    const gratitudeHits = (text.match(/grateful|thankful|appreciate|good|happy|love/g) ?? []).length;
    const stressHits = (text.match(/stress|busy|overwhelm|tired|anxious|hard/g) ?? []).length;

    return {
      calm: calmHits >= stressHits ? "Up" : "Building",
      consistency: `${uniqueDays || Math.min(checkIns.length, 1)} day${uniqueDays === 1 ? "" : "s"}`,
      gratitude: gratitudeHits > 2 ? "High" : gratitudeHits > 0 ? "Growing" : "Starting",
      stress: stressHits > calmHits ? "Worth watching" : "Lower than last week",
    };
  }, [checkIns]);

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-1 pb-28 pt-4 sm:px-4 md:pt-8">
      <header className="px-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-calm">
          Growth Over Time
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Your journey</h1>
        <p className="mt-1 text-sm text-dim">
          Watch your growth unfold over time.
        </p>
      </header>

      <SanctuaryCard
        checkIns={checkIns}
        currentStreak={streak}
        onOpen={() => setShowSanctuary(true)}
      />

      <SanctuaryCollection checkIns={checkIns} onOpen={() => setShowCollection(true)} />

      <WeeklyReflectionSection
        premium={premium}
        hasDemoData={hasDemoData}
        insight={lastDeepInsight}
        historyCount={weeklyInsights.length}
        reflectionDays={currentWeekReflectionDayCount(checkIns)}
        onNeedPremium={onNeedPremium}
        onOpen={() => {
          setSelectedWeeklyInsight(weeklyInsights[0] ?? lastDeepInsight);
          setShowWeeklyHistory(true);
        }}
      />

      <section className="rounded-xl2 border border-sea/25 bg-gradient-to-br from-card to-[#123733] p-4 shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sea">
          This Month&apos;s Growth
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ProgressTile label="Calm" value={monthStats.calm} tone="calm" />
          <ProgressTile label="Consistency" value={monthStats.consistency} tone="consistency" />
          <ProgressTile label="Gratitude" value={monthStats.gratitude} tone="gratitude" />
          <ProgressTile label="Stress" value={monthStats.stress} tone="stress" />
        </div>
      </section>

      <section className="rounded-xl2 border border-calm/20 bg-gradient-to-br from-card to-[#101D24] p-4 shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-calm">
          Patterns I&apos;ve Noticed
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {journey.memoryFacts.map((fact) => (
            <button type="button" key={fact} onClick={() => window.alert(`${fact}\n\nThis is a gentle observation based on your recent reflections, not a definitive conclusion.`)} className="flex min-h-[44px] w-full items-start gap-2 rounded-2xl border border-edge bg-ink/55 px-3 py-2 text-left">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-calm/10 text-xs font-black text-calm">
                &rsaquo;
              </span>
              <p className="text-sm leading-relaxed text-dim">{fact}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold text-faint">Updated today</p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-dim">
            Recent Reflections
          </h2>
          {sortedReflections.length > 5 ? (
            <button
              onClick={() => setShowAllReflections((value) => !value)}
              className="text-xs font-bold text-calm"
            >
              {showAllReflections ? "Show recent" : "View all reflections"}
            </button>
          ) : null}
        </div>
        {visibleReflections.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm leading-relaxed text-faint">
            Your reflections will gather here, a quiet record of you showing up for yourself.
          </p>
        ) : null}
        {visibleReflections.map((entry) => (
          <ReflectionCard
            key={entry.id}
            entry={entry}
            onViewCoachReply={onViewCoachReply}
          />
        ))}
      </section>

      {showSanctuary && (
        <SanctuaryModal
          checkIns={checkIns}
          currentStreak={streak}
          bestStreak={best}
          onClose={() => setShowSanctuary(false)}
        />
      )}
      {showCollection && (
        <SanctuaryCollectionModal
          checkIns={checkIns}
          currentTheme={theme}
          onClose={() => setShowCollection(false)}
          onExplore={(key) => {
            updateSettings({ theme: key });
            setShowCollection(false);
            setShowSanctuary(true);
          }}
        />
      )}
      {showWeeklyHistory ? (
        <WeeklyHistoryModal
          insights={weeklyInsights.length ? weeklyInsights : lastDeepInsight ? [lastDeepInsight] : []}
          selected={selectedWeeklyInsight}
          onSelect={setSelectedWeeklyInsight}
          onClose={() => setShowWeeklyHistory(false)}
        />
      ) : null}
    </div>
  );
}

function ReflectionCard({
  entry,
  onViewCoachReply,
}: {
  entry: CheckIn;
  onViewCoachReply?: (entry: string, reply: CoachReply) => void;
}) {
  const date = new Date(entry.createdAt);

  return (
    <article className="rounded-xl2 border border-edge bg-card p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-faint">
          {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </h3>
        <span className="text-xs font-semibold text-dim">
          {date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>
      <p className="text-base font-semibold leading-relaxed text-fg">
        {entry.reply?.summary ?? entry.reply?.message ?? entry.text}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tagsForText(entry.text).slice(0, 3).map((tag) => (
          <span
            key={tag.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-ink/55 px-2 py-1 text-[10px] font-bold text-dim"
          >
            <TagIcon type={tag.key} />
            {tag.label}
          </span>
        ))}
      </div>
      {entry.reply ? (
        <button
          onClick={() => onViewCoachReply?.(entry.text, entry.reply!)}
          className="mt-3 rounded-full border border-calm/20 bg-calm/10 px-3 py-1.5 text-left text-[12px] font-black text-calm transition hover:bg-calm/15 hover:text-sea"
        >
          View Tranqly Response <span aria-hidden="true">›</span>
        </button>
      ) : null}
    </article>
  );
}

function WeeklyReflectionSection({ premium, hasDemoData, insight, historyCount, reflectionDays, onNeedPremium, onOpen }: { premium: boolean; hasDemoData: boolean; insight: DeepInsight | null; historyCount: number; reflectionDays: number; onNeedPremium?: () => void; onOpen: () => void }) {
  const weeklyDays = Math.min(7, reflectionDays);
  const ready = weeklyDays === 7;
  return (
    <section className="rounded-xl2 border border-calm/25 bg-gradient-to-br from-card to-[#171430] p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-calm">Weekly Reflection</p>
          <h2 className="mt-1 text-lg font-black">{ready ? "Your weekly reflection is ready." : "Your weekly reflection is still building."}</h2>
        </div>
        <span className="text-xs font-bold text-dim">Sunday</span>
      </div>
      <div className="mt-3 flex gap-1.5">{Array.from({ length: 7 }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index < weeklyDays ? "bg-calm" : "bg-ink"}`} />)}</div>
      <p className="mt-2 text-xs font-bold text-dim">{weeklyDays} of 7 complete</p>
      {ready && insight ? <div className="mt-3 space-y-2"><h3 className="font-black">{insight.headline}</h3><p className="text-sm leading-relaxed text-dim">{insight.insight}</p></div> : null}
      {historyCount > 0 || insight ? <button onClick={onOpen} className="mt-3 min-h-[42px] w-full rounded-2xl border border-calm/30 bg-calm/10 text-sm font-bold text-calm">{historyCount > 1 ? "View Weekly Reflection History" : "Read Weekly Reflection"}</button> : null}
      {ready && !insight && !premium && !hasDemoData ? <button onClick={onNeedPremium} className="mt-3 min-h-[42px] w-full rounded-2xl border border-calm/30 bg-ink text-sm font-bold text-calm">Begin Week Two</button> : null}
    </section>
  );
}

function WeeklyHistoryModal({ insights, selected, onSelect, onClose }: { insights: DeepInsight[]; selected: DeepInsight | null; onSelect: (insight: DeepInsight) => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
    <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-edge bg-card p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-card">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-calm">Weekly Reflections</p><h2 className="mt-1 text-2xl font-black">Weekly Reflection History</h2></div><button onClick={onClose} className="min-h-[44px] rounded-full border border-edge bg-ink px-4 text-sm font-bold text-dim">Close</button></div>
      {selected ? <div className="mt-4 rounded-2xl border border-calm/25 bg-ink/70 p-4"><p className="text-xs font-bold text-faint">Week of {new Date(selected.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p><h3 className="mt-2 text-xl font-black">{selected.headline}</h3><p className="mt-2 text-sm leading-relaxed text-dim">{selected.insight}</p><div className="mt-3 rounded-2xl border border-calm/20 bg-calm/10 p-3"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-calm">Next Gentle Focus</p><p className="mt-1 text-sm text-fg">{selected.suggestion}</p></div></div> : <p className="mt-6 text-sm text-dim">Your first weekly reflection will appear here when it is ready.</p>}
      {insights.length > 1 ? <div className="mt-5 space-y-2"><p className="text-xs font-black uppercase tracking-[0.16em] text-faint">Previous weeks</p>{insights.map((insight) => <button key={insight.createdAt} onClick={() => onSelect(insight)} className={`min-h-[56px] w-full rounded-2xl border p-3 text-left ${selected?.createdAt === insight.createdAt ? "border-calm/50 bg-calm/10" : "border-edge bg-ink/55"}`}><p className="text-xs text-faint">{new Date(insight.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p><p className="mt-1 font-bold text-fg">{insight.headline}</p></button>)}</div> : null}
    </div>
  </div>;
}

function ProgressTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: MonthIconTone;
}) {
  return (
    <div className="rounded-2xl border border-edge bg-ink/70 p-4 text-center">
      <div className="mb-2 flex justify-center">
        <MonthIcon tone={tone} />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: monthIconColors[tone] }}>
        {label}
      </p>
      <p className="mt-2 text-base font-black text-fg">{value}</p>
    </div>
  );
}

function MonthIcon({ tone }: { tone: MonthIconTone }) {
  const color = monthIconColors[tone];

  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      className="h-16 w-16 drop-shadow-[0_0_18px_rgba(94,234,212,0.12)]"
      fill="none"
      style={{ color }}
    >
      <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="3" opacity="0.92" />
      {tone === "calm" && (
        <>
          <path d="M48 61c-9-11-9-24 0-34 9 10 9 23 0 34Z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M47 61c-13-1-22-8-27-20 13 1 22 8 27 20ZM49 61c13-1 22-8 27-20-13 1-22 8-27 20Z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M28 70c9-4 31-4 40 0M34 76c8-2 20-2 28 0" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      {tone === "consistency" && (
        <>
          <path d="M28 31h37a5 5 0 0 1 5 5v23a5 5 0 0 1-5 5H31a5 5 0 0 1-5-5V36a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M26 43h44M36 25v13M58 25v13" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M36 50h7M50 50h7M36 59h7" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          <circle cx="65" cy="66" r="15" fill="#123733" stroke="currentColor" strokeWidth="3.5" />
          <path d="M58 66l5 5 10-12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {tone === "gratitude" && (
        <>
          <path d="M48 35c-4-8-17-7-17 4 0 9 12 16 17 22 5-6 17-13 17-22 0-11-13-12-17-4Z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M31 71V57c0-7-7-7-7 0v8c0 7 10 9 14 16M65 71V57c0-7 7-7 7 0v8c0 7-10 9-14 16" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M35 63l8 7M61 63l-8 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}
      {tone === "stress" && (
        <>
          <path d="M47 31c-7-7-20-2-20 9-6 2-8 12-1 17-3 8 7 15 14 10 2 7 13 7 15-1 8 2 14-6 10-13 5-7 0-17-8-16-1-8-7-10-10-6Z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M47 31v35M34 42c4 2 6 5 6 9M31 56c4 1 7 3 9 7M56 45c-3 2-5 5-5 9" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="68" cy="66" r="13" fill="#191a22" stroke="currentColor" strokeWidth="3.5" />
          <path d="M68 58v14M62 67l6 6 6-6" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
