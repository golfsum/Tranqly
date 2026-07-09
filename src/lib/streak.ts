import { dateKeyOf } from "./types";

type Dated = { dateKey: string };

/**
 * Current streak = consecutive days (ending today or yesterday) with at
 * least one check-in. A streak that ended yesterday still counts so it
 * doesn't feel broken before the user has a chance to reflect today.
 */
export function currentStreak(entries: Dated[]): number {
  const days = new Set(entries.map((e) => e.dateKey));
  if (days.size === 0) return 0;

  const cursor = new Date();
  if (!days.has(dateKeyOf(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dateKeyOf(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dateKeyOf(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function bestStreak(entries: Dated[]): number {
  const days = [...new Set(entries.map((e) => e.dateKey))].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of days) {
    const d = new Date(key + "T12:00:00");
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86_400_000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Check-ins per day for the last `n` days, oldest first. */
export function lastNDays(entries: Dated[], n: number): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.dateKey, (counts.get(e.dateKey) ?? 0) + 1);
  const out: { key: string; count: number }[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = dateKeyOf(cursor);
    out.push({ key, count: counts.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
