"use client";

import { motion } from "framer-motion";
import { themeByKey, themeUnlockLabel, themeUnlockRequirement, themesByUnlockOrder } from "@/lib/themes";
import { useApp } from "@/lib/store";
import type { CheckIn } from "@/lib/types";

type ThemeScores = {
  calm: number;
  consistency: number;
  gratitude: number;
  stress: number;
  smallWins: number;
  nature: number;
};

type SanctuaryState = {
  totalCheckIns: number;
  unlockedElements: string[];
  treeStage: number;
  flowerStage: number;
  pondStage: number;
  cabinStage: number;
  nextUnlock: {
    name: string;
    daysRemaining: number;
    unlockDay: number;
  } | null;
};

const MILESTONES = [
  { day: 1, name: "Seed" },
  { day: 7, name: "Tree" },
  { day: 14, name: "More flowers" },
  { day: 21, name: "Bushes" },
  { day: 28, name: "Rocks" },
  { day: 42, name: "Pond" },
  { day: 56, name: "Butterflies" },
  { day: 70, name: "Bench" },
  { day: 84, name: "Birds" },
  { day: 100, name: "Lantern" },
  { day: 140, name: "Fireflies" },
  { day: 180, name: "Cabin" },
  { day: 365, name: "Full sanctuary" },
];

export function nextThemeUnlock(totalCheckIns: number) {
  return themesByUnlockOrder()
    .filter((theme) => theme.unlockType === "reflections")
    .find((theme) => totalCheckIns < themeUnlockRequirement(theme)) ?? null;
}

export function themeScoresFromCheckIns(checkIns: CheckIn[]): ThemeScores {
  const text = checkIns.map((c) => c.text).join(" ").toLowerCase();
  const count = (pattern: RegExp) => (text.match(pattern) ?? []).length;
  const total = Math.max(1, checkIns.length);
  const calmHits = count(/calm|peace|slow|quiet|rest|outside|walk|breathe|breath/g);
  const gratitudeHits = count(/grateful|thankful|appreciate|good|happy|love|win|proud/g);
  const stressHits = count(/stress|busy|overwhelm|tired|anxious|hard|pressure/g);
  const winHits = count(/win|finished|proud|progress|better|did it|showed up/g);
  const natureHits = count(/outside|walk|tree|sun|garden|bird|water|pond|nature/g);

  return {
    calm: Math.min(1, calmHits / total),
    consistency: Math.min(1, total / 30),
    gratitude: Math.min(1, gratitudeHits / total),
    stress: Math.min(1, stressHits / total),
    smallWins: Math.min(1, winHits / total),
    nature: Math.min(1, natureHits / total),
  };
}

export function getSanctuaryState(
  totalCheckIns: number,
  themeScores: ThemeScores
): SanctuaryState {
  const unlockedElements = ["ground", "sky"];

  if (totalCheckIns >= 1) unlockedElements.push("seed");
  if (totalCheckIns >= 7) unlockedElements.push("tree", "flowers");
  if (totalCheckIns >= 21) unlockedElements.push("bushes");
  if (totalCheckIns >= 28) unlockedElements.push("rocks");
  if (totalCheckIns >= 42) unlockedElements.push("pond");
  if (totalCheckIns >= 56 || themeScores.nature > 0.45) unlockedElements.push("butterflies");
  if (totalCheckIns >= 70) unlockedElements.push("bench");
  if (totalCheckIns >= 84 || themeScores.nature > 0.65) unlockedElements.push("birds");
  if (totalCheckIns >= 100) unlockedElements.push("lantern");
  if (totalCheckIns >= 140 || themeScores.smallWins > 0.5) unlockedElements.push("fireflies");
  if (totalCheckIns >= 180) unlockedElements.push("cabin");

  const treeStage = Math.min(6, Math.max(0, Math.floor(totalCheckIns / 14) + (themeScores.consistency > 0.7 ? 1 : 0)));
  const flowerStage = Math.min(5, Math.max(0, Math.floor(totalCheckIns / 14) + (themeScores.gratitude > 0.5 ? 1 : 0)));
  const pondStage = totalCheckIns >= 42 ? Math.min(4, Math.max(1, Math.floor((totalCheckIns - 28) / 28) + (themeScores.calm > 0.6 ? 1 : 0))) : 0;
  const cabinStage = totalCheckIns >= 365 ? 2 : totalCheckIns >= 180 ? 1 : 0;
  const next = MILESTONES.find((milestone) => totalCheckIns < milestone.day);

  return {
    totalCheckIns,
    unlockedElements: Array.from(new Set(unlockedElements)),
    treeStage,
    flowerStage,
    pondStage,
    cabinStage,
    nextUnlock: next
      ? {
          name: next.name,
          daysRemaining: next.day - totalCheckIns,
          unlockDay: next.day,
        }
      : null,
  };
}

export function SanctuaryCard({
  checkIns,
  currentStreak,
  onOpen,
}: {
  checkIns: CheckIn[];
  currentStreak: number;
  onOpen: () => void;
}) {
  const themeKey = useApp((s) => s.settings.theme);
  const theme = themeByKey(themeKey);
  const nextTheme = nextThemeUnlock(checkIns.length);
  const needed = nextTheme ? themeUnlockRequirement(nextTheme) - checkIns.length : 0;

  return (
    <section className="overflow-hidden rounded-xl2 border border-sea/25 bg-gradient-to-br from-[#111827] via-card to-[#07131a] p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{theme.label}</h2>
          <p className="text-sm text-dim">Your Sanctuary</p>
          <p className="text-xs font-semibold text-faint">
            You&apos;ve spent {checkIns.length} quit moment{checkIns.length === 1 ? "" : "s"} here.
          </p>
        </div>
        <button
          onClick={onOpen}
          className="rounded-full border border-sea/25 bg-sea/10 px-3 py-2 text-xs font-bold text-sea transition-colors hover:bg-sea/15"
        >
          Explore Sanctuary
        </button>
      </div>
      <div className="relative overflow-hidden rounded-[1.5rem] border border-edge">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={theme.artwork} alt="" className="aspect-[1.55] w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-calm">
            {theme.feeling}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-relaxed text-fg">
            {theme.description}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 rounded-2xl border border-edge bg-ink/60 p-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-bold text-faint">Your Sanctuary</p>
          <p className="mt-1 text-lg font-black text-sea">{theme.label}</p>
          <p className="text-xs text-dim">Selected</p>
        </div>
        <div>
          <p className="text-xs font-bold text-faint">Streak</p>
          <p className="mt-1 text-2xl font-black text-sea">{currentStreak}</p>
          <p className="text-xs text-dim">day{currentStreak === 1 ? "" : "s"}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-faint">Next Sanctuary</p>
          <p className="mt-1 text-lg font-black text-fg">
            {nextTheme?.label ?? "All sanctuaries"}
          </p>
          <p className="text-xs text-sea">
            {nextTheme
              ? `Unlocks in ${needed} reflection${needed === 1 ? "" : "s"}`
              : "Sanctuary collection complete"}
          </p>
        </div>
      </div>
    </section>
  );
}

export function SanctuaryModal({
  checkIns,
  currentStreak,
  bestStreak,
  onClose,
}: {
  checkIns: CheckIn[];
  currentStreak: number;
  bestStreak: number;
  onClose: () => void;
}) {
  const themeKey = useApp((s) => s.settings.theme);
  const theme = themeByKey(themeKey);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-[2rem] border border-edge bg-card p-5 shadow-card"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sea">
              Explore Sanctuary
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight">{theme.label}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-faint">
              <span className="rounded-full border border-edge bg-ink px-2.5 py-1">Current Sanctuary</span>
              <span className="rounded-full border border-edge bg-ink px-2.5 py-1">
                {themeUnlockLabel(theme)}
              </span>
              <span className="rounded-full border border-edge bg-ink px-2.5 py-1">
                {checkIns.length} quit moment{checkIns.length === 1 ? "" : "s"} here
              </span>
            </div>
            <p className="text-sm leading-relaxed text-dim">
              {theme.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-edge bg-ink px-3 py-1.5 text-sm font-bold text-dim"
          >
            Close
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[1.5rem] border border-edge">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={theme.artwork} alt="" className="aspect-[1.2] w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/78 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-calm">
              {theme.feeling}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {theme.palette.map((color) => (
                <span key={color} className="rounded-full bg-ink/75 px-2 py-1 text-[10px] font-bold text-dim">
                  {color}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatPill label="Quit moments" value={String(checkIns.length)} />
          <StatPill label="Streak" value={`${currentStreak}d`} />
          <StatPill label="Best" value={`${bestStreak}d`} />
        </div>

      </motion.div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-edge bg-ink/70 p-3 text-center">
      <p className="text-lg font-bold text-fg">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-faint">{label}</p>
    </div>
  );
}

const SANCTUARY_ANCHORS = {
  tree: { x: 138, y: 172 },
  pond: { x: 186, y: 190 },
  bridge: { x: 144, y: 166 },
  cabin: { x: 252, y: 128 },
  flowerLeft: { x: 64, y: 184 },
  flowerRight: { x: 284, y: 188 },
  rockLeft: { x: 38, y: 205 },
  rockRight: { x: 292, y: 209 },
  butterfly: { x: 92, y: 122 },
  birds: { x: 240, y: 90 },
};

export function SanctuaryScene({
  state,
  compact = false,
}: {
  state: SanctuaryState;
  compact?: boolean;
}) {
  const has = (element: string) => state.unlockedElements.includes(element);
  const treeScale = 0.54 + state.treeStage * 0.07;
  const flowerCount = Math.max(0, state.flowerStage);

  return (
    <div className={`relative overflow-hidden rounded-[1.5rem] border border-edge bg-[#0b1320] ${compact ? "h-48" : "h-64"}`}>
      <svg viewBox="0 0 360 240" className="h-full w-full" role="img" aria-label="Layered sanctuary scene">
        <defs>
          <radialGradient id="sanctuaryGlow" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#1f3b4d" />
            <stop offset="100%" stopColor="#071018" />
          </radialGradient>
          <linearGradient id="hillBack" x1="0" x2="360" y1="96" y2="210">
            <stop stopColor="#173c35" />
            <stop offset="1" stopColor="#10251e" />
          </linearGradient>
          <linearGradient id="grassMid" x1="0" x2="360" y1="138" y2="230">
            <stop stopColor="#245f42" />
            <stop offset="0.58" stopColor="#1c4834" />
            <stop offset="1" stopColor="#0e1c18" />
          </linearGradient>
          <linearGradient id="grassFront" x1="0" x2="360" y1="178" y2="240">
            <stop stopColor="#1f5338" />
            <stop offset="1" stopColor="#08110f" />
          </linearGradient>
        </defs>
        <rect width="360" height="240" fill="url(#sanctuaryGlow)" />
        <Cloud x={52} y={50} scale={0.9} opacity={0.45} />
        <Cloud x={266} y={58} scale={1.1} opacity={0.35} />
        {has("fireflies") && <Fireflies />}
        <LandscapeGround />
        {has("seed") && !has("tree") && <Seed />}
        {has("path") || state.totalCheckIns >= 70 ? <PathLayer /> : null}
        {state.cabinStage > 0 && <Cabin stage={state.cabinStage} />}
        {state.pondStage > 0 && <Pond stage={state.pondStage} />}
        {has("bushes") && <Bushes />}
        {has("tree") && <Tree scale={treeScale} />}
        {state.pondStage > 2 && <Bridge />}
        {has("rocks") && <Rocks />}
        {flowerCount > 0 && <Flowers count={flowerCount} />}
        {has("bench") && <Bench />}
        {has("lantern") && <Lantern />}
        {has("birds") && <Birds />}
        {has("butterflies") && <Butterflies />}
      </svg>
    </div>
  );
}

function LandscapeGround() {
  return (
    <g>
      <path
        d="M-32 132C34 106 74 116 118 128C172 144 220 108 270 122C318 135 350 120 392 106V240H-32Z"
        fill="url(#hillBack)"
        opacity="0.62"
      />
      <path
        d="M-32 160C32 137 78 142 128 152C182 163 224 134 276 143C321 151 352 144 392 128V240H-32Z"
        fill="url(#grassMid)"
      />
      <path
        d="M-32 198C26 180 68 184 114 192C170 202 218 176 270 184C322 192 354 184 392 172V240H-32Z"
        fill="url(#grassFront)"
      />
      <path d="M0 178C68 168 132 172 180 176C238 182 298 176 360 166" stroke="#5b8f58" strokeWidth="2" opacity="0.22" />
      <path d="M0 210C72 199 142 206 198 211C258 216 310 207 360 196" stroke="#6fa45f" strokeWidth="1.6" opacity="0.18" />
    </g>
  );
}

function Cloud({ x, y, scale, opacity }: { x: number; y: number; scale: number; opacity: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <ellipse cx="0" cy="8" rx="18" ry="8" fill="#33415f" />
      <circle cx="-8" cy="4" r="8" fill="#33415f" />
      <circle cx="6" cy="2" r="10" fill="#33415f" />
    </g>
  );
}

function Seed() {
  const { x, y } = SANCTUARY_ANCHORS.tree;
  return (
    <g transform={`translate(${x} ${y})`} stroke="#5eead4" strokeWidth="3" strokeLinecap="round" fill="none">
      <path d="M0 0v-18" />
      <path d="M0-12c-10-3-13-10-12-16 8 1 13 6 12 16Z" fill="#3f8f72" />
      <path d="M1-13c10-3 13-9 12-15-8 1-13 6-12 15Z" fill="#4fae83" />
    </g>
  );
}

function Tree({ scale }: { scale: number }) {
  const { x, y } = SANCTUARY_ANCHORS.tree;
  return (
    <motion.g
      animate={{ rotate: [-0.6, 0.6, -0.6] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      transform={`translate(${x} ${y}) scale(${scale})`}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      <path d="M-8 18c5-24 5-50 0-73h18c-6 24-4 49 2 73Z" fill="#5b3f34" />
      <path d="M0-24c-8 14-18 25-35 34M4-27c10 12 22 22 38 29" stroke="#3b2d2b" strokeWidth="6" strokeLinecap="round" />
      <circle cx="-30" cy="-50" r="30" fill="#376f50" />
      <circle cx="0" cy="-70" r="36" fill="#4c8b61" />
      <circle cx="34" cy="-46" r="31" fill="#34694e" />
      <circle cx="-5" cy="-44" r="34" fill="#2f6d50" />
      <circle cx="20" cy="-74" r="24" fill="#5d9b6b" opacity="0.75" />
    </motion.g>
  );
}

function Flowers({ count }: { count: number }) {
  const left = SANCTUARY_ANCHORS.flowerLeft;
  const right = SANCTUARY_ANCHORS.flowerRight;
  const flowers: [number, number, string][] = [
    [left.x - 10, left.y, "#f39ac6"],
    [left.x + 12, left.y - 8, "#b79cff"],
    [left.x + 32, left.y + 4, "#f5bd6d"],
    [right.x - 5, right.y - 1, "#f39ac6"],
    [right.x + 18, right.y - 7, "#b79cff"],
  ];
  return (
    <g>
      {flowers.slice(0, count).map(([x, y, color], index) => (
        <g key={index} transform={`translate(${x} ${y})`}>
          <path d="M0 12v-13" stroke="#5a8f62" strokeWidth="2" strokeLinecap="round" />
          {[0, 72, 144, 216, 288].map((rotation) => (
            <ellipse key={rotation} cx="0" cy="-4" rx="4" ry="7" fill={color} transform={`rotate(${rotation})`} />
          ))}
          <circle cx="0" cy="-4" r="2" fill="#f8efd9" />
        </g>
      ))}
    </g>
  );
}

function Bushes() {
  return (
    <g fill="#326a4d">
      <circle cx="76" cy="162" r="11" opacity="0.9" />
      <circle cx="91" cy="156" r="15" opacity="0.9" />
      <circle cx="108" cy="165" r="11" opacity="0.9" />
      <circle cx="241" cy="165" r="12" opacity="0.82" />
      <circle cx="258" cy="158" r="15" opacity="0.82" />
      <circle cx="276" cy="166" r="11" opacity="0.82" />
    </g>
  );
}

function Rocks() {
  const left = SANCTUARY_ANCHORS.rockLeft;
  const right = SANCTUARY_ANCHORS.rockRight;
  return (
    <g fill="#7b8292" opacity="0.85">
      <path d={`M${left.x} ${left.y}c6-17 24-17 31 0Z`} />
      <path d={`M${right.x - 56} ${right.y - 4}c5-14 20-14 25 0Z`} />
      <path d={`M${right.x} ${right.y}c5-12 18-12 24 0Z`} />
    </g>
  );
}

function Pond({ stage }: { stage: number }) {
  const { x, y } = SANCTUARY_ANCHORS.pond;
  return (
    <motion.g animate={{ opacity: [0.85, 1, 0.85] }} transition={{ duration: 3, repeat: Infinity }}>
      <ellipse cx={x} cy={y} rx={stage > 2 ? 68 : 48} ry={stage > 2 ? 22 : 16} fill="#1e6470" />
      <ellipse cx={x} cy={y - 4} rx={stage > 2 ? 56 : 36} ry={stage > 2 ? 14 : 10} fill="#2b8793" opacity="0.45" />
      <ellipse cx={x - 26} cy={y - 5} rx="9" ry="4" fill="#7bb66a" />
      {stage > 1 && <ellipse cx={x + 27} cy={y + 3} rx="11" ry="5" fill="#7bb66a" />}
      {stage > 3 && <path d={`M${x + 39} ${y - 14}c9-13 17-12 24-4`} stroke="#6fa45f" strokeWidth="3" strokeLinecap="round" />}
    </motion.g>
  );
}

function Bridge() {
  const { x, y } = SANCTUARY_ANCHORS.bridge;
  return (
    <g transform={`translate(${x} ${y})`} strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 18c24-18 58-18 84 0" stroke="#8a5a3c" strokeWidth="8" />
      <path d="M2 12c24-18 57-18 82 0" stroke="#c08a55" strokeWidth="4" />
      <path d="M13 10v18M30 3v22M50 3v22M69 10v18" stroke="#6f4632" strokeWidth="3" />
    </g>
  );
}

function PathLayer() {
  const { x, y } = SANCTUARY_ANCHORS.cabin;
  return <path d={`M${x + 8} ${y + 46}c18 10 35 25 49 48`} stroke="#89715a" strokeWidth="9" strokeLinecap="round" strokeDasharray="13 11" opacity="0.5" />;
}

function Bench() {
  return (
    <g transform="translate(250 160)" stroke="#a56b42" strokeWidth="4" strokeLinecap="round">
      <path d="M0 0h45M-2 11h49M7 11v17M39 11v17" />
    </g>
  );
}

function Lantern() {
  return (
    <motion.g animate={{ opacity: [0.65, 1, 0.65] }} transition={{ duration: 2.8, repeat: Infinity }} transform="translate(288 154) scale(0.9)">
      <path d="M10 0h18l4 32H6Z" fill="#4a3d35" stroke="#8a6b4a" strokeWidth="2" />
      <rect x="12" y="8" width="14" height="18" fill="#f5bd6d" opacity="0.8" />
      <path d="M13 0c1-9 12-9 14 0" stroke="#8a6b4a" strokeWidth="2" fill="none" />
    </motion.g>
  );
}

function Cabin({ stage }: { stage: number }) {
  const { x, y } = SANCTUARY_ANCHORS.cabin;
  return (
    <g transform={`translate(${x} ${y}) scale(0.86)`}>
      <path d="M0 28 28 4l28 24v45H0Z" fill={stage > 1 ? "#4b3835" : "#3a2f32"} stroke="#6f5a52" strokeWidth="2" />
      <path d="M-5 29 28 0l33 29" stroke="#73809a" strokeWidth="8" strokeLinecap="round" />
      <rect x="21" y="45" width="14" height="28" fill="#251d1e" />
      <rect x="39" y="35" width="11" height="12" fill="#f5bd6d" opacity="0.85" />
    </g>
  );
}

function Birds() {
  const { x, y } = SANCTUARY_ANCHORS.birds;
  return (
    <motion.g animate={{ x: [0, 8, 0], y: [0, -4, 0] }} transition={{ duration: 6, repeat: Infinity }} stroke="#8ea2c3" strokeWidth="3" strokeLinecap="round" fill="none">
      <path d={`M${x} ${y}c7-7 13-7 20 0`} />
      <path d={`M${x + 21} ${y}c7-7 13-7 20 0`} />
    </motion.g>
  );
}

function Butterflies() {
  const { x, y } = SANCTUARY_ANCHORS.butterfly;
  return (
    <motion.g animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity }} fill="#b79cff">
      <ellipse cx={x - 4} cy={y} rx="5" ry="8" transform={`rotate(-30 ${x - 4} ${y})`} />
      <ellipse cx={x + 6} cy={y} rx="5" ry="8" transform={`rotate(30 ${x + 6} ${y})`} />
      <ellipse cx="243" cy="111" rx="4" ry="7" transform="rotate(-30 243 111)" />
      <ellipse cx="252" cy="111" rx="4" ry="7" transform="rotate(30 252 111)" />
    </motion.g>
  );
}

function Fireflies() {
  return (
    <motion.g animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 2.4, repeat: Infinity }} fill="#f5d56d">
      {[80, 132, 221, 284, 302].map((x, index) => (
        <circle key={x} cx={x} cy={70 + index * 17} r="2.2" />
      ))}
    </motion.g>
  );
}
