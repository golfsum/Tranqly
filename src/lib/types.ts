import type { ComplimentaryAccess } from "./access";

export type Mood = "amazing" | "good" | "okay" | "meh" | "rough";

export const MOODS: { key: Mood; emoji: string; label: string }[] = [
  { key: "amazing", emoji: "🤩", label: "Amazing" },
  { key: "good", emoji: "😊", label: "Good" },
  { key: "okay", emoji: "🙂", label: "Okay" },
  { key: "meh", emoji: "😑", label: "Meh" },
  { key: "rough", emoji: "😮‍💨", label: "Rough" },
];

export interface CoachReply {
  message: string;
  nextStep: string;
  title?: string;
  preview?: string;
  nudgeLabel?: "A Gentle Next Step" | "Something to Try" | "A Question to Carry" | "Something to Notice" | "A Little Reassurance" | "Something to Remember" | "A Different Perspective" | "One Small Reminder" | "Something Worth Holding Onto" | "A Gentle Question" | "Looking Ahead";
  pattern?: string;
  summary?: string;
  themes?: string[];
  tags?: string[];
  emotionalTone?: string;
  followUpQuestions?: string[];
  source: "ai" | "local";
  createdAt: string;
}

export interface CheckIn {
  id: string;
  text: string;
  createdAt: string;
  dateKey: string;
  source?: "voice" | "typed";
  prompt?: string;
  promptType?: string;
  promptWhy?: string;
  reply?: CoachReply;
}

export interface MemoryTopic {
  topic: string;
  count: number;
  lastMentionedAt: string;
  trend: "increasing" | "steady";
  tone: "mixed" | "heavy" | "steady" | "encouraging";
}

export interface MemorySignal {
  label: string;
  count: number;
  lastSeenAt: string;
}

export interface MemoryProfile {
  recurringTopics: MemoryTopic[];
  values: MemorySignal[];
  helpfulActions: MemorySignal[];
  recurringStruggles: MemorySignal[];
  wins: MemorySignal[];
  reflectionStyle: {
    preferredTimeOfDay: "morning" | "afternoon" | "evening" | "night";
    preferredInput: "voice" | "typed" | "mixed";
    typicalLength: "short" | "medium" | "long";
    tonePreference: "gentle";
  };
  sanctuaryStyle: {
    currentTheme: string;
    promptFlavor: string;
  };
  summaryLines: string[];
}

export interface PromptSelection {
  prompt: string;
  whyThisQuestion: string;
  promptType: string;
  memoryUsed: string[];
  confidence: number;
}

export interface SanctuaryUnlockNotification {
  themeId: string;
  unlockedAt: string;
  notificationSentAt: string | null;
}

export interface Settings {
  name: string;
  premium: boolean;
  soundOn: boolean;
  theme: string;
  activeSceneId?: string;
  notificationSettings?: import("./notifications").NotificationSettings;
  onboarded: boolean;
  onboardingCoachCompleted?: boolean;
  onboardingCoachStep?: "mic" | "journey" | "sanctuary" | null;
  onboardingSkippedAt?: string | null;
  onboardingCompletedAt?: string | null;
  reflectionCoachMarkSeen?: boolean;
  journeyCoachMarkSeen?: boolean;
  sanctuaryCoachMarkSeen?: boolean;
  onboardingStatus?: "not_started" | "in_progress" | "completed" | "skipped";
  currentOnboardingStep?:
    | "welcome"
    | "name"
    | "firstWeek"
    | "freeWeek"
    | "trial"
    | "reflectionCoach"
    | "journeyCoach"
    | "sanctuaryCoach"
    | null;
  onboardingVersion?: number;
  complimentaryAccess?: ComplimentaryAccess | null;
}

export type SanctuarySceneStatus = "draft" | "preview" | "live" | "archived";

export type SanctuaryUnlockRequirementType =
  | "complete_previous_scene"
  | "total_checkins"
  | "premium"
  | "manual";

export interface SanctuarySceneObjectLayout {
  x: number;
  y: number;
  scale: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex: number;
  spawnStart?: number;
  spawnEnd?: number;
  replacementGroup?: string;
  animation?: "none" | "float" | "pulse" | "sway" | "glow";
  visible?: boolean;
  locked?: boolean;
}

export interface SanctuarySceneConfig {
  id: string;
  name: string;
  status: SanctuarySceneStatus;
  requiredPreviousSceneId?: string;
  unlockRequirementType: SanctuaryUnlockRequirementType;
  unlockRequirementValue?: number | string | boolean;
  maxCheckIns: number;
  sortOrder: number;
  publishedAt?: string;
  updatedAt: string;
  previewImage: string;
  backgroundAssetUrl: string;
  groundAssetUrl: string;
  assetUrls: string[];
  unlockableObjects: string[];
  objectAssets?: Record<string, string>;
  objectLayout?: Record<string, SanctuarySceneObjectLayout>;
  premium?: boolean;
}

export interface SanctuarySceneVersion {
  sceneId: string;
  versionNumber: number;
  config: SanctuarySceneConfig;
  publishedAt: string;
  publishedBy: string;
}

export interface DeepInsight {
  headline: string;
  insight: string;
  pattern?: string;
  suggestion: string;
  affirmation: string;
  gentleFocusTitle?: string;
  evidenceLevel?: "limited" | "emerging" | "meaningful" | "strong";
  completionMessage?: string;
  reflectionDays?: number;
  reflectionCount?: number;
  rewardUnlocked?: boolean;
  rewardId?: string;
  recurring_themes?: string[];
  mood_trend?: string;
  next_focus?: string;
  confidence?: number;
  safety_flags?: string[];
  source: "ai" | "local";
  createdAt: string;
  isDemo?: boolean;
  weekStart?: string;
  weekEnd?: string;
}

export function dateKeyOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKeyOf(new Date());
}

export function growthEmoji(streak: number): string {
  if (streak === 0) return "🌰";
  if (streak < 7) return "🌱";
  if (streak < 21) return "🌿";
  return "🌳";
}
