"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { tap } from "@/lib/haptics";
import { useApp } from "@/lib/store";

function LotusThemeIcon({ size = 72 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border border-[#d8c4ff]/35 bg-[#d8c4ff]/16 shadow-[0_0_34px_rgb(var(--calm-rgb)/0.36)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 96 96"
        fill="none"
        className="h-[72%] w-[72%] text-calm drop-shadow-[0_0_18px_rgb(var(--calm-rgb)/0.25)]"
      >
        <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="3" opacity="0.92" />
        <path
          d="M48 61c-9-11-9-24 0-34 9 10 9 23 0 34Z"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M47 61c-13-1-22-8-27-20 13 1 22 8 27 20ZM49 61c13-1 22-8 27-20-13 1-22 8-27 20Z"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M28 70c9-4 31-4 40 0M34 76c8-2 20-2 28 0"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** First-launch welcome. Shows once, then never again. */
export default function Onboarding() {
  const onboarded = useApp((s) => s.settings.onboarded);
  const hydrated = useApp((s) => s.hydrated);
  const updateSettings = useApp((s) => s.updateSettings);
  const [name, setName] = useState("");
  const [step, setStep] = useState<"intro" | "name">("intro");

  const finish = () => {
    tap();
    updateSettings({
      onboarded: true,
      name: name.trim(),
      onboardingCoachCompleted: false,
      onboardingCoachStep: "mic",
      onboardingSkippedAt: null,
      onboardingCompletedAt: null,
    });
  };

  const open = hydrated && !onboarded;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md"
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="pointer-events-auto w-full max-w-sm rounded-[28px] border border-edge bg-card p-6 text-center shadow-card"
              role="dialog"
              aria-modal="true"
              aria-label="Welcome to Tranqly"
            >
            <div className="mb-4 flex justify-center">
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.15 }}
              >
                <LotusThemeIcon size={72} />
              </motion.div>
            </div>

            {step === "intro" ? (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl border border-edge bg-ink/60 px-4 py-4"
                >
                  <h2 className="text-2xl font-black tracking-tight">
                    Welcome to Tranqly.
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-dim">
                    This is your quiet place to reflect for a minute each day. No
                    pressure. No judgment. Just one honest moment at a time.
                  </p>
                </motion.div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    tap();
                    setStep("name");
                  }}
                  className="mx-auto mt-4 flex min-h-[54px] min-w-[220px] items-center justify-center whitespace-nowrap rounded-2xl bg-gradient-to-r from-calm to-sea px-8 font-bold text-ink shadow-glow"
                >
                  Continue
                </motion.button>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-2xl border border-edge bg-ink/60 px-4 py-4"
                >
                  <h2 className="text-2xl font-black tracking-tight">
                    Make it yours.
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-dim">
                    Add a first name if you want Tranqly to greet you personally.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 text-left"
                >
                  <label className="mb-1.5 block text-sm font-medium text-dim">
                    What should I call you? (optional)
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && finish()}
                    placeholder="Your name"
                    className="min-h-[48px] w-full rounded-2xl border border-edge bg-ink px-4 text-fg placeholder-faint outline-none focus:border-calm/60"
                  />
                </motion.div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={finish}
                  className="mx-auto mt-4 flex min-h-[54px] min-w-[220px] items-center justify-center whitespace-nowrap rounded-2xl bg-gradient-to-r from-calm to-sea px-8 font-bold text-ink shadow-glow"
                >
                  Enter Your Sanctuary
                </motion.button>
              </>
            )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
