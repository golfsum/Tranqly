"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { applyTheme } from "@/lib/themes";

/** Keeps the CSS accent variables in sync with the chosen theme. */
export default function ThemeApplier() {
  const theme = useApp((s) => s.settings.theme);
  const hydrated = useApp((s) => s.hydrated);

  useEffect(() => {
    if (hydrated) applyTheme(theme);
  }, [theme, hydrated]);

  return null;
}
