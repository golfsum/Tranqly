"use client";

import { themeByKey } from "@/lib/themes";

function glyphPath(themeKey: string, color: string) {
  if (themeKey === "ocean") {
    return (
      <path
        d="M6 15c3-4 6-4 9 0s6 4 9 0 5-3 7-1M10 10c3-4 6-4 9 0s5 3 8 1"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    );
  }
  if (themeKey === "forest") {
    return (
      <>
        <path d="M18 4 8 18h7L6 30h24l-9-12h7L18 4Z" stroke={color} strokeWidth="2.3" strokeLinejoin="round" />
        <path d="M18 20v10" stroke={color} strokeWidth="2.3" strokeLinecap="round" />
      </>
    );
  }
  if (themeKey === "sunrise") {
    return (
      <>
        <path d="M7 24h22M11 24a7 7 0 0 1 14 0" stroke={color} strokeWidth="2.3" strokeLinecap="round" />
        <path d="M18 7v5M8 17l4 2M28 17l-4 2M11 10l4 4M25 10l-4 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  if (themeKey === "blossom") {
    return (
      <>
        {[0, 72, 144, 216, 288].map((rotation) => (
          <ellipse
            key={rotation}
            cx="18"
            cy="12"
            rx="4"
            ry="8"
            stroke={color}
            strokeWidth="2"
            transform={`rotate(${rotation} 18 18)`}
          />
        ))}
        <circle cx="18" cy="18" r="3" fill={color} />
      </>
    );
  }
  return (
    <>
      <path
        d="M23 5c-6 2-10 7-10 13 0 7 5 12 12 13-2 1-4 1-7 1C10 32 4 26 4 18S10 4 18 4c2 0 4 0 5 1Z"
        stroke={color}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="m27 12 1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4Z" stroke={color} strokeWidth="1.8" />
    </>
  );
}

export default function ThemeUserAvatar({
  themeKey,
  size = 36,
}: {
  themeKey: string;
  size?: number;
}) {
  const theme = themeByKey(themeKey);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border border-calm/30 bg-calm/12 shadow-glow"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 36 36" fill="none">
        {glyphPath(theme.key, theme.calm)}
      </svg>
    </span>
  );
}
