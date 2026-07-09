"use client";

import { motion } from "framer-motion";

/**
 * The coach's face: a soft gradient circle with kind eyes and a warm smile.
 * Blinks occasionally so it feels alive without being distracting.
 */
export default function CoachAvatar({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-calm to-sea shadow-glow"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        {/* eyes, gentle blink */}
        <motion.g
          animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{
            duration: 4.5,
            times: [0, 0.46, 0.5, 0.54, 1],
            repeat: Infinity,
          }}
          style={{ originY: "9px" as unknown as number }}
        >
          <circle cx="8" cy="9" r="1.7" fill="#0B0E14" />
          <circle cx="16" cy="9" r="1.7" fill="#0B0E14" />
        </motion.g>
        {/* warm smile */}
        <path
          d="M7.5 14.5c1.2 1.8 2.7 2.7 4.5 2.7s3.3-.9 4.5-2.7"
          stroke="#0B0E14"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        {/* rosy cheeks */}
        <circle cx="5.4" cy="12.4" r="1.2" fill="#0B0E14" opacity="0.18" />
        <circle cx="18.6" cy="12.4" r="1.2" fill="#0B0E14" opacity="0.18" />
      </svg>
    </span>
  );
}
