"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { tap } from "@/lib/haptics";
import { useApp } from "@/lib/store";

const PERKS = [
  {
    title: "Another week of thoughtful responses",
    desc: "Keep reflecting without turning your first week into a wall",
  },
  {
    title: "Weekly reflections",
    desc: "Receive a thoughtful summary that builds on what you share",
  },
  {
    title: "More sanctuaries to explore",
    desc: "Keep every place you earn and discover new ones over time",
  },
  {
    title: "More personal guidance over time",
    desc: "Tranqly can keep noticing what helps you feel steady",
  },
];

function LotusMark() {
  return (
    <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border border-calm/35 bg-calm/10 text-calm shadow-glow">
      <svg viewBox="0 0 48 48" fill="none" className="h-8 w-8" aria-hidden>
        <path d="M24 31c-6-7-6-15 0-21 6 6 6 14 0 21Z" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 31c-8-.5-14-5-17-12 8 .5 14 5 17 12ZM25 31c8-.5 14-5 17-12-8 .5-14 5-17 12Z" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 36c6-2.5 18-2.5 24 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function PremiumModal({
  open,
  onClose,
  onUpgraded,
  initialPlan = "yearly",
}: {
  open: boolean;
  onClose: () => void;
  onUpgraded: () => void;
  initialPlan?: "yearly" | "monthly";
}) {
  const setPremium = useApp((s) => s.setPremium);
  const [busy, setBusy] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"yearly" | "monthly">(initialPlan);

  useEffect(() => {
    if (open) setSelectedPlan(initialPlan);
  }, [initialPlan, open]);

  const checkout = async () => {
    tap();
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.demo && process.env.NODE_ENV !== "production") {
        setPremium(true);
        onUpgraded();
        return;
      }
      alert("Checkout couldn't start. Please try again.");
    } catch {
      alert("Checkout couldn't start. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-[28px] border border-b-0 border-edge bg-card p-6 shadow-card"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
            role="dialog"
            aria-modal="true"
            aria-label="Tranqly Plus"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-edge" />

            <div className="mb-5 text-center">
              <motion.div
                initial={{ scale: 0.5, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 14 }}
              >
                <LotusMark />
              </motion.div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Ready for another week?
              </h2>
              <p className="mt-1 text-sm text-dim">Your first week is yours to keep, whether you continue or not.</p>
              <p className="mt-3 text-sm leading-relaxed text-dim">
                Your first week helped uncover meaningful patterns. Continue whenever it feels right.
              </p>
            </div>

            <ul className="mb-6 flex flex-col gap-3">
              {PERKS.map((p, i) => (
                <motion.li
                  key={p.title}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.06 }}
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-calm/20 bg-calm/10 text-sm font-black text-calm">
                    +
                  </span>
                  <div>
                    <p className="font-semibold leading-tight">{p.title}</p>
                    <p className="text-sm text-dim">{p.desc}</p>
                  </div>
                </motion.li>
              ))}
            </ul>

            <div className="mb-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing period">
              <button
                type="button"
                role="radio"
                aria-checked={selectedPlan === "yearly"}
                onClick={() => setSelectedPlan("yearly")}
                className={`rounded-2xl border p-3 text-left transition ${selectedPlan === "yearly" ? "border-calm bg-calm/10" : "border-edge bg-ink"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black">Yearly</span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-calm">Best value</span>
                </span>
                <span className="mt-1 block text-sm font-bold">$59.99 per year</span>
                <span className="mt-0.5 block text-[11px] text-faint">About $5 per month</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={selectedPlan === "monthly"}
                onClick={() => setSelectedPlan("monthly")}
                className={`rounded-2xl border p-3 text-left transition ${selectedPlan === "monthly" ? "border-calm bg-calm/10" : "border-edge bg-ink"}`}
              >
                <span className="text-sm font-black">Monthly</span>
                <span className="mt-1 block text-sm font-bold">$5.99 per month</span>
                <span className="mt-0.5 block text-[11px] text-faint">Billed monthly</span>
              </button>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={checkout}
              disabled={busy}
              className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-calm to-sea text-lg font-bold text-ink shadow-glow disabled:opacity-60"
            >
              {busy
                ? "Opening checkout..."
                : "Begin Week Two"}
            </motion.button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-faint">
              Billing starts only after you confirm a paid plan. Your saved reflections and first weekly reflection remain available if you do not continue.
            </p>
            <button
              onClick={onClose}
              className="mt-3 min-h-[44px] w-full text-sm font-semibold text-faint"
            >
              Not right now
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
