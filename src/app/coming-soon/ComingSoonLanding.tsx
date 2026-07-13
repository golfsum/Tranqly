"use client";

import { useState, type HTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import WaitlistSignup from "@/components/WaitlistSignup";

const sanctuaryCards = [
  { key: "twilight", label: "Twilight Grove", artwork: "/sanctuary/twilight_grove.PNG", unlocks: "Current Sanctuary" },
  { key: "forest", label: "Forest Haven", artwork: "/sanctuary/forest_haven.PNG", unlocks: "Unlocks at 7 reflection days" },
  { key: "blossom", label: "Blossom Garden", artwork: "/sanctuary/lotus_blossom.PNG", unlocks: "Unlocks at 14 reflection days" },
  { key: "ocean", label: "Ocean Shore", artwork: "/sanctuary/ocean_calm.PNG", unlocks: "Unlocks at 21 reflection days" },
  { key: "sunrise", label: "Sunrise Meadow", artwork: "/sanctuary/sunset_fields.PNG", unlocks: "Unlocks at 28 reflection days" },
  { key: "mountain", label: "Mountain Retreat", artwork: "/sanctuary/mountain_peak.PNG", unlocks: "Bonus sanctuary" },
  { key: "misty", label: "Misty Hollow", artwork: "/sanctuary/misty_meadows.PNG", unlocks: "Bonus sanctuary" },
] as const;

const topFeatures = [
  { title: "Understand yourself over time", body: "Notice patterns you would not see on your own.", icon: "brain" as const },
  { title: "Grow one reflection at a time", body: "Just 60 seconds each day creates real change.", icon: "sprout" as const },
  { title: "Unlock peaceful sanctuaries", body: "Every reflection grows your world.", icon: "lotus" as const },
  { title: "Private by design", body: "Your reflections stay private and secure on your device.", icon: "lock" as const },
] as const;

const workflow = [
  { step: "1", title: "Reflect for 60 seconds", body: "Speak or type what's on your mind.", screen: "prompt" as const },
  { step: "2", title: "Tranqly remembers", body: "AI that learns what matters from your journey.", screen: "reflection" as const },
  { step: "3", title: "See your growth", body: "Discover patterns and trends that guide you.", screen: "growth" as const },
  { step: "4", title: "Unlock new sanctuaries", body: "Build your sanctuary one reflection at a time.", screen: "themes" as const },
] as const;

const memorySignals = [
  "What gives you energy",
  "What keeps showing up",
  "What helps you",
  "How you're growing",
  "The patterns you might miss",
] as const;

const plusFeatures = [
  "Everything in Free",
  "Unlimited AI insights",
  "Weekly reflection",
  "Advanced pattern tracking",
  "All sanctuary themes",
  "Priority access to new features",
] as const;

function Icon({
  kind,
  className = "h-5 w-5",
}: {
  kind: "brain" | "sprout" | "lotus" | "lock" | "heart" | "growth";
  className?: string;
}) {
  if (kind === "brain") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path d="M9 4.5a3.5 3.5 0 0 0-3.5 3.5v.5A3 3 0 0 0 3 11.5 3 3 0 0 0 5.5 14v1A3.5 3.5 0 0 0 9 18.5h.5V4.5H9ZM15 4.5a3.5 3.5 0 0 1 3.5 3.5v.5A3 3 0 0 1 21 11.5 3 3 0 0 1 18.5 14v1a3.5 3.5 0 0 1-3.5 3.5h-.5V4.5h.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 8.5h5M9.5 12h5M9.5 15.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "sprout") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path d="M12 20v-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M12 13c-2.7 0-4.9-2-5.4-5 3.1 0 5.5 1.2 6.9 3.6C14.8 9.2 17 8 19.4 8c-.5 3-2.7 5-5.4 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "lotus") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path d="M12 16c-3-3.4-3-7.2 0-10.2 3 3 3 6.8 0 10.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.5 16C7.7 15.8 5 13.8 3.5 10.7c3.8.3 6.5 2.3 8 5.3ZM12.5 16c3.8-.2 6.5-2.2 8-5.3-3.8.3-6.5 2.3-8 5.3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 19c2.2-.9 8-.9 11 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "lock") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path d="M7.5 10V8a4.5 4.5 0 0 1 9 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <rect x="5.5" y="10" width="13" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (kind === "heart") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
        <path d="M12 19.2 5.6 12.8a4.6 4.6 0 1 1 6.4-6.6 4.6 4.6 0 0 1 6.4 6.6L12 19.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="m4 16 5-5 3 3 8-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-11 w-11 place-items-center rounded-full bg-[#22162f] shadow-[0_0_32px_rgba(142,78,255,0.24)]">
        <div className="absolute inset-0 rounded-full bg-[#8e4eff]/25 blur-xl" />
        <img src="/tranqly_logo.png" alt="" className="relative h-7 w-7 object-contain" />
      </div>
      <div className="text-[1.45rem] font-semibold tracking-tight text-white sm:text-[1.65rem]">Tranqly: Daily Reflections</div>
    </div>
  );
}

function GlassCard({
  children,
  className = "",
  ...props
}: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(19,14,31,0.96),rgba(13,10,22,0.96))] shadow-[0_18px_48px_rgba(0,0,0,0.28)] ${className}`}
    >
      {children}
    </div>
  );
}

function PhoneFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative w-full max-w-[330px] rounded-[44px] border border-white/10 bg-[#050508] p-3 shadow-[0_30px_90px_rgba(0,0,0,0.48)] ${className}`}>
      <div className="absolute inset-[7%_10%_8%_10%] -z-10 rounded-[44px] bg-[#8f48ff]/18 blur-3xl" />
      <div className="overflow-hidden rounded-[34px] border border-white/6 bg-[#120f1d]">
        <div className="relative flex items-center justify-between px-5 pb-3 pt-4 text-[11px] font-semibold text-white/90">
          <span>9:41</span>
          <div className="absolute left-1/2 top-3.5 h-6 w-24 -translate-x-1/2 rounded-full bg-black/88" />
          <div className="flex h-4 items-end gap-1.5 text-white/88">
            <div className="flex h-3.5 items-end gap-[2px]" aria-hidden>
              <span className="block h-[4px] w-[3px] rounded-sm bg-current" />
              <span className="block h-[6px] w-[3px] rounded-sm bg-current" />
              <span className="block h-[9px] w-[3px] rounded-sm bg-current" />
              <span className="block h-[12px] w-[3px] rounded-sm bg-current" />
            </div>
            <svg viewBox="0 0 18 14" className="h-3.5 w-4" fill="none" aria-hidden>
              <path d="M2 5.3C5.9 2 12.1 2 16 5.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M5 8.1c2.2-1.8 5.8-1.8 8 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M8.2 10.8c.5-.4 1.1-.4 1.6 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
            <div className="flex h-3.5 items-center gap-[2px]" aria-hidden>
              <div className="h-3.5 w-6 rounded-[4px] border border-white/70 p-[1.5px]">
                <div className="h-full w-[82%] rounded-[2px] bg-current" />
              </div>
              <span className="h-1.5 w-[2px] rounded-r-sm bg-current" />
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ScreenshotPhone({
  src,
  alt,
  className = "",
  onPreview,
}: {
  src: string;
  alt: string;
  className?: string;
  onPreview?: (image: { src: string; alt: string }) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPreview?.({ src, alt })}
      className={`relative w-full max-w-[330px] rounded-[44px] border border-white/12 bg-[#050508] p-2 shadow-[0_30px_90px_rgba(0,0,0,0.5)] ${className}`}
      aria-label={`Preview ${alt}`}
    >
      <div className="absolute inset-[7%_10%_8%_10%] -z-10 rounded-[44px] bg-[#8f48ff]/18 blur-3xl" />
      <div className="overflow-hidden rounded-[36px] border border-white/8 bg-[#090813]">
        <img src={src} alt={alt} className="block h-auto w-full" />
      </div>
    </button>
  );
}

function NavPills({
  active,
  compact = false,
}: {
  active: "insights" | "journey" | "you";
  compact?: boolean;
}) {
  const tabs = ["Insights", "Journey", "You"] as const;

  return (
    <div className={`mt-4 flex items-center justify-between rounded-[22px] border border-white/8 bg-[#191322] ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}>
      {tabs.map((label) => {
        const isActive = label.toLowerCase() === active;

        return (
          <div
            key={label}
            className={`flex ${compact ? "h-9 min-w-[58px] px-2 text-[9px]" : "h-11 min-w-[72px] px-3 text-[10px]"} items-center justify-center rounded-full font-semibold ${
              isActive ? "bg-[#6d345a] text-white" : "text-white/55"
            }`}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

function ReflectionPhone({ compact = false }: { compact?: boolean }) {
  const wrap = compact ? "max-w-[330px] scale-[0.75]" : "max-w-[330px]";
  const body = compact ? "px-4 pb-4" : "px-5 pb-5";
  const title = compact ? "text-[1rem]" : "text-[1.55rem]";

  return (
    <PhoneFrame className={`${wrap} origin-top`}>
      <div className={body}>
        <p className={`${title} font-semibold text-white`}>Recent Reflections</p>
        <p className={`mt-1 ${compact ? "text-[9px] leading-4" : "text-[11px] leading-5"} text-white/55`}>See how Tranqly helps you reflect and grow.</p>
        <div className={`mt-4 rounded-[22px] border border-white/8 bg-[#21152f] ${compact ? "p-3" : "p-4"}`}>
          <div className="flex items-start gap-3">
            <div className={`${compact ? "h-8 w-8" : "h-10 w-10"} grid place-items-center rounded-full border border-[#6f46c8] bg-[#2b1b40] text-[#ce9dff]`}>
              <Icon kind="lotus" className={compact ? "h-4 w-4" : "h-5 w-5"} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#e4b4ff]">Robert</p>
              <p className={`mt-1 ${compact ? "text-[10px]" : "text-[13px]"} italic text-white/84`}>&ldquo;I had a job interview today.&rdquo;</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#cf9cff]">Tranqly</p>
            <p className={`mt-2 ${compact ? "text-[10px] leading-5" : "text-[12px] leading-6"} text-white/86`}>
              You had a job interview today, which may reveal you&apos;re taking steps toward a new opportunity, possibly feeling a bit anxious or hopeful about the outcome.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <div className={`rounded-[18px] border border-[#6e4d99] bg-[#17111f] ${compact ? "p-2.5" : "p-3"}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f0c06d]">One Gentle Step</p>
              <p className={`mt-2 ${compact ? "text-[9px] leading-4" : "text-[11px] leading-5"} text-white/82`}>Take a few deep breaths and acknowledge your effort.</p>
            </div>
            <div className={`rounded-[18px] border border-[#6e4d99] bg-[#17111f] ${compact ? "p-2.5" : "p-3"}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#cf9cff]">Pattern to Watch</p>
              <p className={`mt-2 ${compact ? "text-[9px] leading-4" : "text-[11px] leading-5"} text-white/82`}>This follows your pattern of showing up and taking action, even on busy days.</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] text-white/45">Was this helpful?</p>
            <div className="mt-2 flex gap-2">
              {["Helpful", "Not helpful"].map((label) => (
                <div key={label} className={`rounded-full border border-[#7149a6] ${compact ? "px-2 py-1 text-[8px]" : "px-3 py-1 text-[10px]"} font-semibold text-[#d7a5ff]`}>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <NavPills active="journey" compact={compact} />
      </div>
    </PhoneFrame>
  );
}

function ThemesPhone() {
  return (
    <PhoneFrame>
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between">
          <p className="text-[1.55rem] font-semibold text-white">Sanctuaries</p>
          <span className="text-lg text-white/60">x</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {sanctuaryCards.slice(1, 5).map((theme) => (
            <div key={theme.key} className="overflow-hidden rounded-[18px] border border-white/8 bg-[#181323]">
              <img src={theme.artwork} alt={theme.label} className="aspect-[0.95] w-full object-cover" />
              <div className="p-2.5">
                <p className="text-[11px] font-semibold text-white">{theme.label}</p>
                <p className="mt-1 text-[9px] text-white/55">{theme.unlocks}</p>
                <div className="mt-2 flex gap-1.5">
                  <span className="rounded-full border border-[#6b4a98] px-2 py-0.5 text-[9px] text-white/70">Preview</span>
                  <span className="rounded-full border border-[#6b4a98] px-2 py-0.5 text-[9px] text-white/45">Locked</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <NavPills active="you" />
      </div>
    </PhoneFrame>
  );
}

function PromptPhone() {
  return (
    <PhoneFrame className="max-w-[330px] scale-[0.75] origin-top">
      <div className="px-4 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c7a0ff]">Today&apos;s Discovery</p>
        <p className="mt-2 text-[1.05rem] font-semibold leading-snug text-white">What&apos;s one small win you&apos;re proud of today?</p>
        <p className="mt-2 text-[10px] leading-4 text-white/52">Every reflection helps Tranqly learn what matters to you.</p>
        <div className="mt-5 flex flex-col items-center">
          <div className="grid h-[126px] w-[126px] place-items-center rounded-full border border-[#7a50c8] bg-[#15101f] text-[#cf9cff] shadow-[0_0_34px_rgba(171,92,255,0.2)]">
            <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-4 text-[10px] font-bold text-white/45">0s / 60s</p>
          <p className="mt-2 text-[10px] text-white/45">Tap the mic, or type below</p>
        </div>
        <NavPills active="you" compact />
      </div>
    </PhoneFrame>
  );
}

function GrowthPhone() {
  return (
    <PhoneFrame className="max-w-[330px] scale-[0.75] origin-top">
      <div className="px-4 pb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c7a0ff]">This week&apos;s growth</p>
        <div className="mt-4 space-y-4">
          {[
            { label: "Calm", value: "Up", color: "#A88DFF", icon: "lotus" as const },
            { label: "Consistency", value: "2 days", color: "#6BE7D8", icon: "growth" as const },
            { label: "Gratitude", value: "Starting", color: "#F1C766", icon: "heart" as const },
            { label: "Stress", value: "Lower", color: "#E97786", icon: "brain" as const },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-[18px] border border-white/8 bg-[#1a1426] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: item.color, color: item.color }}>
                  <Icon kind={item.icon} className="h-4 w-4" />
                </div>
                <span className="text-[12px] font-semibold text-white">{item.label}</span>
              </div>
              <span className="text-[12px] font-semibold" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
        <NavPills active="journey" compact />
      </div>
    </PhoneFrame>
  );
}

function ThemesMiniPhone() {
  return (
    <PhoneFrame className="max-w-[330px] scale-[0.75] origin-top">
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-white">Sanctuaries</p>
          <span className="text-sm text-white/60">x</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {sanctuaryCards.slice(0, 4).map((theme) => (
            <div key={theme.key} className="overflow-hidden rounded-[14px] border border-white/8 bg-[#181323]">
              <img src={theme.artwork} alt={theme.label} className="aspect-[0.9] w-full object-cover" />
              <div className="p-2">
                <p className="text-[10px] font-semibold text-white">{theme.label}</p>
              </div>
            </div>
          ))}
        </div>
        <NavPills active="you" compact />
      </div>
    </PhoneFrame>
  );
}

function CurvedArrow() {
  return (
    <svg viewBox="0 0 180 140" className="pointer-events-none absolute right-[-6px] top-[316px] hidden h-[120px] w-[150px] 2xl:block" fill="none" aria-hidden>
      <path d="M16 18C86 18 122 48 126 94" stroke="#C57BFF" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" />
      <path d="m116 84 10 10 8-14" stroke="#C57BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ComingSoonLanding({ launchMode = false }: { launchMode?: boolean }) {
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

  return (
    <main className="min-h-screen bg-[#090813] text-white">
      <div
        className="bg-[radial-gradient(circle_at_15%_12%,rgba(134,76,255,0.32),transparent_28%),radial-gradient(circle_at_75%_15%,rgba(94,169,255,0.16),transparent_24%),linear-gradient(180deg,rgba(8,7,14,0.94),rgba(10,8,16,0.98))]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(8,7,14,0.88), rgba(10,8,16,0.98)), url('/sanctuary/northern_lights.PNG')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 pb-14 pt-6 sm:px-6 lg:px-8 xl:px-10">
          <header className="flex items-center justify-between">
            <Brand />
            <nav className="hidden items-center gap-10 text-sm text-white/82 md:flex">
              <a href="#features" className="transition hover:text-white">Features</a>
              <a href="#how-it-works" className="transition hover:text-white">How it works</a>
              <a href="#sanctuaries" className="transition hover:text-white">Sanctuaries</a>
              <Link href={launchMode ? "/app" : "#waitlist"} className="rounded-[18px] bg-gradient-to-r from-[#8038f0] to-[#a855f7] px-7 py-4 font-semibold text-white shadow-[0_12px_30px_rgba(138,80,255,0.34)]">
                {launchMode ? "Get started" : "Lock in $3.99/mo"}
              </Link>
            </nav>
          </header>

          <section className="grid gap-10 xl:grid-cols-[0.82fr_1.18fr] xl:items-start">
            <div className="relative pt-6 xl:pt-10">
              <div className="inline-flex rounded-full border border-[#6f42af] bg-[#1a1328]/82 px-4 py-2 text-[12px] font-black uppercase tracking-[0.28em] text-[#d2a9ff]">
                {launchMode ? "Tranqly is here" : "Launching soon"}
              </div>
              <h1 className="mt-6 max-w-[8.2ch] text-[4.3rem] font-black leading-[0.93] tracking-[-0.06em] text-white sm:text-[5rem] xl:text-[5.7rem]">
                Your mind deserves a <span className="bg-gradient-to-r from-[#aa63ff] to-[#d28fff] bg-clip-text text-transparent">sanctuary.</span>
              </h1>
              <p className="mt-6 max-w-[36rem] text-[1.2rem] leading-[1.55] text-white/76">
                A calm space to reflect for just one minute a day. Tranqly remembers what matters most, helping you spot patterns, celebrate progress, and actually understand yourself over time.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-white/76">
                {["1 minute a day", "Private & personal", "See your growth"].map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2">
                    {item}
                  </span>
                ))}
              </div>

              <GlassCard id="pricing" className="relative mt-8 max-w-[34rem] p-6">
                <div className="flex items-center gap-4">
                  <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-[#20152d] text-transparent">
                    <img src="/tranqly_logo.png" alt="" className="absolute h-8 w-8 object-contain" />
                    <span className="text-3xl">★</span>
                  </div>
                  <div>
                    <p className="text-[1.15rem] font-black uppercase tracking-[0.18em] text-[#d2a9ff]">
                      {launchMode ? "Simple pricing" : "Early Access Pricing"}
                    </p>
                    <p className="mt-2 text-[2.15rem] font-black text-[#ffd45c]">
                      {launchMode ? "$5.99/month" : "$3.99/mo for life"}
                    </p>
                    <p className="mt-1 text-[1.02rem] text-white/65">
                      {launchMode ? "$59.99/year. Cancel anytime." : "Locked in forever. Regular price becomes $5.99/mo after launch."}
                    </p>
                  </div>
                </div>
              </GlassCard>

              {!launchMode ? <CurvedArrow /> : null}

              {launchMode ? (
                <Link href="/app" className="mt-5 inline-flex min-h-16 w-full max-w-[34rem] items-center justify-center rounded-full bg-gradient-to-r from-[#8f3fff] to-[#b15cff] px-9 text-base font-bold text-white shadow-[0_14px_40px_rgba(149,80,255,0.45)] transition hover:brightness-110">
                  Get started
                </Link>
              ) : (
                <>
                  <div className="mt-5 max-w-[34rem]">
                    <WaitlistSignup showFooterNote={false} />
                  </div>
                  <p className="mt-3 text-sm text-white/45">No spam. Just 1 email reminder.</p>
                  <p className="mt-1 max-w-[34rem] text-sm leading-6 text-white/52">
                    You&apos;ll only be charged when we launch. Cancel anytime. Spots are first-come, first-served.
                  </p>
                </>
              )}
            </div>

            <div className="relative grid gap-8 xl:grid-cols-[0.34fr_0.66fr] xl:items-start">
              <div className="order-2 space-y-7 xl:order-1 xl:pt-24">
                {[
                  { title: "AI that remembers", body: "Personalized insights from your journey.", icon: "brain" as const },
                  { title: "Patterns that guide", body: "Spot what is helping you grow and what is not.", icon: "growth" as const },
                  { title: "Daily reflection", body: "Short check-ins that create real change.", icon: "lotus" as const },
                  { title: "Your privacy", body: "Your reflections stay private and secure on your device.", icon: "lock" as const },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-[#63428d] bg-[#161121]/88 text-[#cf9cff]">
                      <Icon kind={item.icon} className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[1.05rem] font-semibold text-[#d7a7ff]">{item.title}</p>
                      <p className="mt-1 max-w-[13rem] text-[0.98rem] leading-7 text-white/58">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-1 relative flex min-h-[720px] items-start justify-center xl:order-2 xl:justify-end">
                <ScreenshotPhone
                  src="/coming-soon/sanctuary.jpeg"
                  alt="Tranqly Twilight Grove sanctuary screen"
                  className="max-w-[370px] xl:max-w-[400px]"
                  onPreview={setPreviewImage}
                />
              </div>
            </div>
          </section>

          <GlassCard id="features" className="p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {topFeatures.map((item) => (
                <div key={item.title} className="flex gap-4 rounded-[22px] border border-white/6 bg-white/[0.02] p-5">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#63428d] bg-[#181224] text-[#cf9cff]">
                    <Icon kind={item.icon} />
                  </div>
                  <div>
                    <p className="text-[1.2rem] font-semibold text-white">{item.title}</p>
                    <p className="mt-2 text-[0.98rem] leading-7 text-white/58">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <section id="how-it-works" className="rounded-[30px] border border-white/6 bg-[linear-gradient(180deg,rgba(18,13,28,0.95),rgba(12,10,19,0.96))] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
            <p className="text-center text-[11px] font-black uppercase tracking-[0.3em] text-[#d2a9ff]">How Tranqly works</p>
            <div className="mt-6 grid gap-6 xl:grid-cols-4">
              {workflow.map((item, index) => (
                <div key={item.step} className="relative">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-[#2b1b40] text-sm font-black text-[#f0d8ff]">{item.step}</div>
                    <div>
                      <p className="text-[1.1rem] font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-white/58">{item.body}</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    {item.screen === "prompt" ? (
                      <ScreenshotPhone
                        src="/coming-soon/insights.jpeg"
                        alt="Tranqly daily reflection screen"
                        className="max-w-[300px] xl:max-w-[310px]"
                        onPreview={setPreviewImage}
                      />
                    ) : null}
                    {item.screen === "reflection" ? (
                      <ScreenshotPhone
                        src="/coming-soon/insight2.jpeg"
                        alt="Tranqly response screen"
                        className="max-w-[300px] xl:max-w-[310px]"
                        onPreview={setPreviewImage}
                      />
                    ) : null}
                    {item.screen === "growth" ? (
                      <ScreenshotPhone
                        src="/coming-soon/journey.jpeg"
                        alt="Tranqly journey growth screen"
                        className="max-w-[300px] xl:max-w-[310px]"
                        onPreview={setPreviewImage}
                      />
                    ) : null}
                    {item.screen === "themes" ? (
                      <ScreenshotPhone
                        src="/coming-soon/themes.jpeg"
                        alt="Tranqly sanctuary theme picker"
                        className="max-w-[300px] xl:max-w-[310px]"
                        onPreview={setPreviewImage}
                      />
                    ) : null}
                  </div>
                  {index < workflow.length - 1 ? (
                    <div className="pointer-events-none absolute right-[-18px] top-[52%] hidden text-[#ba7cff] xl:block">→</div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <GlassCard id="sanctuaries" className="p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#d2a9ff]">Your sanctuary grows with you</p>
            <h2 className="mt-3 text-[2.6rem] font-semibold leading-tight text-white">Beautiful places to reflect and grow</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-8">
              {sanctuaryCards.map((theme) => (
                <div key={theme.key} className="overflow-hidden rounded-[22px] border border-white/8 bg-[#151020]">
                  <img src={theme.artwork} alt={theme.label} className="aspect-[0.92] w-full object-cover" />
                  <div className="p-3.5">
                    <p className="text-[1rem] font-semibold text-white">{theme.label}</p>
                    <p className="mt-2 text-[0.82rem] text-white/55">{theme.unlocks}</p>
                  </div>
                </div>
              ))}
              <div className="flex min-h-[270px] flex-col items-center justify-center rounded-[22px] border border-white/8 bg-[#151020] p-6 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full border border-[#65408d] bg-[#1f172c] text-[#cf9cff]">
                  <Icon kind="lotus" className="h-7 w-7" />
                </div>
                <p className="mt-5 text-[1.35rem] font-semibold text-white">More coming soon</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr] xl:items-start">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#d2a9ff]">Why Tranqly is different</p>
                <h2 className="mt-4 max-w-[12ch] text-[3.1rem] font-black leading-tight text-white">
                  Most AI journals forget you. <span className="text-[#bb7aff]">Tranqly doesn&apos;t.</span>
                </h2>
              </div>
              <div>
                <p className="max-w-[44rem] text-[1.28rem] leading-[1.7] text-white/74">
                  Instead of responding to today&apos;s entry and starting over tomorrow, Tranqly quietly remembers what matters.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {memorySignals.map((item) => (
                    <div key={item} className="rounded-[20px] border border-white/8 bg-white/[0.02] p-4">
                      <div className="mb-3 text-[#cf9cff]">
                        <Icon kind={item.includes("energy") ? "growth" : item.includes("helps") ? "heart" : item.includes("patterns") ? "brain" : item.includes("growing") ? "sprout" : "lotus"} />
                      </div>
                      <p className="text-sm font-semibold text-white/88">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          <section className="grid gap-6 xl:grid-cols-[0.7fr_1fr_0.9fr]">
            <GlassCard className="p-6">
              <p className="text-[2rem] font-semibold text-white">Free</p>
              <ul className="mt-5 space-y-3 text-white/72">
                {["Unlimited reflections", "Voice or text", "Daily AI insights", "1 sanctuary"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#22162f] text-xs text-[#d2a9ff]">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-[2rem] font-semibold text-[#d6a2ff]">Plus</p>
                <span className="rounded-full border border-[#69438f] bg-[#24152f] px-3 py-1 text-[11px] font-semibold text-[#d6a2ff]">Most Popular</span>
              </div>
              <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <ul className="space-y-3 text-white/72">
                  {plusFeatures.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-[#22162f] text-xs text-[#d2a9ff]">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="rounded-[24px] border border-white/8 bg-white/[0.02] p-6 text-center">
                  {!launchMode ? <p className="text-lg text-white/45 line-through">$5.99 / month</p> : null}
                  <p className="mt-3 text-[3.1rem] font-black text-white">{launchMode ? "$5.99" : "$3.99"}</p>
                  <p className="text-[1.3rem] text-white/82">/ month</p>
                  <p className="mt-2 text-[1.35rem] font-black text-white">{launchMode ? "or $59.99/year" : "for life"}</p>
                  <p className="mt-4 text-sm text-white/48">{launchMode ? "Choose monthly or yearly in Tranqly Plus." : "Early access pricing. Limited time."}</p>
                  {launchMode ? <Link href="/app" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#8038f0] to-[#a855f7] px-5 text-sm font-bold text-white">Get started</Link> : null}
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <div className="rounded-[22px] border border-white/8 bg-[#140f20] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-white">Weekly Reflection</p>
                  <span className="rounded-full border border-[#7c56b0] px-3 py-1 text-[10px] font-semibold text-[#d6a2ff]">Plus Premium</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/58">Unlock your full weekly reflection every Sunday.</p>
                <div className="mt-5 rounded-[16px] bg-[#8d4f8d] px-4 py-3 text-center text-sm font-semibold text-white">View reflection</div>
              </div>
              <div className="mt-4 rounded-[22px] border border-white/8 bg-[#140f20] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d4a4ff]">Notifications</p>
                  <span className="rounded-full border border-white/12 px-3 py-1 text-[10px] font-semibold text-white/48">Ready</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/58">Gentle reminders for reflections, weekly insights, and new sanctuaries.</p>
                <div className="mt-5 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white/78">
                  Quiet reminders, weekly insights, and sanctuary unlocks
                </div>
              </div>
            </GlassCard>
          </section>

          {!launchMode ? <GlassCard id="waitlist" className="p-6">
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-center">
              <div className="flex items-start gap-4">
                <div className="relative grid h-16 w-16 place-items-center rounded-full bg-[#22162f] shadow-[0_0_32px_rgba(142,78,255,0.24)]">
                  <div className="absolute inset-0 rounded-full bg-[#8e4eff]/25 blur-xl" />
                  <img src="/tranqly_logo.png" alt="" className="relative h-9 w-9 object-contain" />
                </div>
                <div>
                  <h3 className="text-[2.1rem] font-semibold text-white">Be the first to know when Tranqly launches.</h3>
                  <p className="mt-2 text-[1.05rem] leading-7 text-white/64">Join the waitlist for early access and exclusive perks.</p>
                </div>
              </div>
              <div>
                <WaitlistSignup compact />
              </div>
            </div>
          </GlassCard> : null}

          <footer className="flex flex-col items-center justify-between gap-4 px-2 pb-2 text-sm text-white/45 sm:flex-row">
            <p>© {new Date().getFullYear()} Tranqly. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
              <a href="mailto:support@tranqly.com" className="hover:text-white">Support</a>
            </div>
          </footer>
        </div>
      </div>
      {previewImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label={previewImage.alt}
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-white/12 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => setPreviewImage(null)}
          >
            Close
          </button>
          <div className="max-h-[92vh] max-w-[min(92vw,520px)] overflow-hidden rounded-[36px] border border-white/12 bg-[#070610] p-2 shadow-[0_30px_100px_rgba(0,0,0,0.7)]">
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="block max-h-[88vh] w-auto rounded-[28px] object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
