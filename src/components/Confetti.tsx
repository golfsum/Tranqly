"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

// Calm palette, soft lavender, teal, rose petals
const COLORS = ["#A78BFA", "#5EEAD4", "#FDA4AF", "#C4B5FD", "#99F6E4"];

interface Particle {
  id: number;
  x: number;
  delay: number;
  color: string;
  rotate: number;
  size: number;
}

/** Gentle celebration drift, fires whenever `trigger` increments. */
export default function Confetti({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    const burst: Particle[] = Array.from({ length: 18 }, (_, i) => ({
      id: trigger * 100 + i,
      x: 8 + Math.random() * 84,
      delay: Math.random() * 0.35,
      color: COLORS[i % COLORS.length],
      rotate: Math.random() * 360 - 180,
      size: 6 + Math.random() * 6,
    }));
    setParticles(burst);
    const t = setTimeout(() => setParticles([]), 2400);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ y: "-6vh", x: 0, opacity: 0.9, rotate: 0 }}
            animate={{ y: "108vh", rotate: p.rotate, opacity: [0.9, 0.9, 0.7, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.1, delay: p.delay, ease: [0.25, 0.5, 0.45, 1] }}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: 0,
              width: p.size,
              height: p.size * 0.5,
              borderRadius: 3,
              background: p.color,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
