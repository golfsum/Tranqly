"use client";

import { motion } from "framer-motion";
import { tap } from "@/lib/haptics";

export type Tab = "today" | "journey" | "settings";

const TABS: { key: Tab; label: string; icon: (active: boolean) => JSX.Element }[] = [
  {
    key: "today",
    label: "Insights",
    icon: (a) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 21s-7.5-4.7-9.5-9A5.4 5.4 0 0 1 12 6.6 5.4 5.4 0 0 1 21.5 12c-2 4.3-9.5 9-9.5 9Z"
          fill={a ? "url(#heart)" : "none"}
          stroke={a ? "none" : "currentColor"}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="heart" x1="3" y1="4" x2="21" y2="21">
            <stop stopColor="#A78BFA" />
            <stop offset="1" stopColor="#5EEAD4" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    key: "journey",
    label: "Journey",
    icon: (a) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 19c4-1 3-6 7-7s4-5 8-6"
          stroke={a ? "#A78BFA" : "currentColor"}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="4" cy="19" r="2" fill={a ? "#5EEAD4" : "currentColor"} />
        <circle cx="19" cy="6" r="2" fill={a ? "#A78BFA" : "currentColor"} />
      </svg>
    ),
  },
  {
    key: "settings",
    label: "You",
    icon: (a) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="8"
          r="3.6"
          stroke={a ? "#A78BFA" : "currentColor"}
          strokeWidth="2"
        />
        <path
          d="M4.5 20a7.5 7.5 0 0 1 15 0"
          stroke={a ? "#A78BFA" : "currentColor"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function TabBar({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-40 mx-auto max-w-lg rounded-[2rem] border border-edge bg-ink/90 shadow-2xl shadow-black/30 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map(({ key, label, icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => {
                tap();
                onChange(key);
              }}
              className="relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 pt-2 short-fit:min-h-[48px] short-fit:pt-1 shorter:min-h-[40px] shorter:gap-0 shorter:pt-0.5"
              aria-label={label}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute top-0 h-[3px] w-10 rounded-full bg-gradient-to-r from-calm to-sea"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className={active ? "text-fg [&>svg]:h-6 [&>svg]:w-6 short-fit:[&>svg]:h-5 short-fit:[&>svg]:w-5 shorter:[&>svg]:h-4 shorter:[&>svg]:w-4" : "text-faint [&>svg]:h-6 [&>svg]:w-6 short-fit:[&>svg]:h-5 short-fit:[&>svg]:w-5 shorter:[&>svg]:h-4 shorter:[&>svg]:w-4"}>
                {icon(active)}
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  active ? "text-fg" : "text-faint"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
