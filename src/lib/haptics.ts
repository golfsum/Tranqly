"use client";

/**
 * Tiny haptics helper. iOS Safari doesn't expose navigator.vibrate, but
 * Android PWAs do, and on iOS the WebKit "click" through a <label> tap
 * still gives native feel. Calls are safe no-ops when unsupported.
 */
export function tap() {
  try {
    navigator.vibrate?.(10);
  } catch {}
}

export function success() {
  try {
    navigator.vibrate?.([15, 40, 25]);
  } catch {}
}
