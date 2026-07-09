export type ReminderMode = "manual" | "adaptive";
export type PermissionStatus = "granted" | "denied" | "unknown";
export type QuietMinuteOption = "morning" | "afternoon" | "evening" | "before_bed" | "custom";

interface CheckInLike {
  createdAt: string;
}

export interface NotificationSettings {
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  weeklyInsightEnabled: boolean;
  weeklyInsightDay: "sunday";
  weeklyInsightTime: string;
  sanctuaryUnlockEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  reminderMode: ReminderMode;
  permissionStatus: PermissionStatus;
  lastReminderSentAt: string | null;
  lastReminderOpenedAt: string | null;
  lastReflectionAt: string | null;
  commonReflectionHour: number | null;
  pauseReminders: boolean;
  quietMinuteOption: QuietMinuteOption;
  notificationPromptShown: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyReminderEnabled: false,
  dailyReminderTime: "19:30",
  weeklyInsightEnabled: true,
  weeklyInsightDay: "sunday",
  weeklyInsightTime: "19:00",
  sanctuaryUnlockEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: "21:00",
  quietHoursEnd: "08:00",
  reminderMode: "manual",
  permissionStatus: "unknown",
  lastReminderSentAt: null,
  lastReminderOpenedAt: null,
  lastReflectionAt: null,
  commonReflectionHour: null,
  pauseReminders: false,
  quietMinuteOption: "evening",
  notificationPromptShown: false,
};

export const QUIET_MINUTE_OPTIONS: Array<{
  key: QuietMinuteOption;
  label: string;
  suggestedTime: string;
}> = [
  { key: "morning", label: "Morning", suggestedTime: "08:00" },
  { key: "afternoon", label: "Afternoon", suggestedTime: "13:00" },
  { key: "evening", label: "Evening", suggestedTime: "19:30" },
  { key: "before_bed", label: "Before bed", suggestedTime: "21:30" },
  { key: "custom", label: "Custom time", suggestedTime: "19:30" },
];

function parseTimeParts(value: string) {
  const [hoursRaw = "19", minutesRaw = "30"] = value.split(":");
  const hours = Math.max(0, Math.min(23, Number(hoursRaw) || 0));
  const minutes = Math.max(0, Math.min(59, Number(minutesRaw) || 0));
  return { hours, minutes };
}

export function formatHourLabel(value: string) {
  const { hours, minutes } = parseTimeParts(value);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function updateReflectionTiming(
  settings: NotificationSettings,
  createdAt: string,
  checkIns: CheckInLike[]
) {
  const created = new Date(createdAt);
  const recent = [created, ...checkIns.slice(0, 19).map((entry) => new Date(entry.createdAt))];
  const hourCounts = new Map<number, number>();
  for (const date of recent) {
    const hour = date.getHours();
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const commonReflectionHour =
    [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? created.getHours();

  return {
    ...settings,
    lastReflectionAt: createdAt,
    commonReflectionHour,
  };
}

export function adaptiveSuggestion(settings: NotificationSettings) {
  if (settings.reminderMode !== "adaptive" || settings.commonReflectionHour === null) return null;
  const suggestion = `${String(settings.commonReflectionHour).padStart(2, "0")}:30`;
  if (suggestion === settings.dailyReminderTime) return null;
  return {
    time: suggestion,
    copy: `Evenings seem to work well for you. Want reminders around ${formatHourLabel(suggestion)}?`,
  };
}

export function dailyReminderCadenceDays(settings: NotificationSettings) {
  if (!settings.lastReminderSentAt) return 1;
  const lastSent = new Date(settings.lastReminderSentAt);
  const lastOpened = settings.lastReminderOpenedAt ? new Date(settings.lastReminderOpenedAt) : null;
  const lastReflection = settings.lastReflectionAt ? new Date(settings.lastReflectionAt) : null;
  if ((lastOpened && lastOpened > lastSent) || (lastReflection && lastReflection > lastSent)) {
    return 1;
  }
  const daysSinceSent = Math.floor((Date.now() - lastSent.getTime()) / 86400000);
  if (daysSinceSent >= 7) return 7;
  if (daysSinceSent >= 3) return 3;
  return 1;
}

export function isTimeWithinQuietHours(time: string, settings: NotificationSettings) {
  if (!settings.quietHoursEnabled) return false;
  const current = parseTimeParts(time).hours * 60 + parseTimeParts(time).minutes;
  const start = parseTimeParts(settings.quietHoursStart).hours * 60 + parseTimeParts(settings.quietHoursStart).minutes;
  const end = parseTimeParts(settings.quietHoursEnd).hours * 60 + parseTimeParts(settings.quietHoursEnd).minutes;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function adjustedTimeForQuietHours(time: string, settings: NotificationSettings) {
  if (!isTimeWithinQuietHours(time, settings)) return time;
  return settings.quietHoursEnd;
}
