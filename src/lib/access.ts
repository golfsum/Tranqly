export type ComplimentaryAccessStatus = "active" | "completed" | "expired";

export interface ComplimentaryAccess {
  startedAt: string;
  endsAt: string;
  status: ComplimentaryAccessStatus;
  source: "first_week";
  weeklyReflectionDeliveredAt: string | null;
  conversionPromptShownAt: string | null;
  isDemo?: boolean;
}

const FIRST_WEEK_DAYS = 7;

export function createFirstWeekAccess(now = new Date()): ComplimentaryAccess {
  const startedAt = now.toISOString();
  const endsAtDate = new Date(now);
  endsAtDate.setDate(endsAtDate.getDate() + FIRST_WEEK_DAYS);
  return {
    startedAt,
    endsAt: endsAtDate.toISOString(),
    status: "active",
    source: "first_week",
    weeklyReflectionDeliveredAt: null,
    conversionPromptShownAt: null,
  };
}

export function normalizeComplimentaryAccess(
  access?: ComplimentaryAccess | null,
  now = new Date()
): ComplimentaryAccess | null {
  if (!access) return null;
  if (access.status !== "active") return access;
  return new Date(access.endsAt).getTime() <= now.getTime()
    ? { ...access, status: "expired" }
    : access;
}

export function hasActiveComplimentaryAccess(access?: ComplimentaryAccess | null, now = new Date()) {
  return normalizeComplimentaryAccess(access, now)?.status === "active";
}

export function hasTranqlyAccess(premium: boolean, access?: ComplimentaryAccess | null) {
  return premium || hasActiveComplimentaryAccess(access);
}

export function formatAccessEndDate(access?: ComplimentaryAccess | null) {
  if (!access) return "";
  return new Date(access.endsAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
