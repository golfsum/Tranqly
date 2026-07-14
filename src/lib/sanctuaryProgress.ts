import type { CheckIn } from "./types";

export const SANCTUARY_PROGRESSION = [
  { key: "cloud", name: "Cloud Sanctuary", requiredReflectionDays: 0 },
  { key: "twilight", name: "Twilight Grove", requiredReflectionDays: 0 },
  { key: "blossom", name: "Blossom Garden", requiredReflectionDays: 0 },
  { key: "forest", name: "Forest Haven", requiredReflectionDays: 7 },
  { key: "ocean", name: "Ocean Shore", requiredReflectionDays: 14 },
  { key: "sunrise", name: "Sunrise Meadow", requiredReflectionDays: 21 },
  { key: "misty", name: "Misty Hollow", requiredReflectionDays: 28 },
  { key: "desert", name: "Desert Oasis", requiredReflectionDays: 35 },
  { key: "mountain", name: "Mountain Retreat", requiredReflectionDays: 42 },
  { key: "northern", name: "Aurora Valley", requiredReflectionDays: 49 },
] as const;

export function isQualifyingReflection(checkIn: CheckIn) {
  const id = checkIn.id.toLowerCase();
  return !id.includes("demo") && !id.includes("admin-test") && Boolean(checkIn.dateKey);
}

export function reflectionDayCount(checkIns: CheckIn[]) {
  return new Set(checkIns.filter(isQualifyingReflection).map((entry) => entry.dateKey)).size;
}

export function currentWeekReflectionDayCount(checkIns: CheckIn[], now = new Date()) {
  const start = new Date(now);
  const day = (start.getDay() + 6) % 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return new Set(
    checkIns
      .filter(isQualifyingReflection)
      .filter((entry) => new Date(entry.createdAt) >= start)
      .map((entry) => entry.dateKey)
  ).size;
}

export function sanctuaryProgress(checkIns: CheckIn[]) {
  const totalReflectionDays = reflectionDayCount(checkIns);
  const unlocked = SANCTUARY_PROGRESSION.filter(
    (item) => totalReflectionDays >= item.requiredReflectionDays
  );
  const next = SANCTUARY_PROGRESSION.find(
    (item) => totalReflectionDays < item.requiredReflectionDays
  ) ?? null;

  return {
    totalReflectionDays,
    unlockedSanctuaryIds: unlocked.map((item) => item.key),
    next,
    remaining: next ? next.requiredReflectionDays - totalReflectionDays : 0,
  };
}
