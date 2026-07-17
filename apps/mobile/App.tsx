import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { Audio } from "expo-av";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { Component, ErrorInfo, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Keyboard,
  LayoutChangeEvent,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from "react-native-svg";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { getPasswordStrength, isPasswordValid, passwordRuleItems } from "./lib/authRules";
import {
  createMobileSupportTicket,
  MobileSupportCategory,
  syncMobileUserProfile,
} from "./lib/firestoreRest";
import {
  adjustedTimeForQuietHours,
  adaptiveSuggestion,
  dailyReminderCadenceDays,
  DEFAULT_NOTIFICATION_SETTINGS,
  formatHourLabel,
  NotificationSettings,
  QUIET_MINUTE_OPTIONS,
  updateReflectionTiming,
} from "./lib/notifications";

WebBrowser.maybeCompleteAuthSession();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type Tab = "coach" | "journey" | "you";

interface CoachReply {
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

interface CheckIn {
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

interface DeepInsight {
  headline: string;
  insight: string;
  suggestion: string;
  affirmation: string;
  createdAt: string;
  isDemo?: boolean;
  weekStart?: string;
  weekEnd?: string;
  gentleFocusTitle?: string;
  evidenceLevel?: "limited" | "emerging" | "meaningful" | "strong";
  completionMessage?: string;
  reflectionDays?: number;
  reflectionCount?: number;
  rewardUnlocked?: boolean;
  rewardId?: string;
}

function mobileWeeklyInsightKey(insight: DeepInsight) {
  const date = new Date(insight.weekStart ?? insight.createdAt);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return insight.weekStart ?? date.toISOString().slice(0, 10);
}

function dedupeMobileWeeklyInsights(insights: DeepInsight[]) {
  const byWeek = new Map<string, DeepInsight>();
  for (const insight of [...insights].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = mobileWeeklyInsightKey(insight);
    if (!byWeek.has(key)) byWeek.set(key, insight);
  }
  return [...byWeek.values()].slice(0, 52);
}

interface MobileAuthUser {
  email: string;
  localId: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  providerId?: "apple.com" | "google.com" | "password";
}

interface AppState {
  checkIns: CheckIn[];
  premium: boolean;
  coachUsage?: { dateKey: string; count: number };
  moods: Record<string, string>;
  lastDeepInsight: DeepInsight | null;
  weeklyInsights?: DeepInsight[];
  authUser?: MobileAuthUser | null;
  displayName?: string;
  sanctuaryTheme?: SanctuaryThemeKey;
  notificationSettings?: NotificationSettings;
  sanctuaryUnlockNotifications?: Record<string, string | null>;
  seasonalSanctuaryUnlocks?: Record<string, string>;
  onboardingCompleted?: boolean;
  onboardingCoachCompleted?: boolean;
  onboardingCoachStep?: "mic" | "journey" | "sanctuary" | null;
  onboardingSkippedAt?: string | null;
  onboardingCompletedAt?: string | null;
  reflectionCoachMarkSeen?: boolean;
  journeyCoachMarkSeen?: boolean;
  sanctuaryCoachMarkSeen?: boolean;
  onboardingStatus?: "not_started" | "in_progress" | "completed" | "skipped";
  currentOnboardingStep?: OnboardingStep | null;
  onboardingVersion?: number;
  complimentaryAccess?: ComplimentaryAccess | null;
}

type ComplimentaryAccess = {
  startedAt: string;
  endsAt: string;
  status: "active" | "completed" | "expired";
  source: "first_week";
  weeklyReflectionDeliveredAt: string | null;
  conversionPromptShownAt: string | null;
  isDemo?: boolean;
};

type OnboardingStep =
  | "firstWeek"
  | "freeWeek"
  | "trial"
  | "reflectionCoach"
  | "journeyCoach"
  | "sanctuaryCoach";

type CoachTarget = { x: number; y: number; width: number; height: number; centerX: number; centerY: number };

type SanctuaryThemeKey =
  | "blossom"
  | "twilight"
  | "ocean"
  | "forest"
  | "sunrise"
  | "mountain"
  | "misty"
  | "desert"
  | "snowfall"
  | "northern"
  | "cloud";

const TABS: { key: Tab; label: string; icon: React.FC<{ active: boolean }> }[] = [
  {
    key: "coach",
    label: "Insights",
    icon: ({ active }) => (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        {active && (
          <Defs>
            <SvgLinearGradient id="heart" x1="3" y1="4" x2="21" y2="21">
              <Stop stopColor="#B894FF" />
              <Stop offset={1} stopColor="#D8C4FF" />
            </SvgLinearGradient>
          </Defs>
        )}
        <Path
          d="M12 21s-7.5-4.7-9.5-9A5.4 5.4 0 0 1 12 6.6 5.4 5.4 0 0 1 21.5 12c-2 4.3-9.5 9-9.5 9Z"
          fill={active ? "url(#heart)" : "none"}
          stroke={active ? "none" : "#7E8B9D"}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </Svg>
    ),
  },
  {
    key: "journey",
    label: "Journey",
    icon: ({ active }) => (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 19c4-1 3-6 7-7s4-5 8-6"
          stroke={active ? "#B894FF" : "#8E82AD"}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Circle cx={4} cy={19} r={2} fill={active ? "#D8C4FF" : "#8E82AD"} />
        <Circle cx={19} cy={6} r={2} fill={active ? "#B894FF" : "#8E82AD"} />
      </Svg>
    ),
  },
  {
    key: "you",
    label: "You",
    icon: ({ active }) => (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle
          cx={12}
          cy={8}
          r={3.6}
          stroke={active ? "#B894FF" : "#8E82AD"}
          strokeWidth={2}
        />
        <Path
          d="M4.5 20a7.5 7.5 0 0 1 15 0"
          stroke={active ? "#B894FF" : "#8E82AD"}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    ),
  },
];

const SANCTUARY_THEMES: {
  key: SanctuaryThemeKey;
  label: string;
  description: string;
  feeling: string;
  colors: [string, string];
  panel: [string, string, string];
  accent: string;
  accent2: string;
  artwork: ImageSourcePropType;
  ambient: string[];
  palette: string[];
  unlockDays: number;
  free: boolean;
  unlockType?: "reflections" | "plus" | "seasonal";
}[] = [
  {
    key: "blossom",
    label: "Blossom Garden",
    description: "A peaceful lotus pond where every reflection helps your sanctuary bloom.",
    feeling: "Peace, reflection, new beginnings",
    colors: ["#E7A6D8", "#BDA9FF"],
    panel: ["#171126", "#251934", "#100B1B"],
    accent: "#E7A6D8",
    accent2: "#BDA9FF",
    artwork: require("./assets/images/sanctuary/lotus_blossom.png"),
    ambient: ["Floating petals", "Gentle ripples", "Fireflies", "Soft glow"],
    palette: ["Lavender", "Violet", "Sage", "Rose", "Mist"],
    unlockDays: 0,
    free: true,
    unlockType: "reflections",
  },
  {
    key: "twilight",
    label: "Twilight Grove",
    description: "A quiet grove beneath the evening sky where moonlight, stars, and peaceful paths help you leave the day behind.",
    feeling: "Evening, rest, stillness",
    colors: ["#B894FF", "#D8C4FF"],
    panel: ["#111024", "#2B214B", "#0F0E1C"],
    accent: "#B894FF",
    accent2: "#D8C4FF",
    artwork: require("./assets/images/sanctuary/twilight_grove.png"),
    ambient: ["Twinkling stars", "Slow clouds", "Moon glow", "Fireflies"],
    palette: ["Midnight", "Indigo", "Silver", "Lavender", "Pine"],
    unlockDays: 0,
    free: true,
    unlockType: "reflections",
  },
  {
    key: "ocean",
    label: "Ocean Shore",
    description: "Gentle waves and endless horizons create space to breathe deeply, reset your thoughts, and let the tide carry away today's worries.",
    feeling: "Breathe, release, clarity",
    colors: ["#87B8C9", "#F2A58C"],
    panel: ["#071420", "#315466", "#06101A"],
    accent: "#87B8C9",
    accent2: "#F2A58C",
    artwork: require("./assets/images/sanctuary/ocean_calm.png"),
    ambient: ["Moving waves", "Ocean mist", "Flying birds", "Water shimmer"],
    palette: ["Ocean", "Teal", "Seafoam", "Coral", "Mist"],
    unlockDays: 14,
    free: false,
    unlockType: "reflections",
  },
  {
    key: "forest",
    label: "Forest Haven",
    description: "A peaceful woodland retreat filled with flowing streams, towering trees, and quiet trails that help you reconnect with yourself.",
    feeling: "Grounded, nature, comfort",
    colors: ["#A9B99B", "#D4C7A1"],
    panel: ["#0C1511", "#3F5548", "#090F0C"],
    accent: "#A9B99B",
    accent2: "#D4C7A1",
    artwork: require("./assets/images/sanctuary/forest_haven.png"),
    ambient: ["Birds", "Flowing stream", "Floating pollen", "Gentle breeze"],
    palette: ["Forest", "Moss", "Bark", "Lavender", "Sunlight"],
    unlockDays: 7,
    free: false,
    unlockType: "reflections",
  },
  {
    key: "sunrise",
    label: "Sunrise Meadow",
    description: "Golden fields beneath a colorful sunset remind you that every ending is also the beginning of something new.",
    feeling: "Gratitude, hope, closure",
    colors: ["#E5A65C", "#D989B2"],
    panel: ["#1B1326", "#5B4563", "#120D1B"],
    accent: "#E5A65C",
    accent2: "#D989B2",
    artwork: require("./assets/images/sanctuary/sunset_fields.png"),
    ambient: ["Swaying grass", "Birds", "Warm sunlight", "Floating seeds"],
    palette: ["Amber", "Peach", "Orange", "Pink", "Lavender"],
    unlockDays: 21,
    free: false,
    unlockType: "reflections",
  },
  {
    key: "mountain",
    label: "Mountain Retreat",
    description: "High above the clouds, each reflection reminds you how far you've climbed and how much you've grown.",
    feeling: "Strength, perspective, achievement",
    colors: ["#A9BFE8", "#D3B0FF"],
    panel: ["#111627", "#1B2238", "#0B1020"],
    accent: "#A9BFE8",
    accent2: "#D3B0FF",
    artwork: require("./assets/images/sanctuary/mountain_peak.png"),
    ambient: ["Clouds", "Mountain breeze", "Snow particles", "Distant birds"],
    palette: ["Slate", "Snow", "Granite", "Frost", "Lavender"],
    unlockDays: 42,
    free: false,
    unlockType: "reflections",
  },
  {
    key: "misty",
    label: "Misty Hollow",
    description: "Soft morning mist rolls across blooming meadows where quiet paths encourage curiosity and peaceful reflection.",
    feeling: "Fresh start, possibility, gentleness",
    colors: ["#B2C8B3", "#B8A7DF"],
    panel: ["#111827", "#1C2433", "#0B111C"],
    accent: "#B2C8B3",
    accent2: "#B8A7DF",
    artwork: require("./assets/images/sanctuary/misty_meadows.png"),
    ambient: ["Morning fog", "Wildflowers", "Floating pollen", "Butterflies"],
    palette: ["Mist", "Sage", "Blue", "Lavender", "Green"],
    unlockDays: 28,
    free: false,
    unlockType: "reflections",
  },
  {
    key: "desert",
    label: "Desert Oasis",
    description: "Wide open skies and quiet desert landscapes invite you to slow down, breathe deeply, and appreciate life's quiet moments.",
    feeling: "Stillness, simplicity, resilience",
    colors: ["#D17A52", "#B583C7"],
    panel: ["#1E141E", "#2C1E2A", "#120C13"],
    accent: "#D17A52",
    accent2: "#B583C7",
    artwork: require("./assets/images/sanctuary/desert_dusk.png"),
    ambient: ["Wind", "Sand drifting", "Warm glow", "Desert plants"],
    palette: ["Terracotta", "Sand", "Purple", "Orange", "Brown"],
    unlockDays: 35,
    free: false,
    unlockType: "reflections",
  },
  {
    key: "snowfall",
    label: "Winter Retreat",
    description: "Fresh snow blankets a peaceful winter retreat where the world slows down and every reflection feels warm and comforting.",
    feeling: "Quiet, comfort, peace",
    colors: ["#B7D7F0", "#D6C7FF"],
    panel: ["#11182A", "#1B2438", "#0A1020"],
    accent: "#B7D7F0",
    accent2: "#D6C7FF",
    artwork: require("./assets/images/sanctuary/snowfall_retreat.png"),
    ambient: ["Falling snow", "Gentle wind", "Frost sparkle", "Cabin smoke"],
    palette: ["Snow", "Ice", "Lavender", "Evergreen", "Silver"],
    unlockDays: 0,
    free: false,
    unlockType: "seasonal",
  },
  {
    key: "northern",
    label: "Aurora Valley",
    description: "Watch colorful auroras dance across the night sky while reflecting on life's beauty and endless possibilities.",
    feeling: "Wonder, awe, inspiration",
    colors: ["#6EE7B7", "#B879FF"],
    panel: ["#061329", "#0E2136", "#050C1A"],
    accent: "#6EE7B7",
    accent2: "#B879FF",
    artwork: require("./assets/images/sanctuary/northern_lights.png"),
    ambient: ["Aurora animation", "Stars", "Water reflections", "Light shimmer"],
    palette: ["Aurora", "Emerald", "Violet", "Midnight", "Indigo"],
    unlockDays: 49,
    free: false,
    unlockType: "reflections",
  },
  {
    key: "cloud",
    label: "Cloud Sanctuary",
    description: "A soft sanctuary above the clouds where reflection feels spacious, gentle, and open.",
    feeling: "Lightness, imagination, perspective",
    colors: ["#D7B8FF", "#F1B88B"],
    panel: ["#1B162B", "#28213A", "#120F1E"],
    accent: "#D7B8FF",
    accent2: "#F1B88B",
    artwork: require("./assets/images/sanctuary/cloud_sanctuary.png"),
    ambient: ["Slow clouds", "Soft light", "Drifting mist", "Warm horizon"],
    palette: ["Cloud", "Lavender", "Peach", "Violet", "Gold"],
    unlockDays: 0,
    free: true,
    unlockType: "reflections",
  },
];

type AppThemePalette = {
  bg: string;
  card: string;
  ink: string;
  edge: string;
  fg: string;
  dim: string;
  faint: string;
  accent: string;
  accent2: string;
  button: string;
  disabled: string;
  helperBg: string;
  helperEdge: string;
  weeklyBg: string;
};

const APP_THEME_PALETTES: Partial<Record<SanctuaryThemeKey, AppThemePalette>> & {
  twilight: AppThemePalette;
} = {
  twilight: {
    bg: "#111024",
    card: "#1C1830",
    ink: "#0F0E1C",
    edge: "#4A3E68",
    fg: "#F8F5FF",
    dim: "#C8BCE6",
    faint: "#8E82AD",
    accent: "#B894FF",
    accent2: "#D8C4FF",
    button: "#5B3BB7",
    disabled: "#2A2440",
    helperBg: "rgba(184,148,255,0.12)",
    helperEdge: "rgba(216,196,255,0.24)",
    weeklyBg: "#1A1434",
  },
  sunrise: {
    bg: "#1B1326",
    card: "#281B32",
    ink: "#120D1B",
    edge: "#5B4563",
    fg: "#FFF7F4",
    dim: "#DFC7D1",
    faint: "#A58A9A",
    accent: "#D99A8B",
    accent2: "#C7A5D9",
    button: "#7A4E68",
    disabled: "#33243D",
    helperBg: "rgba(217,154,139,0.12)",
    helperEdge: "rgba(199,165,217,0.24)",
    weeklyBg: "#24152F",
  },
  ocean: {
    bg: "#071420",
    card: "#0E2230",
    ink: "#06101A",
    edge: "#315466",
    fg: "#F1FAFF",
    dim: "#B7D4DE",
    faint: "#7895A3",
    accent: "#87B8C9",
    accent2: "#B8D7E5",
    button: "#2D5D72",
    disabled: "#142A36",
    helperBg: "rgba(135,184,201,0.12)",
    helperEdge: "rgba(184,215,229,0.24)",
    weeklyBg: "#0A1A2B",
  },
  forest: {
    bg: "#0C1511",
    card: "#17241D",
    ink: "#090F0C",
    edge: "#3F5548",
    fg: "#F5FBF4",
    dim: "#C8D6C7",
    faint: "#8D9E8E",
    accent: "#A9B99B",
    accent2: "#D4C7A1",
    button: "#536B58",
    disabled: "#202B23",
    helperBg: "rgba(169,185,155,0.12)",
    helperEdge: "rgba(212,199,161,0.24)",
    weeklyBg: "#111D17",
  },
  blossom: {
    bg: "#1B1321",
    card: "#2A1A30",
    ink: "#120E18",
    edge: "#65405E",
    fg: "#FFF5FC",
    dim: "#E5C5DC",
    faint: "#A9859D",
    accent: "#F19ACD",
    accent2: "#D7B8FF",
    button: "#9B5B89",
    disabled: "#352139",
    helperBg: "rgba(241,154,205,0.12)",
    helperEdge: "rgba(215,184,255,0.24)",
    weeklyBg: "#251330",
  },
  mountain: {
    bg: "#090D1B",
    card: "#151B2E",
    ink: "#070A14",
    edge: "#36425F",
    fg: "#F6F7FF",
    dim: "#C8D1E8",
    faint: "#8792AE",
    accent: "#A9BFE8",
    accent2: "#D3B0FF",
    button: "#52678E",
    disabled: "#1B2236",
    helperBg: "rgba(169,191,232,0.12)",
    helperEdge: "rgba(211,176,255,0.24)",
    weeklyBg: "#10162A",
  },
  misty: {
    bg: "#0D1318",
    card: "#182129",
    ink: "#080D11",
    edge: "#42515A",
    fg: "#F5FAF8",
    dim: "#C7D4D0",
    faint: "#869791",
    accent: "#B2C8B3",
    accent2: "#B8A7DF",
    button: "#596E68",
    disabled: "#202B2D",
    helperBg: "rgba(178,200,179,0.12)",
    helperEdge: "rgba(184,167,223,0.24)",
    weeklyBg: "#111A20",
  },
  desert: {
    bg: "#160E13",
    card: "#26171E",
    ink: "#0E090C",
    edge: "#604037",
    fg: "#FFF8F3",
    dim: "#DFC9BE",
    faint: "#A37F75",
    accent: "#D17A52",
    accent2: "#B583C7",
    button: "#81513E",
    disabled: "#302026",
    helperBg: "rgba(209,122,82,0.12)",
    helperEdge: "rgba(181,131,199,0.24)",
    weeklyBg: "#21131B",
  },
  snowfall: {
    bg: "#0A1020",
    card: "#141D31",
    ink: "#070C18",
    edge: "#394A68",
    fg: "#F7FAFF",
    dim: "#CBD9E7",
    faint: "#8395AA",
    accent: "#B7D7F0",
    accent2: "#D6C7FF",
    button: "#58738D",
    disabled: "#1D293A",
    helperBg: "rgba(183,215,240,0.12)",
    helperEdge: "rgba(214,199,255,0.24)",
    weeklyBg: "#10192D",
  },
  northern: {
    bg: "#040B18",
    card: "#09172A",
    ink: "#020711",
    edge: "#244861",
    fg: "#F3FFFC",
    dim: "#B8DDD4",
    faint: "#6E9C99",
    accent: "#6EE7B7",
    accent2: "#B879FF",
    button: "#286D68",
    disabled: "#102A35",
    helperBg: "rgba(110,231,183,0.12)",
    helperEdge: "rgba(184,121,255,0.24)",
    weeklyBg: "#07152A",
  },
  cloud: {
    bg: "#151020",
    card: "#251C33",
    ink: "#0D0A14",
    edge: "#59466F",
    fg: "#FFF8FF",
    dim: "#DDCDE8",
    faint: "#9F89AF",
    accent: "#D7B8FF",
    accent2: "#F1B88B",
    button: "#765991",
    disabled: "#30243E",
    helperBg: "rgba(215,184,255,0.12)",
    helperEdge: "rgba(241,184,139,0.24)",
    weeklyBg: "#1E162D",
  },
};

const STORE_KEY = "tranqly-mobile-v1";
const FREE_AI_INSIGHTS_PER_DAY = 5;
const TRANQLY_LOGO = require("./assets/images/tranqly_logo.png");
const configuredRevenueCatKey =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || "";
const REVENUECAT_IOS_API_KEY = configuredRevenueCatKey.startsWith("appl_")
  ? configuredRevenueCatKey
  : "";
const REVENUECAT_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || "plus";
const REVENUECAT_CONFIG_ERROR = !configuredRevenueCatKey
  ? "App Store billing is not configured in this build."
  : !configuredRevenueCatKey.startsWith("appl_")
    ? "App Store billing needs the RevenueCat public iOS SDK key."
    : "";

function getValidatedStorePackages(offering: PurchasesOffering): {
  monthlyPackage: PurchasesPackage;
  yearlyPackage: PurchasesPackage;
} {
  const monthlyPackage = offering.monthly ?? offering.availablePackages.find((item) => item.packageType === "MONTHLY");
  const yearlyPackage = offering.annual ?? offering.availablePackages.find((item) => item.packageType === "ANNUAL");

  if (!monthlyPackage || !yearlyPackage) {
    throw new Error("RevenueCat current offering must include monthly and annual packages.");
  }
  if (monthlyPackage.product.identifier === yearlyPackage.product.identifier) {
    throw new Error("RevenueCat monthly and annual packages must use different App Store products.");
  }
  if (monthlyPackage.product.subscriptionPeriod && monthlyPackage.product.subscriptionPeriod !== "P1M") {
    throw new Error("RevenueCat monthly package is not attached to a monthly App Store product.");
  }
  if (yearlyPackage.product.subscriptionPeriod && yearlyPackage.product.subscriptionPeriod !== "P1Y") {
    throw new Error("RevenueCat annual package is not attached to a yearly App Store product.");
  }
  if (yearlyPackage.product.price <= monthlyPackage.product.price) {
    throw new Error("RevenueCat annual package returned an invalid full-year price.");
  }

  return { monthlyPackage, yearlyPackage };
}
const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  "";
const FIREBASE_API_KEY =
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
  (Constants.expoConfig?.extra?.firebaseApiKey as string | undefined) ||
  "";
const FIREBASE_PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  (Constants.expoConfig?.extra?.firebaseProjectId as string | undefined) ||
  "";
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ||
  (Constants.expoConfig?.extra?.googleIosClientId as string | undefined)?.trim() ||
  "";
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
  (Constants.expoConfig?.extra?.googleWebClientId as string | undefined)?.trim() ||
  "";
const googleClientProject = (clientId: string) => clientId.match(/^(\d+)-/)?.[1] ?? "";
const GOOGLE_CLIENT_PROJECT_MISMATCH = Boolean(
  GOOGLE_IOS_CLIENT_ID &&
    GOOGLE_WEB_CLIENT_ID &&
    googleClientProject(GOOGLE_IOS_CLIENT_ID) !== googleClientProject(GOOGLE_WEB_CLIENT_ID)
);
const devHostUri =
  (Constants.expoConfig as { hostUri?: string } | undefined)?.hostUri ||
  (Constants.manifest2?.extra?.expoGo as { debuggerHost?: string } | undefined)
    ?.debuggerHost ||
  "";
const devHost = devHostUri.split(":")[0];
const API_BASE_URL =
  configuredApiBaseUrl ||
  (__DEV__ && devHost ? `http://${devHost}:3457` : "");

if (__DEV__) {
  console.info("Tranqly mobile API base URL:", API_BASE_URL || "(not configured)");
  console.info("Tranqly auth configuration:", {
    firebase: Boolean(FIREBASE_API_KEY && FIREBASE_PROJECT_ID),
    googleIos: Boolean(GOOGLE_IOS_CLIENT_ID),
    googleWeb: Boolean(GOOGLE_WEB_CLIENT_ID),
    googleProjectMatch: !GOOGLE_CLIENT_PROJECT_MISMATCH,
  });
}

function logMobileApiError(input: {
  requestId?: string;
  errorCode: string;
  errorMessage: string;
  featureArea: string;
  statusCode?: number;
  durationMs?: number;
  route?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!API_BASE_URL) return;
  fetch(`${API_BASE_URL}/api/client-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      platform: "mobile",
      severity: "error",
    }),
  }).catch((err) => {
    if (__DEV__) console.warn("Failed to send mobile error log", err);
  });
}

const DAILY_PROMPTS = [
  "What made you smile today?",
  "What challenged you today?",
  "What are you grateful for today?",
  "What's one thing you're proud of?",
  "What surprised you today?",
  "What gave you energy today?",
  "What felt heavy today?",
  "What do you want to remember from today?",
  "What are you looking forward to tomorrow?",
  "What's one small win from today?",
  "What did you learn today?",
  "What helped you feel calm today?",
  "What would you like to let go of today?",
  "What was your favorite moment today?",
  "What else is on your mind?",
  "What felt different today?",
  "What did you need more of today?",
  "What did you handle better than before?",
  "What felt easier than expected?",
  "What took more energy than you thought?",
  "What helped you keep going today?",
  "What do you want to carry into tomorrow?",
  "What do you want to leave behind tonight?",
  "Where did you feel most like yourself today?",
  "What would make tomorrow feel a little lighter?",
];

const MOBILE_TOPIC_GROUPS = [
  { key: "work", keywords: ["work", "job", "meeting", "client", "project", "boss", "deadline", "office"] },
  { key: "sleep", keywords: ["sleep", "slept", "rest", "tired", "drained", "exhausted", "energy"] },
  { key: "stress", keywords: ["stress", "stressed", "pressure", "overwhelmed", "anxious", "hard", "heavy"] },
  { key: "gratitude", keywords: ["grateful", "gratitude", "thankful", "appreciate"] },
  { key: "family", keywords: ["family", "mom", "dad", "partner", "friend", "friends", "kids", "wife", "husband"] },
  { key: "calm", keywords: ["calm", "quiet", "peace", "settled", "present", "breathe", "slow"] },
  { key: "outside", keywords: ["walk", "outside", "fresh air", "run", "gym", "workout", "hike"] },
] as const;

const MOBILE_SANCTUARY_PROMPTS: Record<string, readonly string[]> = {
  blossom: ["What helped you grow today, even quietly?", "What part of today deserves a little peace?"],
  twilight: ["As the day settles, what would you like to leave behind?", "What felt softer by the end of today?"],
  ocean: ["What helped you feel steady today?", "What came in waves today, and what passed?"],
  forest: ["What helped you feel grounded today?", "Where did you find a little shelter today?"],
  sunrise: ["What felt possible today?", "What would you like to begin again tomorrow?"],
  misty: ["What became a little clearer today?", "What needed patience today?"],
  mountain: ["What felt worth the effort today?", "What helped you stay steady when the day got steep?"],
  desert: ["What helped you protect your energy today?", "What felt essential today, and what did not?"],
  snowfall: ["What deserves gentleness today?", "What felt quiet, still, or simple?"],
  cloud: ["What helped you rise above the noise today?", "What feels clearer from a little distance?"],
  northern: ["What surprised you with a little light today?", "What quiet spark stayed with you today?"],
};

function mobilePromptSeed(offset = 0) {
  return Math.floor(Date.now() / 86_400_000) + offset;
}

function mobileRotate<T>(items: readonly T[], seed: number) {
  return items[Math.abs(seed) % items.length];
}

function reflectionTimeSummary(entries: CheckIn[]) {
  const counts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const entry of entries.slice(0, 20)) {
    const hour = new Date(entry.createdAt).getHours();
    if (hour < 5) counts.night += 1;
    else if (hour < 12) counts.morning += 1;
    else if (hour < 18) counts.afternoon += 1;
    else counts.evening += 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "evening";
}

function topThemeSummary(entries: CheckIn[]) {
  const recent = entries.slice(0, 20).map((entry) => entry.text.toLowerCase());
  const strongest = MOBILE_TOPIC_GROUPS.map((group) => ({
    key: group.key,
    count: recent.filter((text) => group.keywords.some((keyword) => text.includes(keyword))).length,
  })).sort((a, b) => b.count - a.count)[0];
  if (!strongest || strongest.count === 0) return "Patterns are still forming.";
  return `${strongest.key.charAt(0).toUpperCase() + strongest.key.slice(1)} has appeared a few times.`;
}

function topStruggleSummary(entries: CheckIn[]) {
  const recent = entries.slice(0, 20).map((entry) => entry.text.toLowerCase());
  const sleepCount = recent.filter((text) => ["sleep", "tired", "drained", "energy"].some((keyword) => text.includes(keyword))).length;
  const stressCount = recent.filter((text) => ["stress", "pressure", "overwhelmed", "hard"].some((keyword) => text.includes(keyword))).length;
  const workCount = recent.filter((text) => ["work", "job", "meeting", "deadline"].some((keyword) => text.includes(keyword))).length;
  if (sleepCount >= 2) return "Sleep and energy are forming a pattern.";
  if (stressCount >= 2) return "Stress has been building in your recent check-ins.";
  if (workCount >= 2) return "Work has taken a lot of space lately.";
  return "Tranqly is still learning what weighs on you.";
}

const VOICE_LIMIT_SECONDS = 60;
const TRANSCRIBE_TIMEOUT_MS = 25000;
const COACH_TIMEOUT_MS = 30000;

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentStreak(entries: CheckIn[]) {
  const days = new Set(entries.map((entry) => entry.dateKey));
  if (!days.size) return 0;

  const cursor = new Date();
  if (!days.has(todayKey())) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (true) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;
    if (days.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function bestStreak(entries: CheckIn[]) {
  const days = Array.from(new Set(entries.map((e) => e.dateKey))).sort();
  if (!days.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

function growthEmoji(streak: number) {
  if (streak >= 21) return "Sprout";
  if (streak >= 7) return "Leaf";
  if (streak >= 3) return "Bloom";
  return "Sprout";
}

function localDeepInsight(text: string): DeepInsight {
  return {
    headline: "A few moments from your week",
    insight: text.trim()
      ? "One moment stood out from what you shared. It may not show a full pattern yet, but it gives a clear glimpse into what was asking for your attention."
      : "You did not share a reflection this week, so there is not a personal pattern to bring together yet. Your space is still here whenever you feel ready to return.",
    suggestion: "Notice one moment this week where you feel a little more settled, supported, or clear.",
    affirmation: "There is no perfect way to reflect. You can return whenever it feels useful.",
    createdAt: new Date().toISOString(),
    gentleFocusTitle: "Next gentle focus",
    evidenceLevel: text.trim() ? "limited" : "limited",
    completionMessage: text.trim() ? "One honest moment can still give you something meaningful to return to." : "Your space is still here whenever you feel ready.",
    reflectionDays: text.trim() ? 1 : 0,
    reflectionCount: text.trim() ? 1 : 0,
    rewardUnlocked: false,
    rewardId: "none",
  };
}

function isDemoCheckIn(entry: CheckIn) {
  const id = entry.id.toLowerCase();
  return id.startsWith("tranqly-demo-") || id.startsWith("tranqly-first-week-demo-") || id.startsWith("demo-sanctuary-");
}

function localCoachReply(text: string): CoachReply {
  const lower = text.toLowerCase();
  const financialUncertainty = /unemploy|money|check|payment|income|financial|rent|bills/.test(lower);
  const scheduleAdjustment = /night shift|night schedule|schedule|shift|adjusting/.test(lower);
  const betterSleep = /got some sleep|slept better|slept well|good sleep|rested|didn't need to sleep in|did not need to sleep in/.test(lower);
  const noSleep = /did not sleep|didn't sleep|no sleep|couldn't sleep|could not sleep|slept bad|insomnia/.test(lower);
  const tired = /tired|exhausted|drained|fatigue|worn out/.test(lower);
  const stress = /stress|anxious|overwhelmed|pressure|busy/.test(lower);
  const interview = /interview|job interview|application|new job|hiring|resume/.test(lower);

  if (financialUncertainty && scheduleAdjustment) {
    return {
      message:
        "Receiving the payment did not make everything secure, but it changed the shape of the uncertainty. You had been carrying both the wait for help and changes at home. Now one of those weights has started to lift, and your mind may finally have a little more room than it did before.",
      title: "One Weight Started to Lift",
      pattern: "Financial pressure and changes at home may be shaping how settled each day feels.",
      summary: "One weight starting to lift created more room, even though life is still adjusting.",
      themes: ["finances", "adjustment", "relationship"],
      tags: ["work", "relationships"],
      emotionalTone: "relieved and uncertain",
      followUpQuestions: ["What feels a little lighter now that the payment arrived?"],
      nextStep: "You do not have to make everything feel solved before you let yourself notice the relief. One thing becoming easier is still progress while the rest catches up.",
      nudgeLabel: "A Little Reassurance",
      source: "local",
      createdAt: new Date().toISOString(),
    };
  }

  if (financialUncertainty) {
    return {
      message:
        "A little money coming in may create breathing room without making the uncertainty disappear. What stands out is that you noticed the relief honestly, without pretending it solved more than it did.",
      title: "Relief Without Certainty",
      pattern: "Financial uncertainty may be affecting how much room the rest of the day feels like it has.",
      summary: "The relief is real, even though the uncertainty is not over.",
      themes: ["finances", "relief"],
      tags: ["work"],
      emotionalTone: "relieved and uncertain",
      followUpQuestions: ["What pressure feels slightly lighter today?"],
      nextStep: "It is okay to let this help feel meaningful without asking it to solve everything at once.",
      nudgeLabel: "A Little Reassurance",
      source: "local",
      createdAt: new Date().toISOString(),
    };
  }

  if (scheduleAdjustment) {
    return {
      message:
        "A new schedule can make familiar parts of home feel less settled for a while. What stands out is that you are already trying to find a shared rhythm instead of expecting the change to feel natural immediately.",
      title: "Finding a New Rhythm",
      pattern: "Changes in routine may affect how connected and settled the day feels.",
      summary: "You are adjusting together, even if the new rhythm is not comfortable yet.",
      themes: ["adjustment", "relationship"],
      tags: ["relationships"],
      emotionalTone: "unsettled and adapting",
      followUpQuestions: ["What part of the new rhythm has been hardest to settle into?"],
      nextStep: "This may simply need time. You are already doing the work of adjusting together.",
      nudgeLabel: "A Little Reassurance",
      source: "local",
      createdAt: new Date().toISOString(),
    };
  }

  if (betterSleep) {
    return {
      message:
        "Getting real sleep changed the tone of today. You noticed that the morning felt easier instead of brushing past the difference, which gives you something useful to remember.",
      title: "Rest gave today more room",
      pattern: "Sleep may be tied closely to your morning energy and how much space the day feels like it has.",
      summary: "Better sleep made today feel easier to enter.",
      themes: ["sleep", "energy"],
      tags: ["sleep"],
      emotionalTone: "rested and aware",
      followUpQuestions: ["What felt different after getting more rest?"],
      nextStep: "Notice what helped you sleep better last night. That detail may be worth repeating.",
      source: "local",
      createdAt: new Date().toISOString(),
    };
  }

  if (noSleep) {
    return {
      message:
        "A disrupted night can change the whole shape of a day. You still made space to notice how it affected you instead of simply pushing through, and that awareness is useful.",
      title: "You noticed instead of pushing through",
      pattern: "Sleep may be one of the first places your energy pattern shows up.",
      summary: "Sleep was difficult, and you still checked in.",
      themes: ["sleep", "energy"],
      tags: ["rest"],
      emotionalTone: "tired but reflective",
      followUpQuestions: ["What helped you get through the day?"],
      nextStep: "If tonight allows, keep one part of your wind-down familiar while the rest of the routine settles.",
      source: "local",
      createdAt: new Date().toISOString(),
    };
  }

  if (tired) {
    return {
      message:
        "This sounds like a low-energy day, not a verdict on you. You noticed your limits, and that matters because patterns usually start showing up through tired days first.",
      title: "You made room for a tired day",
      pattern: "Low-energy days may be worth tracking alongside what helped you recover.",
      summary: "Energy felt low today.",
      themes: ["energy", "recovery"],
      tags: ["tired"],
      emotionalTone: "drained but aware",
      followUpQuestions: ["What gave you even a small lift today?"],
      nextStep: "Choose one thing to make tomorrow easier before you sleep. Keep it small enough that it feels almost too easy.",
      source: "local",
      createdAt: new Date().toISOString(),
    };
  }

  if (stress) {
    return {
      message:
        "There is pressure in what you shared, but also a useful signal. Tranqly is starting to learn what tends to take up space for you, and naming it is the first step toward changing your relationship with it.",
      title: "You named what took up space",
      pattern: "Stress may be connected to the parts of the day that feel least spacious.",
      summary: "Stress showed up in today's reflection.",
      themes: ["stress", "pressure"],
      tags: ["stress"],
      emotionalTone: "stressed and reflective",
      followUpQuestions: ["Where did the pressure feel strongest today?"],
      nextStep: "Write down the one pressure you can influence tomorrow, and let the rest stay outside tonight.",
      source: "local",
      createdAt: new Date().toISOString(),
    };
  }

  if (interview) {
    return {
      message:
        "A job interview is not just an event on the calendar. It is a moment where you put yourself forward, tolerate uncertainty, and take a step toward a possible change.",
      title: "You moved toward something new",
      pattern: "Opportunity and nerves may show up together when you are moving toward something new.",
      summary: "You took a step toward a new opportunity.",
      themes: ["work", "growth"],
      tags: ["work"],
      emotionalTone: "hopeful and uncertain",
      followUpQuestions: ["What part of the interview stayed with you most?"],
      nextStep: "Before replaying the whole thing, name one thing you handled well.",
      source: "local",
      createdAt: new Date().toISOString(),
    };
  }

  return {
    message:
      `You named something specific from today: "${text.slice(0, 120)}${text.length > 120 ? "..." : ""}" That gives Tranqly a real signal to learn from, especially as details like this repeat over time.`,
    title: "One detail was worth noticing",
    pattern: "Specific details are where your longer-term patterns will start to become visible.",
    summary: text.slice(0, 140),
    themes: ["reflection"],
    tags: ["daily check-in"],
    emotionalTone: "reflective",
    followUpQuestions: ["What part of today do you want to understand better?"],
    nextStep: "If it helps, add one sentence about what this changed for you. That is often where the useful detail appears.",
    source: "local",
    createdAt: new Date().toISOString(),
  };
}

function inspirationFor(text: string) {
  const lower = text.toLowerCase();
  if (text.trim().length < 8) {
    return "Start with one true sentence.";
  }
  if (/(tired|hard|rough|stress|bad|drained)/.test(lower)) {
    return "A hard day can still teach you what needs care.";
  }
  if (/(walk|run|gym|outside|workout)/.test(lower)) {
    return "You moved your body. That is practical self-respect.";
  }
  if (/(work|meeting|client|project|job)/.test(lower)) {
    return "You showed up inside real pressure. That counts.";
  }
  return "There is something here you cared enough to name.";
}

function selectMobilePrompt(
  entries: CheckIn[],
  sanctuaryTheme: SanctuaryThemeKey,
  mood?: string | null,
  offset = 0
) {
  const latest = entries[0]?.text.toLowerCase() ?? "";
  const yesterday = entries[1]?.text.toLowerCase() ?? "";
  const recent = entries.slice(0, 20).map((entry) => entry.text.toLowerCase());
  const recentPromptTypes = entries.slice(0, 7).map((entry) => entry.promptType).filter(Boolean) as string[];
  const seed = mobilePromptSeed(offset) + entries.length;
  const matchCount = (keywords: string[]) =>
    recent.filter((text) => keywords.some((keyword) => text.includes(keyword))).length;
  const usedRecently = (prompt: string) =>
    entries.some(
      (entry) => entry.prompt === prompt && new Date(entry.createdAt).getTime() >= Date.now() - 30 * 86_400_000
    );
  const candidates: { prompt: string; whyThisQuestion: string; promptType: string; priority: number }[] = [];

  if (/(panic|hopeless|breaking|numb)/.test(latest) || mood === "rough") {
    candidates.push({
      prompt: mobileRotate(
        [
          "What deserves a little kindness right now?",
          "What would make tonight feel a little lighter?",
          "What's one small thing you can let be enough today?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking gently because today sounds heavier than usual.",
      promptType: "gentle_reset",
      priority: 1,
    });
  }

  const topicCounts = MOBILE_TOPIC_GROUPS.map((group) => ({
    key: group.key,
    count: matchCount([...group.keywords]),
  })).sort((a, b) => b.count - a.count);
  const topTopic = topicCounts[0];

  if (topTopic?.key === "sleep" && topTopic.count > 0) {
    candidates.push({
      prompt: mobileRotate(
        [
          "Rest has been showing up a lot lately. What did your body seem to need today?",
          "Sleep and energy have been linked in your reflections. What gave you energy today, even a little?",
          "What did your energy seem to be asking for today?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because rest and energy have been showing up together.",
      promptType: "energy_prompt",
      priority: 2,
    });
  }

  if (topTopic?.key === "work" && topTopic.count > 0) {
    candidates.push({
      prompt: mobileRotate(
        [
          "Work has been taking a lot of space lately. Did today feel lighter, heavier, or just different?",
          "Work has been close to the surface lately. What part of today stayed with you most?",
          "What changed for you today around work, pressure, or pace?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because work has taken a lot of space in your reflections.",
      promptType: "recurring_pattern",
      priority: 3,
    });
  }

  if (topTopic?.key === "stress" && topTopic.count > 0) {
    candidates.push({
      prompt: mobileRotate(
        [
          "You've been carrying a lot lately. What helped you get through today?",
          "Pressure has been building in your recent reflections. What helped you feel a little steadier today?",
          "What took the most out of you today, and what gave a little back?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because your recent check-ins have felt heavier.",
      promptType: "recurring_pattern",
      priority: 3,
    });
  }

  if (topicCounts.some((item) => item.key === "outside" && item.count >= 2)) {
    candidates.push({
      prompt: mobileRotate(
        [
          "Did you get a chance to do something that usually clears your head?",
          "What helped you feel a little more steady today?",
          "Did anything support you more than you expected today?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because getting outside seems to help.",
      promptType: "helpful_action",
      priority: 4,
    });
  }

  if (topicCounts.some((item) => item.key === "gratitude" && item.count > 0)) {
    candidates.push({
      prompt: mobileRotate(
        [
          "What felt worth caring about today?",
          "What mattered most to you today?",
          "Where did you feel most like yourself today?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because what matters to you is becoming clearer.",
      promptType: "values_prompt",
      priority: 5,
    });
  }

  if (entries.length >= 2 && latest && yesterday && latest !== yesterday) {
    candidates.push({
      prompt: mobileRotate(
        [
          "Did today feel lighter or heavier than yesterday?",
          "What felt different about today?",
          "What surprised you about your mood or energy today?",
        ],
        seed
      ),
      whyThisQuestion: "I'm asking because your recent days have not all felt the same.",
      promptType: "contrast_prompt",
      priority: 6,
    });
  }

  candidates.push({
    prompt: mobileRotate(MOBILE_SANCTUARY_PROMPTS[sanctuaryTheme] ?? MOBILE_SANCTUARY_PROMPTS.twilight, seed),
    whyThisQuestion: "I'm asking because this sanctuary is about slowing down and noticing what's growing.",
    promptType: "sanctuary_prompt",
    priority: 7,
  });

  candidates.push({
    prompt: DAILY_PROMPTS[(mobilePromptSeed(offset) + offset) % DAILY_PROMPTS.length],
    whyThisQuestion: "I'm asking to help you notice one honest part of today.",
    promptType: "generic_fallback",
    priority: 8,
  });

  const selected =
    candidates
      .sort((a, b) => a.priority - b.priority)
      .find((candidate) => !recentPromptTypes.includes(candidate.promptType) && !usedRecently(candidate.prompt)) ??
    candidates[candidates.length - 1];

  return selected;
}

function safeLocalCoachReply(text: string): CoachReply {
  const reply = localCoachReply(text);
  return {
    ...reply,
    title: reply.title?.slice(0, 55) || "One detail was worth noticing",
    preview: (reply.summary === reply.title ? reply.message : reply.summary || reply.message).slice(0, 125),
    nudgeLabel: reply.nudgeLabel ?? "Something to Notice",
    pattern: undefined,
  };
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 5) return "Still up? Be gentle with yourself";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type MonthIconType = "calm" | "consistency" | "gratitude" | "stress";

const monthIconColors: Record<MonthIconType, string> = {
  calm: "#A6A6FF",
  consistency: "#76E0D3",
  gratitude: "#F5BD6D",
  stress: "#FF7272",
};

function MonthIcon({
  type,
  size = 68,
}: {
  type: MonthIconType;
  size?: number;
}) {
  const color = monthIconColors[type];

  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Circle cx={48} cy={48} r={38} stroke={color} strokeWidth={3} opacity={0.92} />
      {type === "calm" && (
        <>
          <Path
            d="M48 61c-9-11-9-24 0-34 9 10 9 23 0 34Z"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M47 61c-13-1-22-8-27-20 13 1 22 8 27 20ZM49 61c13-1 22-8 27-20-13 1-22 8-27 20Z"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M28 70c9-4 31-4 40 0M34 76c8-2 20-2 28 0"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        </>
      )}
      {type === "consistency" && (
        <>
          <Path
            d="M28 31h37a5 5 0 0 1 5 5v23a5 5 0 0 1-5 5H31a5 5 0 0 1-5-5V36a5 5 0 0 1 5-5Z"
            stroke={color}
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
          <Path d="M26 43h44M36 25v13M58 25v13" stroke={color} strokeWidth={3.5} strokeLinecap="round" />
          <Path d="M36 50h7M50 50h7M36 59h7" stroke={color} strokeWidth={5} strokeLinecap="round" />
          <Circle cx={65} cy={66} r={15} fill="#123733" stroke={color} strokeWidth={3.5} />
          <Path d="M58 66l5 5 10-12" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {type === "gratitude" && (
        <>
          <Path
            d="M48 35c-4-8-17-7-17 4 0 9 12 16 17 22 5-6 17-13 17-22 0-11-13-12-17-4Z"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M31 71V57c0-7-7-7-7 0v8c0 7 10 9 14 16M65 71V57c0-7 7-7 7 0v8c0 7-10 9-14 16"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M35 63l8 7M61 63l-8 7" stroke={color} strokeWidth={3.5} strokeLinecap="round" />
        </>
      )}
      {type === "stress" && (
        <>
          <Path
            d="M47 31c-7-7-20-2-20 9-6 2-8 12-1 17-3 8 7 15 14 10 2 7 13 7 15-1 8 2 14-6 10-13 5-7 0-17-8-16-1-8-7-10-10-6Z"
            stroke={color}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M47 31v35M34 42c4 2 6 5 6 9M31 56c4 1 7 3 9 7M56 45c-3 2-5 5-5 9" stroke={color} strokeWidth={3.5} strokeLinecap="round" />
          <Circle cx={68} cy={66} r={13} fill="#191A22" stroke={color} strokeWidth={3.5} />
          <Path d="M68 58v14M62 67l6 6 6-6" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </Svg>
  );
}

function ThemeIcon({
  type,
  color,
  size = 34,
}: {
  type: SanctuaryThemeKey;
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {type === "twilight" ? (
        <>
          <Path d="M31 7c-8 2-14 9-14 17 0 8 6 15 14 17-3 2-6 3-10 3C11 44 4 36 4 26 4 15 12 7 23 7c3 0 6 0 8 0Z" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M34 17l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
        </>
      ) : null}
      {type === "sunrise" ? (
        <>
          <Path d="M8 31h32M14 31a10 10 0 0 1 20 0" stroke={color} strokeWidth={3} strokeLinecap="round" />
          <Path d="M24 8v7M9 22l6 3M39 22l-6 3M14 13l5 5M34 13l-5 5" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        </>
      ) : null}
      {type === "ocean" ? (
        <>
          <Path d="M9 30c4-5 8-5 12 0s8 5 12 0 6-4 8-2" stroke={color} strokeWidth={3} strokeLinecap="round" />
          <Path d="M13 23c4-5 8-5 12 0s7 4 10 1" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.75} />
          <Path d="M31 13c-9 1-15 7-16 16 5-6 10-8 18-6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {type === "forest" ? (
        <>
          <Path d="M24 6 10 26h9L7 42h34L29 26h9L24 6Z" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M24 27v15" stroke={color} strokeWidth={3} strokeLinecap="round" />
        </>
      ) : null}
      {type === "blossom" ? (
        <>
          {[0, 72, 144, 216, 288].map((rotation) => (
            <Ellipse key={rotation} cx={24} cy={15} rx={6} ry={11} stroke={color} strokeWidth={2.7} transform={`rotate(${rotation} 24 24)`} />
          ))}
          <Circle cx={24} cy={24} r={4} fill={color} />
          <Path d="M24 31v10" stroke={color} strokeWidth={2.7} strokeLinecap="round" />
        </>
      ) : null}
      {type === "mountain" ? (
        <>
          <Path d="M5 39 19 14l9 14 5-8 10 19H5Z" stroke={color} strokeWidth={3} strokeLinejoin="round" />
          <Path d="m19 14 3 10 6 4M33 20l-3 9" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        </>
      ) : null}
      {type === "misty" || type === "cloud" ? (
        <>
          <Path d="M14 34h22a8 8 0 0 0 0-16 12 12 0 0 0-23-3A9.5 9.5 0 0 0 14 34Z" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M12 40h25" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.72} />
        </>
      ) : null}
      {type === "desert" ? (
        <Path d="M24 41V14a7 7 0 0 1 14 0v8M24 25H13a6 6 0 0 1-6-6v-5M24 31h12a6 6 0 0 0 6-6v-5M13 41h22" stroke={color} strokeWidth={3} strokeLinecap="round" />
      ) : null}
      {type === "snowfall" ? (
        <>
          <Path d="M24 6v36M9 15l30 18M39 15 9 33" stroke={color} strokeWidth={3} strokeLinecap="round" />
          <Circle cx={24} cy={24} r={4} fill={color} />
        </>
      ) : null}
      {type === "northern" ? (
        <>
          <Path d="M8 34c7-19 12-19 16 0 5-26 11-26 17-3" stroke={color} strokeWidth={3} strokeLinecap="round" />
          <Path d="m13 9 2 5 5 2-5 2-2 5-2-5-5-2 5-2ZM34 8l1.5 3.5L39 13l-3.5 1.5L34 18l-1.5-3.5L29 13l3.5-1.5Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        </>
      ) : null}
    </Svg>
  );
}

function LockMark({ color = "#A9B3C3", size = 13 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M5 7V5.6a3 3 0 0 1 6 0V7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Rect x={3.5} y={7} width={9} height={6.5} rx={1.8} fill={color} opacity={0.9} />
    </Svg>
  );
}

function ThemePictureNative({
  theme,
  large = false,
}: {
  theme: (typeof SANCTUARY_THEMES)[number];
  large?: boolean;
}) {
  const isSunrise = theme.key === "sunrise";
  const isOcean = theme.key === "ocean";
  const isBlossom = theme.key === "blossom";
  const skyId = `themeSky${theme.key}`;
  const groundId = `themeGround${theme.key}`;
  const lightId = `themeLight${theme.key}`;

  return (
    <Svg width="100%" height="100%" viewBox="0 0 520 320" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id={skyId} x1="0" y1="0" x2="1" y2="1">
          <Stop stopColor={theme.panel[0]} />
          <Stop offset={0.52} stopColor={theme.panel[1]} />
          <Stop offset={1} stopColor={theme.panel[2]} />
        </SvgLinearGradient>
        <SvgLinearGradient id={groundId} x1="0" y1="190" x2="520" y2="320">
          <Stop stopColor={isOcean ? "#123F64" : isBlossom ? "#4A2946" : "#245F42"} />
          <Stop offset={1} stopColor="#08110F" />
        </SvgLinearGradient>
        <SvgLinearGradient id={lightId} x1="250" y1="0" x2="520" y2="260">
          <Stop stopColor={theme.accent} stopOpacity={0.48} />
          <Stop offset={1} stopColor={theme.accent} stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>
      <Rect width={520} height={320} fill={`url(#${skyId})`} />
      <Rect width={520} height={320} fill={`url(#${lightId})`} opacity={0.7} />
      {isSunrise ? (
        <Circle cx={342} cy={126} r={36} fill="#F5BD6D" opacity={0.92} />
      ) : theme.key === "twilight" ? (
        <Path d="M377 72c-31 14-38 55-9 76-39-8-58-49-43-82 9-21 29-34 52-36Z" fill="#FFD9A3" />
      ) : null}
      <Path d="M-30 178C72 116 156 132 230 170C318 214 397 128 552 174V320H-30Z" fill="#101A2A" opacity={0.6} />
      <Path d="M-30 222C72 184 142 190 223 210C316 232 399 186 552 204V320H-30Z" fill={`url(#${groundId})`} />
      {isOcean ? (
        <>
          <Path d="M0 213c52-20 88-14 132-1s84 12 134-5 91-14 151 6 85 15 133-8v115H0Z" fill="#123F64" opacity={0.84} />
          <Path d="M38 232c54-18 84 16 140-2s98 12 158-3 90 11 145-4" stroke="#60A5FA" strokeWidth={6} strokeLinecap="round" opacity={0.7} />
        </>
      ) : (
        <>
          <G transform={`translate(${large ? 218 : 250} 167) scale(${large ? 1.12 : 0.95})`}>
            <Path d="M-10 76c6-36 8-76 1-108h22C7 1 9 40 19 76Z" fill="#5B3F34" />
            <Path d="M1 3c-16 24-36 40-66 54M8-2c20 25 42 39 72 51" stroke="#332827" strokeWidth={8} strokeLinecap="round" />
            <Circle cx={-52} cy={-30} r={45} fill={isBlossom ? "#8D5677" : "#376F50"} />
            <Circle cx={0} cy={-62} r={55} fill={isBlossom ? "#B06A95" : "#4C8B61"} />
            <Circle cx={56} cy={-27} r={47} fill={isBlossom ? "#7D4A72" : "#34694E"} />
            <Circle cx={-3} cy={-25} r={52} fill={isBlossom ? "#965682" : "#2F6D50"} />
          </G>
          <G transform="translate(350 177) scale(0.75)">
            <Path d="M0 38 42 4l42 34v62H0Z" fill="#3A2F32" stroke="#6F5A52" strokeWidth={3} />
            <Path d="M-7 40 42 0l50 40" stroke="#73809A" strokeWidth={10} strokeLinecap="round" />
            <Rect x={55} y={48} width={16} height={18} fill="#F5BD6D" opacity={0.86} />
          </G>
          <Ellipse cx={255} cy={244} rx={86} ry={24} fill="#1E6470" opacity={0.9} />
          <Path d="M188 230c38-28 88-28 128 0" stroke="#C08A55" strokeWidth={10} strokeLinecap="round" />
        </>
      )}
      <Circle cx={70} cy={246} r={8} fill={isBlossom ? "#F472B6" : "#F39AC6"} />
      <Circle cx={92} cy={235} r={7} fill="#B79CFF" />
      <Circle cx={115} cy={251} r={8} fill="#F5BD6D" />
    </Svg>
  );
}

function getSanctuaryTheme(key: SanctuaryThemeKey) {
  return SANCTUARY_THEMES.find((theme) => theme.key === key) || SANCTUARY_THEMES[0];
}

const PRIMARY_SANCTUARY_KEYS: SanctuaryThemeKey[] = [
  "cloud",
  "twilight",
  "blossom",
  "forest",
  "ocean",
  "sunrise",
  "misty",
  "desert",
  "mountain",
  "northern",
];

function qualifyingReflectionDays(entries: CheckIn[]) {
  return new Set(
    entries
      .filter((entry) => {
        const id = entry.id.toLowerCase();
        return Boolean(entry.dateKey) && !id.includes("demo") && !id.includes("admin-test");
      })
      .map((entry) => entry.dateKey)
  ).size;
}

function currentWeekReflectionDays(entries: CheckIn[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return new Set(
    entries
      .filter((entry) => {
        const id = entry.id.toLowerCase();
        return Boolean(entry.dateKey) && !id.includes("demo") && !id.includes("admin-test") && new Date(entry.createdAt) >= start;
      })
      .map((entry) => entry.dateKey)
  ).size;
}

function CompletionCheckMark({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx={10} cy={10} r={9} fill={color} opacity={0.18} />
      <Circle cx={10} cy={10} r={8.25} stroke={color} strokeWidth={1.5} />
      <Path d="m6.4 10.2 2.25 2.25 4.95-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function latestCompletedWeeklyPeriod(now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() - end.getDay());
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(end.getDate() - 6);
  return {
    start,
    end,
    startKey: todayKeyFromDate(start),
    endKey: todayKeyFromDate(end),
  };
}

function createFirstWeekAccess(now = new Date()): ComplimentaryAccess {
  const endsAtDate = new Date(now);
  endsAtDate.setDate(endsAtDate.getDate() + 7);
  return {
    startedAt: now.toISOString(),
    endsAt: endsAtDate.toISOString(),
    status: "active",
    source: "first_week",
    weeklyReflectionDeliveredAt: null,
    conversionPromptShownAt: null,
  };
}

function normalizeComplimentaryAccess(access?: ComplimentaryAccess | null, now = new Date()) {
  if (!access) return null;
  if (access.status !== "active") return access;
  return new Date(access.endsAt).getTime() <= now.getTime()
    ? { ...access, status: "expired" as const }
    : access;
}

function hasActiveComplimentaryAccess(access?: ComplimentaryAccess | null) {
  return normalizeComplimentaryAccess(access)?.status === "active";
}

function hasTranqlyAccess(premium: boolean, access?: ComplimentaryAccess | null) {
  return premium || hasActiveComplimentaryAccess(access);
}

function isThemeUnlocked(
  theme: (typeof SANCTUARY_THEMES)[number],
  checkInCount: number,
  premium = false,
  seasonalUnlocked = false
) {
  if (theme.unlockType === "plus") return premium;
  if (theme.unlockType === "seasonal") return seasonalUnlocked;
  return checkInCount >= theme.unlockDays;
}

function nextThemeUnlock(checkInCount: number, premium = false) {
  return PRIMARY_SANCTUARY_KEYS.map(getSanctuaryTheme)
    .sort((a, b) => a.unlockDays - b.unlockDays)
    .find((theme) => theme.unlockType === "reflections" && !isThemeUnlocked(theme, checkInCount, premium)) ?? null;
}

function sanctuaryThemesByUnlock() {
  return [...SANCTUARY_THEMES].sort((a, b) => {
    const aRank = a.unlockType === "reflections" ? 0 : a.unlockType === "plus" ? 1 : 2;
    const bRank = b.unlockType === "reflections" ? 0 : b.unlockType === "plus" ? 1 : 2;
    if (aRank !== bRank) return aRank - bRank;
    return a.unlockDays - b.unlockDays;
  });
}

function themeProgressLabel(theme: (typeof SANCTUARY_THEMES)[number], checkInCount: number, premium = false) {
  if (isThemeUnlocked(theme, checkInCount, premium)) return "Unlocked";
  if (theme.unlockType === "plus") return "Tranqly Plus";
  if (theme.unlockType === "seasonal") return "Available during seasonal events";
  const remaining = Math.max(0, theme.unlockDays - checkInCount);
  return `${Math.min(checkInCount, theme.unlockDays)} / ${theme.unlockDays} Reflection Days | ${remaining} to go`;
}

function growthNoticeFor(previousCount: number, nextCount: number) {
  const unlocked = [...SANCTUARY_THEMES]
    .sort((a, b) => a.unlockDays - b.unlockDays)
    .find((theme) => theme.unlockType === "reflections" && previousCount < theme.unlockDays && nextCount >= theme.unlockDays);
  return unlocked ? `${unlocked.label} unlocked. A new sanctuary is ready for you.` : "";
}

type SanctuaryThemeScores = {
  calm: number;
  consistency: number;
  gratitude: number;
  stress: number;
  smallWins: number;
  nature: number;
};

type SanctuaryProgress = {
  totalCheckIns: number;
  unlockedElements: string[];
  treeStage: number;
  flowerStage: number;
  pondStage: number;
  cabinStage: number;
  nextUnlock: { name: string; daysRemaining: number; unlockDay: number } | null;
};

const SANCTUARY_MILESTONES = [
  { day: 1, name: "Seed" },
  { day: 7, name: "Tree" },
  { day: 14, name: "More flowers" },
  { day: 21, name: "Bushes" },
  { day: 28, name: "Rocks" },
  { day: 42, name: "Pond" },
  { day: 56, name: "Butterflies" },
  { day: 70, name: "Bench" },
  { day: 84, name: "Birds" },
  { day: 100, name: "Lantern" },
  { day: 140, name: "Fireflies" },
  { day: 180, name: "Cabin" },
  { day: 365, name: "Full sanctuary" },
];

const SANCTUARY_IMAGES = {
  birds: [
    require("./assets/sanctuary/bird_s1.png"),
    require("./assets/sanctuary/bird_s2.png"),
    require("./assets/sanctuary/birs_s3.png"),
  ],
  butterfly: require("./assets/sanctuary/unique_butterfly.png"),
  bush: require("./assets/sanctuary/unique_bush_1.png"),
  cabin: require("./assets/sanctuary/unique_cabin.png"),
  clouds: {
    evening: require("./assets/sanctuary/could_s_evening.png"),
    moon: require("./assets/sanctuary/could_s_moon.png"),
    night: require("./assets/sanctuary/could_s_night.png"),
    partly: require("./assets/sanctuary/cloud_s_partly.png"),
  },
  flowers: [
    require("./assets/sanctuary/flower_s1.png"),
    require("./assets/sanctuary/flower_s2.png"),
    require("./assets/sanctuary/flower_s3.png"),
  ],
  ground: require("./assets/sanctuary/unique_ground.png"),
  lantern: require("./assets/sanctuary/unique_lantern.png"),
  ponds: [
    require("./assets/sanctuary/pond_s_small.png"),
    require("./assets/sanctuary/pond_s_lilypads.png"),
    require("./assets/sanctuary/pond_s_reeds.png"),
    require("./assets/sanctuary/pond_s_bridge.png"),
  ],
  bridge: require("./assets/sanctuary/pond_s_bridge.png"),
  rocks: require("./assets/sanctuary/unique_rocks.png"),
  seasons: {
    spring: require("./assets/sanctuary/season_spring.png"),
    summer: require("./assets/sanctuary/season_summer.png"),
    fall: require("./assets/sanctuary/season_fall.png"),
    winter: require("./assets/sanctuary/season_winter.png"),
  },
  trees: [
    require("./assets/sanctuary/tree_s1.png"),
    require("./assets/sanctuary/tree_s2.png"),
    require("./assets/sanctuary/tree_s4.png"),
    require("./assets/sanctuary/tree_s5.png"),
    require("./assets/sanctuary/tree_s6.png"),
    require("./assets/sanctuary/tree_s7.png"),
  ],
};

type SanctuaryAnimation =
  | "cloud"
  | "tree"
  | "butterfly"
  | "bird"
  | "lantern"
  | "pond"
  | "firefly";

type SanctuaryLayerLayout = {
  x: number;
  y: number;
  width: number;
  scale: number;
  anchor?: "center" | "bottom";
  rotate?: number;
  z: number;
  opacity?: number;
  animation?: SanctuaryAnimation;
  optional?: boolean;
};

const SANCTUARY_CANVAS = { width: 1000, height: 700 };

const SANCTUARY_LAYOUT: Record<string, SanctuaryLayerLayout> = {
  starsLeft: { x: 116, y: 132, width: 12, scale: 1, z: 1, animation: "firefly", optional: true },
  starsMid: { x: 650, y: 120, width: 11, scale: 1, z: 1, animation: "firefly", optional: true },
  cloudLeft: { x: 148, y: 222, width: 122, scale: 1, z: 2, opacity: 0.28, animation: "cloud", optional: true },
  cloudRight: { x: 830, y: 112, width: 112, scale: 1, z: 2, opacity: 0.42, animation: "cloud" },
  bird: { x: 695, y: 250, width: 44, scale: 1, rotate: -8, z: 3, opacity: 0.78, animation: "bird" },
  cabin: { x: 770, y: 508, width: 190, scale: 1, anchor: "bottom", z: 6, opacity: 0.96 },
  pond: { x: 515, y: 555, width: 360, scale: 1, z: 7, animation: "pond" },
  bushesLeft: { x: 275, y: 512, width: 150, scale: 1, anchor: "bottom", z: 8 },
  bushesRight: { x: 690, y: 516, width: 138, scale: 1, anchor: "bottom", z: 8 },
  tree: { x: 415, y: 530, width: 365, scale: 1, anchor: "bottom", z: 9, animation: "tree" },
  bridge: { x: 515, y: 520, width: 230, scale: 1, z: 10 },
  rocksLeft: { x: 225, y: 596, width: 120, scale: 1, anchor: "bottom", z: 11 },
  rocksRight: { x: 780, y: 598, width: 116, scale: 1, anchor: "bottom", z: 11 },
  flowersLeft: { x: 190, y: 580, width: 156, scale: 1, anchor: "bottom", z: 12 },
  flowersRight: { x: 745, y: 580, width: 108, scale: 1, anchor: "bottom", z: 12 },
  lantern: { x: 680, y: 526, width: 72, scale: 1, anchor: "bottom", z: 13, animation: "lantern" },
  butterfly: { x: 252, y: 300, width: 48, scale: 1, rotate: -8, z: 14, animation: "butterfly" },
  fireflyA: { x: 184, y: 226, width: 6, scale: 1, z: 15, animation: "firefly", optional: true },
  fireflyB: { x: 585, y: 178, width: 6, scale: 1, z: 15, animation: "firefly", optional: true },
  fireflyC: { x: 818, y: 258, width: 6, scale: 1, z: 15, animation: "firefly", optional: true },
};

function todayKeyFromDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type JourneyTagKey =
  | "calm"
  | "sad"
  | "stress"
  | "gratitude"
  | "exercise"
  | "family"
  | "work";

const JOURNEY_TAGS: { key: JourneyTagKey; label: string; pattern: RegExp }[] = [
  { key: "calm", label: "Calm", pattern: /calm|peace|slow|quiet|rest|walk|outside|breathe|present/i },
  { key: "sad", label: "Sad", pattern: /sad|lonely|down|cry|hurt|grief|miss/i },
  { key: "stress", label: "Stress", pattern: /stress|busy|overwhelm|anxious|pressure|tired|hard|deadline/i },
  { key: "gratitude", label: "Gratitude", pattern: /grateful|thankful|appreciate|love|proud|good|win/i },
  { key: "exercise", label: "Exercise", pattern: /walk|run|gym|workout|exercise|outside|hike|bike/i },
  { key: "family", label: "Family", pattern: /family|mom|dad|parent|child|kids|partner|wife|husband|sister|brother/i },
  { key: "work", label: "Work", pattern: /work|job|meeting|boss|client|deadline|office|project/i },
];

function JourneyTagIcon({ type, color }: { type: JourneyTagKey; color: string }) {
  if (type === "work") {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Path d="M5 7h14a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2Z" stroke={color} strokeWidth={2} />
        <Path d="M9 12h6" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }
  if (type === "stress") {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18a4 4 0 0 1-4-4c0-1.7 1-3.2 2.5-3.8A4.5 4.5 0 0 1 16 8.5a3.8 3.8 0 0 1 3 6.2" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Path d="M12 12v4M16 12v3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }
  if (type === "gratitude" || type === "family") {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  if (type === "exercise") {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Path d="M6 19c2.5-1.2 4.2-3.1 5-5.7M11 13.3l3 2.7M10 8l3 2 3-1" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={9} cy={5} r={2} stroke={color} strokeWidth={2} />
      </Svg>
    );
  }
  if (type === "sad") {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        <Path d="M12 21c3.5-3.2 6-6.2 6-10a6 6 0 0 0-12 0c0 3.8 2.5 6.8 6 10Z" stroke={color} strokeWidth={2} />
        <Path d="M9 11h.01M15 11h.01M9 16c1.8-1.2 4.2-1.2 6 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M12 19c-4-4.4-4-9.5 0-14 4 4.5 4 9.6 0 14Z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 18c3.3-1.4 10.7-1.4 14 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function journeyTagsForText(text: string) {
  const tags = JOURNEY_TAGS.filter((tag) => tag.pattern.test(text));
  return tags.length ? tags : [JOURNEY_TAGS[0]];
}

function journeyCount(entries: CheckIn[], pattern: RegExp) {
  return entries.reduce((total, entry) => total + (entry.text.match(pattern) ?? []).length, 0);
}

function buildMobileJourney(entries: CheckIn[]) {
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activeTags = JOURNEY_TAGS.map((tag) => ({
    ...tag,
    count: sorted.filter((entry) => tag.pattern.test(entry.text)).length,
  })).filter((tag) => tag.count > 0).sort((a, b) => b.count - a.count);
  const workStress = journeyCount(sorted, /work|job|meeting|deadline|boss|client/gi);
  const walks = journeyCount(sorted, /walk|outside|hike|park|fresh air/gi);
  const gratitude = journeyCount(sorted, /grateful|thankful|appreciate|love|proud|win/gi);
  const stress = journeyCount(sorted, /stress|overwhelm|anxious|pressure|hard|tired/gi);
  const calm = journeyCount(sorted, /calm|peace|slow|quiet|rest|present/gi);
  const strongest = sorted.find((entry) => /proud|finally|present|better|win|grateful|calm/i.test(entry.text)) ?? sorted[0];
  const remember = sorted.find((entry) => /walk|smiled|family|outside|proud|present/i.test(entry.text)) ?? sorted[sorted.length - 1];
  return {
    activeTags,
    memoryFacts: [
      walks > 0 ? `Walking or outside time has appeared ${walks} times.` : "Tranqly is learning what clears your mind.",
      workStress > 0 ? `Work has appeared ${workStress} times.` : "Work patterns will appear as you check in.",
      gratitude > 0 ? "Gratitude is becoming a visible thread." : "Gratitude patterns are still forming.",
      calm >= stress ? "Calmer language is keeping pace with stress." : "Stress is worth watching this month.",
    ],
    strongest,
    remember,
    chapters: [
      calm >= stress ? "Finding Calm" : "Understanding Stress",
      walks > 2 ? "Returning Outside" : "Building Consistency",
      gratitude > 2 ? "Learning Gratitude" : "Noticing Patterns",
    ],
    relationship: [
      `${sorted.length} reflection${sorted.length === 1 ? "" : "s"} saved.`,
      workStress ? "Work stress became easier to spot." : "Tranqly is watching for stress patterns.",
      walks ? "Outside time is becoming part of the map." : "Helpful habits will appear here.",
      gratitude ? "Gratitude started showing up clearly." : "Gratitude trends are still forming.",
    ],
    counts: { workStress, walks, gratitude, stress, calm },
  };
}

function sanctuaryThemeScoresFromCheckIns(entries: CheckIn[]): SanctuaryThemeScores {
  const text = entries.map((entry) => entry.text).join(" ").toLowerCase();
  const count = (pattern: RegExp) => (text.match(pattern) ?? []).length;
  const total = Math.max(1, entries.length);
  const calmHits = count(/calm|peace|slow|quiet|rest|outside|walk|breathe|breath/g);
  const gratitudeHits = count(/grateful|thankful|appreciate|good|happy|love|win|proud/g);
  const stressHits = count(/stress|busy|overwhelm|tired|anxious|hard|pressure/g);
  const winHits = count(/win|finished|proud|progress|better|did it|showed up/g);
  const natureHits = count(/outside|walk|tree|sun|garden|bird|water|pond|nature/g);

  return {
    calm: Math.min(1, calmHits / total),
    consistency: Math.min(1, total / 30),
    gratitude: Math.min(1, gratitudeHits / total),
    stress: Math.min(1, stressHits / total),
    smallWins: Math.min(1, winHits / total),
    nature: Math.min(1, natureHits / total),
  };
}

function getSanctuaryProgress(
  totalCheckIns: number,
  scores: SanctuaryThemeScores
): SanctuaryProgress {
  const unlockedElements = ["ground", "sky"];
  if (totalCheckIns >= 1) unlockedElements.push("seed");
  if (totalCheckIns >= 7) unlockedElements.push("tree", "flowers");
  if (totalCheckIns >= 21) unlockedElements.push("bushes");
  if (totalCheckIns >= 28) unlockedElements.push("rocks");
  if (totalCheckIns >= 42) unlockedElements.push("pond");
  if (totalCheckIns >= 56 || scores.nature > 0.45) unlockedElements.push("butterflies");
  if (totalCheckIns >= 70) unlockedElements.push("bench");
  if (totalCheckIns >= 84 || scores.nature > 0.65) unlockedElements.push("birds");
  if (totalCheckIns >= 100) unlockedElements.push("lantern");
  if (totalCheckIns >= 140 || scores.smallWins > 0.5) unlockedElements.push("fireflies");
  if (totalCheckIns >= 180) unlockedElements.push("cabin");

  const next = SANCTUARY_MILESTONES.find((milestone) => totalCheckIns < milestone.day);

  return {
    totalCheckIns,
    unlockedElements: Array.from(new Set(unlockedElements)),
    treeStage: Math.min(6, Math.max(0, Math.floor(totalCheckIns / 14) + (scores.consistency > 0.7 ? 1 : 0))),
    flowerStage: Math.min(5, Math.max(0, Math.floor(totalCheckIns / 14) + (scores.gratitude > 0.5 ? 1 : 0))),
    pondStage: totalCheckIns >= 42 ? Math.min(4, Math.max(1, Math.floor((totalCheckIns - 28) / 28) + (scores.calm > 0.6 ? 1 : 0))) : 0,
    cabinStage: totalCheckIns >= 365 ? 2 : totalCheckIns >= 180 ? 1 : 0,
    nextUnlock: next
      ? {
          name: next.name,
          daysRemaining: next.day - totalCheckIns,
          unlockDay: next.day,
        }
      : null,
  };
}

function SanctuaryScene({
  progress,
  compact = false,
}: {
  progress: SanctuaryProgress;
  compact?: boolean;
}) {
  const [availableWidth, setAvailableWidth] = useState(0);
  const windowWidth = useWindowDimensions().width;
  const mode = compact ? "card" : "full";
  const aspectRatio = mode === "card" ? 1.28 : windowWidth >= 768 ? 1.58 : 1.45;
  const maxSceneWidth = mode === "card" ? 620 : windowWidth >= 1024 ? 900 : 760;
  const maxSceneHeight = mode === "card" ? 430 : 620;
  const measuredWidth = availableWidth || Math.max(320, windowWidth - 32);
  const sceneWidth = Math.min(measuredWidth, maxSceneWidth, maxSceneHeight * aspectRatio);
  const sceneHeight = sceneWidth / aspectRatio;
  const scale = Math.min(
    sceneWidth / SANCTUARY_CANVAS.width,
    sceneHeight / SANCTUARY_CANVAS.height
  );
  const offsetX = (sceneWidth - SANCTUARY_CANVAS.width * scale) / 2;
  const offsetY = (sceneHeight - SANCTUARY_CANVAS.height * scale) / 2;
  const smallScene = sceneWidth < 390;
  const has = (element: string) => progress.unlockedElements.includes(element);
  const treeImage = SANCTUARY_IMAGES.trees[Math.min(5, Math.max(0, progress.treeStage - 1))];
  const flowerImage = SANCTUARY_IMAGES.flowers[Math.min(2, Math.max(0, progress.flowerStage - 1))];
  const pondImage = SANCTUARY_IMAGES.ponds[Math.min(3, Math.max(0, progress.pondStage - 1))];
  const birdImage = SANCTUARY_IMAGES.birds[Math.min(2, progress.totalCheckIns >= 140 ? 2 : progress.totalCheckIns >= 100 ? 1 : 0)];
  const treeSway = useRef(new Animated.Value(0)).current;
  const cloudDrift = useRef(new Animated.Value(0)).current;
  const butterflyFloat = useRef(new Animated.Value(0)).current;
  const birdHop = useRef(new Animated.Value(0)).current;
  const lanternGlow = useRef(new Animated.Value(0)).current;
  const pondRipple = useRef(new Animated.Value(0)).current;
  const fireflyPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(treeSway, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(treeSway, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(cloudDrift, { toValue: 1, duration: 6200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(cloudDrift, { toValue: 0, duration: 6200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(butterflyFloat, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(butterflyFloat, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(birdHop, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(birdHop, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lanternGlow, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(lanternGlow, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pondRipple, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pondRipple, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(fireflyPulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(fireflyPulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [birdHop, butterflyFloat, cloudDrift, fireflyPulse, lanternGlow, pondRipple, treeSway]);

  const animatedValues = {
    birdHop,
    butterflyFloat,
    cloudDrift,
    fireflyPulse,
    lanternGlow,
    pondRipple,
    treeSway,
  };

  const layers = [
    { key: "cloudLeft", source: SANCTUARY_IMAGES.clouds.night, visible: true },
    { key: "cloudRight", source: SANCTUARY_IMAGES.clouds.partly, visible: true },
    { key: "bird", source: birdImage, visible: has("birds") },
    { key: "cabin", source: SANCTUARY_IMAGES.cabin, visible: progress.cabinStage > 0 },
    { key: "tree", source: has("tree") ? treeImage : SANCTUARY_IMAGES.trees[0], visible: has("seed") || has("tree") },
    { key: "bushesLeft", source: SANCTUARY_IMAGES.bush, visible: has("bushes") },
    { key: "bushesRight", source: SANCTUARY_IMAGES.bush, visible: has("bushes") },
    { key: "flowersLeft", source: flowerImage, visible: progress.flowerStage > 0 },
    { key: "flowersRight", source: flowerImage, visible: progress.flowerStage > 1 },
    { key: "pond", source: pondImage, visible: progress.pondStage > 0 },
    { key: "bridge", source: SANCTUARY_IMAGES.bridge, visible: progress.pondStage > 2 },
    { key: "rocksLeft", source: SANCTUARY_IMAGES.rocks, visible: has("rocks") },
    { key: "rocksRight", source: SANCTUARY_IMAGES.rocks, visible: has("rocks") },
    { key: "lantern", source: SANCTUARY_IMAGES.lantern, visible: has("lantern") },
    { key: "butterfly", source: SANCTUARY_IMAGES.butterfly, visible: has("butterflies") },
  ].filter((layer) => {
    const layout = SANCTUARY_LAYOUT[layer.key];
    return layer.visible && !(smallScene && layout.optional);
  }).sort((a, b) => SANCTUARY_LAYOUT[a.key].z - SANCTUARY_LAYOUT[b.key].z);

  const fireflyKeys = ["starsLeft", "starsMid", "fireflyA", "fireflyB", "fireflyC"].filter((key) =>
    (key.startsWith("stars") || has("fireflies")) && !(smallScene && SANCTUARY_LAYOUT[key].optional)
  );

  return (
    <View
      style={styles.sanctuaryResponsiveWrap}
      onLayout={(event: LayoutChangeEvent) => setAvailableWidth(event.nativeEvent.layout.width)}
    >
      <View
        style={[
          styles.sanctuaryScene,
          {
            width: sceneWidth,
            height: sceneHeight,
          },
        ]}
      >
        <LinearGradient
          colors={["#132134", "#0B111D", "#071018"]}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SanctuaryLandscape />
        {fireflyKeys.map((key) => (
          <SanctuarySpark
            key={key}
            layout={SANCTUARY_LAYOUT[key]}
            pulse={fireflyPulse}
            scale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
          />
        ))}
        {has("lantern") ? (
          <SanctuaryGlow
            layout={SANCTUARY_LAYOUT.lantern}
            pulse={lanternGlow}
            scale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
          />
        ) : null}
        {layers.map((layer) => (
          <SanctuaryLayer
            key={layer.key}
            layoutKey={layer.key}
            source={layer.source}
            layout={SANCTUARY_LAYOUT[layer.key]}
            animatedValues={animatedValues}
            scale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
          />
        ))}
      </View>
    </View>
  );
}

function SanctuaryLayer({
  layoutKey,
  source,
  layout,
  animatedValues,
  scale,
  offsetX,
  offsetY,
}: {
  layoutKey: string;
  source: ImageSourcePropType;
  layout: SanctuaryLayerLayout;
  animatedValues: {
    birdHop: Animated.Value;
    butterflyFloat: Animated.Value;
    cloudDrift: Animated.Value;
    fireflyPulse: Animated.Value;
    lanternGlow: Animated.Value;
    pondRipple: Animated.Value;
    treeSway: Animated.Value;
  };
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const width = layout.width * layout.scale * scale;
  const baseTransforms: any[] = [];
  const rotate = layout.rotate ?? 0;

  if (layout.animation === "cloud") {
    baseTransforms.push({
      translateX: animatedValues.cloudDrift.interpolate({
        inputRange: [0, 1],
        outputRange: [0, layoutKey === "cloudLeft" ? 10 : -15],
      }),
    });
  }
  if (layout.animation === "tree") {
    baseTransforms.push({
      rotate: animatedValues.treeSway.interpolate({
        inputRange: [0, 1],
        outputRange: ["-1deg", "1deg"],
      }),
    });
  } else if (rotate) {
    baseTransforms.push({ rotate: `${rotate}deg` });
  }
  if (layout.animation === "butterfly") {
    baseTransforms.push(
      {
        translateY: animatedValues.butterflyFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10],
        }),
      },
      {
        translateX: animatedValues.butterflyFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 8],
        }),
      }
    );
  }
  if (layout.animation === "bird") {
    baseTransforms.push({
      translateY: animatedValues.birdHop.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -5],
      }),
    });
  }
  if (layout.animation === "pond") {
    baseTransforms.push({
      scale: animatedValues.pondRipple.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.025],
      }),
    });
  }
  if (layout.animation === "lantern") {
    baseTransforms.push({
      scale: animatedValues.lanternGlow.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.035],
      }),
    });
  }

  return (
    <Animated.Image
      source={source}
      resizeMode="contain"
      style={[
        styles.sanctuaryLayer,
        {
          left: offsetX + layout.x * scale,
          top: offsetY + layout.y * scale,
          width,
          aspectRatio: 1,
          opacity: layout.opacity ?? 1,
          zIndex: layout.z,
          transform: [
            { translateX: -width / 2 },
            { translateY: layout.anchor === "bottom" ? -width : -width / 2 },
            ...baseTransforms,
          ],
        },
      ]}
    />
  );
}

function SanctuarySpark({
  layout,
  pulse,
  scale,
  offsetX,
  offsetY,
}: {
  layout: SanctuaryLayerLayout;
  pulse: Animated.Value;
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const size = Math.max(3, layout.width * scale);
  return (
    <Animated.View
      style={[
        styles.fireflyDot,
        {
          left: offsetX + layout.x * scale,
          top: offsetY + layout.y * scale,
          width: size,
          height: size,
          borderRadius: size / 2,
          zIndex: layout.z,
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.22, 1],
          }),
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.75, 1.35],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function SanctuaryGlow({
  layout,
  pulse,
  scale,
  offsetX,
  offsetY,
}: {
  layout: SanctuaryLayerLayout;
  pulse: Animated.Value;
  scale: number;
  offsetX: number;
  offsetY: number;
}) {
  const size = 130 * scale;
  return (
    <Animated.View
      style={[
        styles.sanctuaryLanternGlow,
        {
          left: offsetX + layout.x * scale - size / 2,
          top: offsetY + layout.y * scale - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          zIndex: layout.z - 1,
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.2, 0.65],
          }),
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.82, 1.12],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function SanctuaryLandscape() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 1000 700"
      preserveAspectRatio="xMidYMid slice"
      style={styles.sanctuaryLandscape}
    >
      <Defs>
        <SvgLinearGradient id="hillBack" x1="0" y1="285" x2="1000" y2="570">
          <Stop stopColor="#173C35" />
          <Stop offset={1} stopColor="#10251E" />
        </SvgLinearGradient>
        <SvgLinearGradient id="grassMid" x1="0" y1="390" x2="1000" y2="650">
          <Stop stopColor="#245F42" />
          <Stop offset={0.58} stopColor="#1C4834" />
          <Stop offset={1} stopColor="#0E1C18" />
        </SvgLinearGradient>
        <SvgLinearGradient id="grassFront" x1="0" y1="510" x2="1000" y2="700">
          <Stop stopColor="#1F5338" />
          <Stop offset={1} stopColor="#08110F" />
        </SvgLinearGradient>
      </Defs>
      <Path
        d="M-80 395C95 315 205 345 326 376C478 414 604 313 747 354C878 391 974 344 1080 316V700H-80Z"
        fill="url(#hillBack)"
        opacity={0.62}
      />
      <Path
        d="M-80 474C92 405 208 420 352 448C505 479 618 395 762 421C886 444 972 424 1080 378V700H-80Z"
        fill="url(#grassMid)"
      />
      <Path
        d="M-80 580C76 527 188 542 314 565C464 592 598 513 744 535C884 556 984 535 1080 500V700H-80Z"
        fill="url(#grassFront)"
      />
      <Path d="M0 520C190 492 365 505 500 518C663 535 830 518 1000 488" stroke="#5B8F58" strokeWidth={5} opacity={0.22} />
      <Path d="M0 612C205 580 392 602 548 616C710 631 860 606 1000 574" stroke="#6FA45F" strokeWidth={4} opacity={0.18} />
      {Array.from({ length: 18 }, (_, index) => {
        const x = 45 + index * 56;
        const y = index % 3 === 0 ? 628 : index % 3 === 1 ? 602 : 650;
        return (
          <Path
            key={`grass-${index}`}
            d={`M${x} ${y}c6-20 12-20 18 0M${x + 12} ${y}c9-24 18-24 26 0`}
            stroke="#6FA45F"
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.2}
          />
        );
      })}
    </Svg>
  );
}

function CloudNative({ x, y, scale, opacity }: { x: number; y: number; scale: number; opacity: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
      <Ellipse cx={0} cy={8} rx={18} ry={8} fill="#33415F" />
      <Circle cx={-8} cy={4} r={8} fill="#33415F" />
      <Circle cx={6} cy={2} r={10} fill="#33415F" />
    </G>
  );
}

function SeedNative() {
  return (
    <G stroke="#D8C4FF" strokeWidth={3} strokeLinecap="round" fill="none">
      <Path d="M180 164v-18" />
      <Path d="M180 152c-10-3-13-10-12-16 8 1 13 6 12 16Z" fill="#3F8F72" />
      <Path d="M181 151c10-3 13-9 12-15-8 1-13 6-12 15Z" fill="#4FAE83" />
    </G>
  );
}

function TreeNative({ scale }: { scale: number }) {
  return (
    <G transform={`translate(180 138) scale(${scale})`}>
      <Path d="M-8 52c5-24 5-50 0-73h18c-6 24-4 49 2 73Z" fill="#5B3F34" />
      <Path d="M0 10c-8 14-18 25-35 34M4 7c10 12 22 22 38 29" stroke="#3B2D2B" strokeWidth={6} strokeLinecap="round" />
      <Circle cx={-30} cy={-16} r={30} fill="#376F50" />
      <Circle cx={0} cy={-36} r={36} fill="#4C8B61" />
      <Circle cx={34} cy={-12} r={31} fill="#34694E" />
      <Circle cx={-5} cy={-10} r={34} fill="#2F6D50" />
      <Circle cx={20} cy={-40} r={24} fill="#5D9B6B" opacity={0.75} />
    </G>
  );
}

function FlowersNative({ count }: { count: number }) {
  const flowers: [number, number, string][] = [
    [96, 171, "#F39AC6"],
    [117, 164, "#B79CFF"],
    [136, 176, "#F5BD6D"],
    [228, 170, "#F39AC6"],
    [250, 166, "#B79CFF"],
  ];
  return (
    <G>
      {flowers.slice(0, count).map(([x, y, color], index) => (
        <G key={`${x}-${index}`} transform={`translate(${x} ${y})`}>
          <Path d="M0 12v-13" stroke="#5A8F62" strokeWidth={2} strokeLinecap="round" />
          <Ellipse cx={-4} cy={-4} rx={4} ry={7} fill={color} />
          <Ellipse cx={4} cy={-4} rx={4} ry={7} fill={color} />
          <Ellipse cx={0} cy={-9} rx={4} ry={7} fill={color} />
          <Circle cx={0} cy={-4} r={2} fill="#F8EFD9" />
        </G>
      ))}
    </G>
  );
}

function BushesNative() {
  return (
    <G fill="#326A4D">
      <Circle cx={92} cy={174} r={12} />
      <Circle cx={106} cy={168} r={16} />
      <Circle cx={122} cy={176} r={12} />
      <Circle cx={246} cy={174} r={13} />
      <Circle cx={262} cy={168} r={15} />
      <Circle cx={278} cy={176} r={12} />
    </G>
  );
}

function RocksNative() {
  return (
    <G fill="#7B8292" opacity={0.85}>
      <Path d="M79 188c6-17 24-17 31 0Z" />
      <Path d="M224 188c5-14 20-14 25 0Z" />
      <Path d="M251 192c5-12 18-12 24 0Z" />
    </G>
  );
}

function PondNative({ stage }: { stage: number }) {
  return (
    <G>
      <Ellipse cx={183} cy={188} rx={stage > 2 ? 58 : 42} ry={stage > 2 ? 20 : 15} fill="#1E6470" />
      <Ellipse cx={183} cy={184} rx={stage > 2 ? 48 : 32} ry={stage > 2 ? 13 : 10} fill="#2B8793" opacity={0.45} />
      <Ellipse cx={164} cy={184} rx={9} ry={4} fill="#7BB66A" />
      {stage > 1 ? <Ellipse cx={203} cy={191} rx={11} ry={5} fill="#7BB66A" /> : null}
      {stage > 3 ? <Path d="M222 176c9-13 17-12 24-4" stroke="#6FA45F" strokeWidth={3} strokeLinecap="round" /> : null}
    </G>
  );
}

function PathNative() {
  return <Path d="M249 190c18 9 34 20 47 34" stroke="#89715A" strokeWidth={10} strokeLinecap="round" strokeDasharray="13 11" opacity={0.7} />;
}

function BenchNative() {
  return (
    <G transform="translate(247 154)" stroke="#A56B42" strokeWidth={4} strokeLinecap="round">
      <Path d="M0 0h45M-2 11h49M7 11v17M39 11v17" />
    </G>
  );
}

function LanternNative() {
  return (
    <G transform="translate(294 150)">
      <Path d="M10 0h18l4 32H6Z" fill="#4A3D35" stroke="#8A6B4A" strokeWidth={2} />
      <Rect x={12} y={8} width={14} height={18} fill="#F5BD6D" opacity={0.8} />
      <Path d="M13 0c1-9 12-9 14 0" stroke="#8A6B4A" strokeWidth={2} fill="none" />
    </G>
  );
}

function CabinNative({ stage }: { stage: number }) {
  return (
    <G transform="translate(260 118)">
      <Path d="M0 28 28 4l28 24v45H0Z" fill={stage > 1 ? "#4B3835" : "#3A2F32"} stroke="#6F5A52" strokeWidth={2} />
      <Path d="M-5 29 28 0l33 29" stroke="#73809A" strokeWidth={8} strokeLinecap="round" />
      <Rect x={21} y={45} width={14} height={28} fill="#251D1E" />
      <Rect x={39} y={35} width={11} height={12} fill="#F5BD6D" opacity={0.85} />
    </G>
  );
}

function BirdsNative() {
  return (
    <G stroke="#8EA2C3" strokeWidth={3} strokeLinecap="round" fill="none">
      <Path d="M258 92c8-8 15-8 23 0" />
      <Path d="M281 92c8-8 15-8 23 0" />
    </G>
  );
}

function ButterfliesNative() {
  return (
    <G fill="#B79CFF">
      <Ellipse cx={86} cy={137} rx={6} ry={10} />
      <Ellipse cx={98} cy={137} rx={6} ry={10} />
      <Ellipse cx={260} cy={128} rx={5} ry={8} />
      <Ellipse cx={270} cy={128} rx={5} ry={8} />
    </G>
  );
}

function FirefliesNative() {
  return (
    <G fill="#F5D56D" opacity={0.85}>
      {[80, 132, 221, 284, 302].map((x, index) => (
        <Circle key={x} cx={x} cy={70 + index * 17} r={2.2} />
      ))}
    </G>
  );
}

type AdminSceneStatus = "draft" | "preview" | "live" | "archived";
type AdminUnlockRequirementType =
  | "complete_previous_scene"
  | "total_checkins"
  | "premium"
  | "manual";

interface AdminScene {
  id: string;
  name: string;
  status: AdminSceneStatus;
  requiredPreviousSceneId?: string;
  unlockRequirementType: AdminUnlockRequirementType;
  unlockRequirementValue: number;
  maxCheckIns: number;
  sortOrder: number;
  previewImage: string;
  backgroundAssetUrl: string;
  groundAssetUrl: string;
  unlockableObjects: string[];
  publishedAt?: string;
  updatedAt: string;
}

const ADMIN_SCENES: AdminScene[] = [
  {
    id: "forest-haven",
    name: "Forest Haven",
    status: "live",
    unlockRequirementType: "manual",
    unlockRequirementValue: 0,
    maxCheckIns: 90,
    sortOrder: 1,
    previewImage: "sanctuary-preview",
    backgroundAssetUrl: "sanctuary-background",
    groundAssetUrl: "sanctuary-ground",
    unlockableObjects: ["tree", "flowers", "pond", "bridge", "lantern", "cabin"],
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "twilight-grove",
    name: "Twilight Grove",
    status: "draft",
    requiredPreviousSceneId: "forest-haven",
    unlockRequirementType: "complete_previous_scene",
    unlockRequirementValue: 90,
    maxCheckIns: 120,
    sortOrder: 2,
    previewImage: "twilight-preview",
    backgroundAssetUrl: "twilight-background",
    groundAssetUrl: "twilight-ground",
    unlockableObjects: ["moon", "tree", "fireflies", "pond", "cabin"],
    updatedAt: new Date().toISOString(),
  },
];

const ADMIN_PREVIEW_DEVICES = [
  { label: "iPhone SE", width: 375, height: 667 },
  { label: "iPhone 15", width: 393, height: 852 },
  { label: "Pro Max", width: 430, height: 932 },
  { label: "iPad", width: 768, height: 900 },
  { label: "Desktop", width: 1024, height: 760 },
];

const ADMIN_PROGRESS = getSanctuaryProgress(87, {
  calm: 0.7,
  consistency: 0.8,
  gratitude: 0.55,
  stress: 0.25,
  smallWins: 0.6,
  nature: 0.7,
});

function validateAdminScene(scene: AdminScene) {
  const errors: string[] = [];
  if (!scene.name.trim()) errors.push("Scene needs a name.");
  if (!scene.backgroundAssetUrl.trim() && !scene.groundAssetUrl.trim()) {
    errors.push("Scene needs at least one ground or background asset.");
  }
  if (!scene.maxCheckIns || scene.maxCheckIns < 1) errors.push("Scene needs max check-ins.");
  if (scene.unlockableObjects.length < 1) errors.push("Scene needs at least one unlockable object.");
  if (!scene.previewImage.trim()) errors.push("Scene needs a preview image.");
  if (scene.requiredPreviousSceneId === scene.id) errors.push("Previous scene cannot point to itself.");
  return errors;
}

function MobileAdminDashboard() {
  const screen = useWindowDimensions();
  const [scenes, setScenes] = useState(ADMIN_SCENES);
  const [selectedId, setSelectedId] = useState(ADMIN_SCENES[0].id);
  const selectedScene = scenes.find((scene) => scene.id === selectedId) || scenes[0];
  const [draft, setDraft] = useState<AdminScene>(selectedScene);
  const [deviceIndex, setDeviceIndex] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  const device = ADMIN_PREVIEW_DEVICES[deviceIndex];
  const previewWidth = Math.min(device.width, Math.max(300, screen.width - 48));
  const previewHeight = Math.min(device.height, screen.width < 620 ? 620 : 720);

  useEffect(() => {
    setDraft(selectedScene);
    setErrors([]);
  }, [selectedScene]);

  function saveScene(next: AdminScene) {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setScenes((current) =>
      current.map((scene) => (scene.id === stamped.id ? stamped : scene))
    );
    setDraft(stamped);
    setSelectedId(stamped.id);
  }

  function saveWithStatus(status: AdminSceneStatus) {
    saveScene({
      ...draft,
      status,
      publishedAt: status === "live" ? draft.publishedAt || new Date().toISOString() : draft.publishedAt,
    });
  }

  function publishScene() {
    const validationErrors = validateAdminScene(draft);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    const publish = () => saveWithStatus("live");
    if (Platform.OS === "web") {
      publish();
      return;
    }

    Alert.alert(
      "Publish this sanctuary for all users?",
      "This will make the scene visible in the app. Users will still need to unlock it based on its requirements.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Publish Live", onPress: publish },
      ]
    );
  }

  function duplicateScene() {
    const copy: AdminScene = {
      ...draft,
      id: `${draft.id}-copy-${Date.now()}`,
      name: `${draft.name} Copy`,
      status: "draft",
      publishedAt: undefined,
      sortOrder: scenes.length + 1,
      updatedAt: new Date().toISOString(),
    };
    setScenes((current) => [...current, copy]);
    setSelectedId(copy.id);
    setDraft(copy);
  }

  return (
    <SafeAreaProvider style={styles.appRoot}>
      <SafeAreaView style={styles.adminRoot}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.adminContent} showsVerticalScrollIndicator={false}>
          <View style={styles.adminHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminEyebrow}>Tranqly admin</Text>
              <Text style={styles.adminTitle}>Sanctuary publishing</Text>
              <Text style={styles.adminSubtitle}>
                Draft, preview, publish, and test scenes across phone and browser sizes.
              </Text>
            </View>
            {Platform.OS === "web" ? (
              <Pressable
                style={styles.adminBackButton}
                onPress={() => {
                  window.location.href = "/";
                }}
              >
                <Text style={styles.adminBackText}>Back to app</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.adminSceneList}>
            {scenes
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((scene) => (
                <Pressable
                  key={scene.id}
                  onPress={() => setSelectedId(scene.id)}
                  style={[
                    styles.adminSceneChip,
                    selectedId === scene.id && styles.adminSceneChipActive,
                  ]}
                >
                  <Text style={styles.adminSceneChipTitle}>{scene.name}</Text>
                  <Text style={styles.adminSceneChipStatus}>{scene.status}</Text>
                </Pressable>
              ))}
          </View>

          <View style={styles.adminGrid}>
            <View style={styles.adminPanel}>
              <Text style={styles.adminPanelTitle}>Scene config</Text>
              <Text style={styles.adminLabel}>Name</Text>
              <TextInput
                value={draft.name}
                onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
                placeholder="Scene name"
                placeholderTextColor="#6F7890"
                style={styles.adminInput}
              />
              <Text style={styles.adminLabel}>Max check-ins</Text>
              <TextInput
                value={String(draft.maxCheckIns)}
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, maxCheckIns: Number(value.replace(/[^0-9]/g, "")) || 0 }))
                }
                keyboardType="number-pad"
                placeholder="90"
                placeholderTextColor="#6F7890"
                style={styles.adminInput}
              />
              <Text style={styles.adminLabel}>Unlock rule</Text>
              <View style={styles.adminRuleRow}>
                {(["manual", "complete_previous_scene", "total_checkins", "premium"] as AdminUnlockRequirementType[]).map((rule) => (
                  <Pressable
                    key={rule}
                    onPress={() => setDraft((current) => ({ ...current, unlockRequirementType: rule }))}
                    style={[
                      styles.adminRuleChip,
                      draft.unlockRequirementType === rule && styles.adminRuleChipActive,
                    ]}
                  >
                    <Text style={styles.adminRuleChipText}>{rule.replace(/_/g, " ")}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.adminLabel}>Unlockable objects</Text>
              <TextInput
                value={draft.unlockableObjects.join(", ")}
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    unlockableObjects: value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="tree, flowers, pond"
                placeholderTextColor="#6F7890"
                style={styles.adminInput}
              />

              {errors.length > 0 ? (
                <View style={styles.adminErrors}>
                  {errors.map((error) => (
                    <Text key={error} style={styles.adminErrorText}>{error}</Text>
                  ))}
                </View>
              ) : null}

              <View style={styles.adminActions}>
                <Pressable style={styles.adminActionButton} onPress={() => saveWithStatus("draft")}>
                  <Text style={styles.adminActionText}>Save Draft</Text>
                </Pressable>
                <Pressable style={styles.adminActionButton} onPress={() => saveWithStatus("preview")}>
                  <Text style={styles.adminActionText}>Preview Draft</Text>
                </Pressable>
                <Pressable style={[styles.adminActionButton, styles.adminActionPrimary]} onPress={publishScene}>
                  <Text style={styles.adminActionPrimaryText}>Publish to Live</Text>
                </Pressable>
                <Pressable style={styles.adminActionButton} onPress={() => saveWithStatus("draft")}>
                  <Text style={styles.adminActionText}>Unpublish</Text>
                </Pressable>
                <Pressable style={styles.adminActionButton} onPress={() => saveWithStatus("archived")}>
                  <Text style={styles.adminActionText}>Archive</Text>
                </Pressable>
                <Pressable style={styles.adminActionButton} onPress={duplicateScene}>
                  <Text style={styles.adminActionText}>Duplicate Scene</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.adminPanel}>
              <Text style={styles.adminPanelTitle}>Responsive preview</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminDeviceRow}>
                {ADMIN_PREVIEW_DEVICES.map((previewDevice, index) => (
                  <Pressable
                    key={previewDevice.label}
                    onPress={() => setDeviceIndex(index)}
                    style={[
                      styles.adminDeviceChip,
                      deviceIndex === index && styles.adminDeviceChipActive,
                    ]}
                  >
                    <Text style={styles.adminDeviceText}>{previewDevice.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.adminPreviewWrap}>
                <View style={[styles.adminPreviewFrame, { width: previewWidth, height: previewHeight }]}>
                  <View style={styles.adminPreviewHeader}>
                    <Text style={styles.adminPreviewTitle}>{draft.name}</Text>
                    <Text style={styles.adminPreviewStatus}>{draft.status}</Text>
                  </View>
                  <ScrollView contentContainerStyle={styles.adminPreviewContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.adminPreviewHeading}>Your sanctuary</Text>
                    <Text style={styles.adminPreviewSubcopy}>Every entry helps it grow.</Text>
                    <SanctuaryScene progress={ADMIN_PROGRESS} compact={device.width < 520} />
                    <View style={styles.sanctuaryProgressBox}>
                      <View style={styles.sanctuaryStatBlock}>
                        <SproutStatIcon color="#7EE8D8" />
                        <View>
                          <Text style={styles.sanctuaryDays}>87</Text>
                          <Text style={styles.sanctuaryProgressText}>Total check-ins</Text>
                        </View>
                      </View>
                      <View style={styles.sanctuaryDivider} />
                      <View style={styles.sanctuaryStatBlock}>
                        <Text style={styles.sanctuaryStatIcon}>Streak</Text>
                        <View>
                          <Text style={styles.sanctuaryDays}>7</Text>
                          <Text style={styles.sanctuaryProgressText}>Current streak</Text>
                        </View>
                      </View>
                    </View>
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function SproutStatIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20v-7" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
      <Path d="M12 13c-4.4 0-6.8-2.6-6.8-7 4.2 0 6.8 2.2 6.8 7Z" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 13c4.4 0 6.8-2.6 6.8-7-4.2 0-6.8 2.2-6.8 7Z" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function mobileAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("EMAIL_NOT_FOUND") || message.includes("INVALID_LOGIN_CREDENTIALS")) {
    return "That email or password did not match.";
  }
  if (message.includes("EMAIL_EXISTS")) return "That email is already connected to a Tranqly account.";
  if (message.includes("INVALID_PASSWORD")) return "That email or password did not match.";
  if (message.includes("WEAK_PASSWORD")) return "Your password needs 8 characters, one uppercase letter, one number, and one special character.";
  if (message.includes("INVALID_EMAIL")) return "Please enter a valid email address.";
  if (message.includes("OPERATION_NOT_ALLOWED") || message.includes("CONFIGURATION_NOT_FOUND")) {
    return "This sign-in method is not enabled for Tranqly yet.";
  }
  if (message.includes("UNAUTHORIZED_DOMAIN") || message.includes("INVALID_CONTINUE_URI")) {
    return "Tranqly's sign-in domain is not authorized in Firebase yet.";
  }
  if (
    message.includes("INVALID_IDP_RESPONSE") ||
    message.includes("INVALID_ID_TOKEN") ||
    message.includes("INVALID_CREDENTIAL") ||
    message.includes("AUDIENCE_MISMATCH") ||
    message.includes("MISSING_OR_INVALID_NONCE")
  ) {
    return "This sign-in method is not configured for this Tranqly build yet.";
  }
  if (message.includes("GOOGLE_CLIENT_PROJECT_MISMATCH")) {
    return "Google Sign In is connected to a different Firebase project. Please update the iOS OAuth client for Tranqly.";
  }
  if (message.includes("API key not valid") || message.includes("INVALID_API_KEY")) {
    return "Tranqly's Firebase API key is not configured for this build.";
  }
  if (message.includes("Firebase is not configured")) return "Tranqly account sign-in is not configured in this build yet.";
  if (message.includes("NETWORK")) return "Tranqly could not connect right now. Please try again in a moment.";
  return "Tranqly could not sign you in right now. Please try again in a moment.";
}

function GoogleProviderIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityLabel="Google">
      <Path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
      <Path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.05v2.62A10 10 0 0 0 12 22Z" />
      <Path fill="#FBBC05" d="M6.4 13.94A6 6 0 0 1 6.08 12c0-.67.11-1.32.32-1.94V7.44H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.56l3.35-2.62Z" />
      <Path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.44l3.35 2.62c.8-2.36 3-4.12 5.6-4.12Z" />
    </Svg>
  );
}

function mobileAuthProviderLabel(user: MobileAuthUser) {
  if (user.providerId === "google.com") return "Google";
  if (user.providerId === "apple.com") return "Apple";
  if (user.providerId === "password") return "Email and password";
  return "Tranqly account";
}

function notificationPermissionState(permission: unknown): "granted" | "denied" | "unknown" {
  const data = permission as {
    granted?: boolean;
    status?: string;
    ios?: { status?: number };
  };
  if (
    data?.granted ||
    data?.status === "granted" ||
    data?.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return "granted";
  }
  if (data?.status === "denied" || data?.ios?.status === Notifications.IosAuthorizationStatus.DENIED) {
    return "denied";
  }
  return "unknown";
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Tranqly startup error", error, info.componentStack);
    logMobileApiError({
      errorCode: "mobile_render_failed",
      errorMessage: error.message || "The mobile app could not render",
      featureArea: "startup",
      metadata: { componentStack: info.componentStack?.slice(0, 1000) },
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0913", alignItems: "center", justifyContent: "center", padding: 28 }}>
          <Image source={TRANQLY_LOGO} style={{ width: 72, height: 72 }} resizeMode="contain" />
          <Text style={{ marginTop: 20, color: "#FFF9FF", fontSize: 24, fontWeight: "900", textAlign: "center" }}>
            Tranqly needs a fresh start.
          </Text>
          <Text style={{ marginTop: 10, color: "#C8BCE6", fontSize: 16, lineHeight: 23, textAlign: "center" }}>
            Close and reopen the app. Your saved reflections will still be here.
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
}

function GoogleAccountButton({
  busy,
  borderColor,
  backgroundColor,
  textColor,
  onCredential,
  onError,
}: {
  busy: boolean;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  onCredential: (idToken?: string, accessToken?: string) => void;
  onError: (message: string) => void;
}) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    selectAccount: true,
  });
  const handledResponseRef = useRef<typeof response>(null);

  useEffect(() => {
    if (!response || handledResponseRef.current === response) return;
    handledResponseRef.current = response;
    if (response.type !== "success") {
      if (response.type === "error") onError("Google sign in could not be completed.");
      return;
    }
    const idToken = response.authentication?.idToken || response.params?.id_token;
    const accessToken = response.authentication?.accessToken || response.params?.access_token;
    if (!idToken && !accessToken) {
      onError("Google did not return a valid sign-in token.");
      return;
    }
    onCredential(idToken, accessToken);
  }, [onCredential, onError, response]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!request || busy}
      onPress={() => void promptAsync()}
      style={[styles.authProviderButton, { borderColor, backgroundColor, opacity: !request || busy ? 0.55 : 1 }]}
    >
      <GoogleProviderIcon />
      <Text style={[styles.authSecondaryText, { color: textColor }]}>{busy ? "Connecting..." : "Continue with Google"}</Text>
    </Pressable>
  );
}

function TranqlyApp() {
  const isAdminRoute =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/admin");

  if (isAdminRoute) {
    return <MobileAdminDashboard />;
  }

  const short = useWindowDimensions().width < 380;

  const [tab, setTab] = useState<Tab>("coach");
  const tabSlide = useRef(new Animated.Value(0)).current;
  const tabOpacity = useRef(new Animated.Value(1)).current;
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [reflectionSource, setReflectionSource] = useState<"voice" | "typed">("typed");
  const [showTranscriptPreview, setShowTranscriptPreview] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [promptOffset, setPromptOffset] = useState(0);
  const [voiceElapsed, setVoiceElapsed] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [composerError, setComposerError] = useState("");
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [premium, setPremium] = useState(false);
  const [coachUsage, setCoachUsage] = useState<{ dateKey: string; count: number }>({
    dateKey: todayKey(),
    count: 0,
  });
  const [moods, setMoods] = useState<Record<string, string>>({});
  const [lastDeepInsight, setLastDeepInsight] = useState<DeepInsight | null>(null);
  const [weeklyInsights, setWeeklyInsights] = useState<DeepInsight[]>([]);
  const [weeklyGenerating, setWeeklyGenerating] = useState(false);
  const weeklyGenerationKeyRef = useRef<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [sanctuaryUnlockNotifications, setSanctuaryUnlockNotifications] = useState<Record<string, string | null>>({});
  const [seasonalSanctuaryUnlocks, setSeasonalSanctuaryUnlocks] = useState<Record<string, string>>({});
  const [authUser, setAuthUser] = useState<MobileAuthUser | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [supportCategory, setSupportCategory] = useState<MobileSupportCategory>("bug");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportNotice, setSupportNotice] = useState("");
  const [supportExpanded, setSupportExpanded] = useState(false);
  const [coachModal, setCoachModal] = useState<{ text: string; reply: CoachReply } | null>(null);
  const [responseFeedbackOpen, setResponseFeedbackOpen] = useState(false);
  const [responseFeedbackText, setResponseFeedbackText] = useState("");
  const [responseFeedbackHistory, setResponseFeedbackHistory] = useState<{ helpful: boolean; reason?: string; detail?: string; createdAt: string }[]>([]);
  const [showJourneyDeepInsight, setShowJourneyDeepInsight] = useState(false);
  const [selectedWeeklyInsight, setSelectedWeeklyInsight] = useState<DeepInsight | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingStatus, setOnboardingStatus] = useState<"not_started" | "in_progress" | "completed" | "skipped">("completed");
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState<OnboardingStep | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [onboardingCoachCompleted, setOnboardingCoachCompleted] = useState(false);
  const [onboardingCoachStep, setOnboardingCoachStep] = useState<"mic" | "journey" | "sanctuary" | null>(null);
  const [onboardingSkippedAt, setOnboardingSkippedAt] = useState<string | null>(null);
  const [onboardingCoachCompletedAt, setOnboardingCoachCompletedAt] = useState<string | null>(null);
  const [complimentaryAccess, setComplimentaryAccess] = useState<ComplimentaryAccess | null>(null);
  const [reflectionCoachMarkSeen, setReflectionCoachMarkSeen] = useState(false);
  const [journeyCoachMarkSeen, setJourneyCoachMarkSeen] = useState(false);
  const [sanctuaryCoachMarkSeen, setSanctuaryCoachMarkSeen] = useState(false);
  const [coachTarget, setCoachTarget] = useState<CoachTarget | null>(null);
  const [coachMarksReady, setCoachMarksReady] = useState(false);
  const [showOnboardingComplete, setShowOnboardingComplete] = useState(false);
  const micCoachTargetRef = useRef<View>(null);
  const journeyCoachTargetRef = useRef<View>(null);
  const sanctuaryCoachTargetRef = useRef<View>(null);
  const purchasesConfiguredRef = useRef(false);
  const revenueCatIdentityUserRef = useRef<string | null>(null);
  const authUserIdRef = useRef<string | null>(null);
  authUserIdRef.current = authUser?.localId ?? null;
  const [revenueCatIdentityUserId, setRevenueCatIdentityUserId] = useState<string | null>(null);
  const [purchasesReady, setPurchasesReady] = useState(false);
  const [purchasesLoading, setPurchasesLoading] = useState(Platform.OS === "ios");
  const [purchaseSetupError, setPurchaseSetupError] = useState(Platform.OS === "ios" ? REVENUECAT_CONFIG_ERROR : "");
  const [storePrices, setStorePrices] = useState<{ monthly: string | null; yearly: string | null }>({
    monthly: null,
    yearly: null,
  });
  const [storeProductIds, setStoreProductIds] = useState<{ monthly: string | null; yearly: string | null }>({
    monthly: null,
    yearly: null,
  });
  const [activeSubscriptionProductId, setActiveSubscriptionProductId] = useState<string | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPurchaseSuccess, setShowPurchaseSuccess] = useState(false);
  const [purchaseSuccessAddedForest, setPurchaseSuccessAddedForest] = useState(false);
  const purchaseSuccessProgress = useRef(new Animated.Value(0)).current;
  const [selectedPlan, setSelectedPlan] = useState<"yearly" | "monthly">("yearly");
  const [showSanctuaryModal, setShowSanctuaryModal] = useState(false);
  const [showAllReflections, setShowAllReflections] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [sanctuaryTheme, setSanctuaryTheme] = useState<SanctuaryThemeKey>("cloud");
  const [draftSanctuaryTheme, setDraftSanctuaryTheme] = useState<SanctuaryThemeKey>("cloud");
  const [showThemePreview, setShowThemePreview] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [sanctuaryDetailTheme, setSanctuaryDetailTheme] = useState<SanctuaryThemeKey>("cloud");
  const [growthNotice, setGrowthNotice] = useState("");
  const [newlyUnlockedSanctuary, setNewlyUnlockedSanctuary] = useState<SanctuaryThemeKey | null>(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const [notificationDraft, setNotificationDraft] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [reminderTimeDraft, setReminderTimeDraft] = useState(() => dateFromReminderTime(DEFAULT_NOTIFICATION_SETTINGS.dailyReminderTime));
  const [storageLoaded, setStorageLoaded] = useState(false);
  const passwordRules = passwordRuleItems(authPassword);
  const passwordStrength = getPasswordStrength(authPassword);

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((raw) => {
      if (!raw) {
        setOnboardingCompleted(false);
        setOnboardingStatus("not_started");
        setCurrentOnboardingStep("firstWeek");
        setStorageLoaded(true);
        return;
      }
      if (raw)
        try {
          const parsed: AppState = JSON.parse(raw);
          setCheckIns((parsed.checkIns || []).filter((entry) => !isDemoCheckIn(entry)));
          // RevenueCat is authoritative on iOS. Persisted premium state may
          // belong to another Firebase account that used this device earlier.
          setPremium(Platform.OS === "ios" ? false : parsed.premium ?? false);
          setCoachUsage(parsed.coachUsage || { dateKey: todayKey(), count: 0 });
          setMoods(parsed.moods || {});
          const storedInsight = parsed.lastDeepInsight?.isDemo ? null : parsed.lastDeepInsight || null;
          const storedWeeklyInsights = (parsed.weeklyInsights || []).filter(
            (insight) => !insight.isDemo && Boolean(insight.weekStart)
          );
          setLastDeepInsight(storedInsight);
          setWeeklyInsights(dedupeMobileWeeklyInsights(storedWeeklyInsights));
          setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...(parsed.notificationSettings || {}) });
          setSanctuaryUnlockNotifications(parsed.sanctuaryUnlockNotifications || {});
          setSeasonalSanctuaryUnlocks(parsed.seasonalSanctuaryUnlocks || {});
          setAuthUser(parsed.authUser || null);
          setAuthEmail(parsed.authUser?.email || "");
          setDisplayName(parsed.displayName || "");
          setOnboardingName(parsed.displayName || "");
          setOnboardingCompleted(parsed.onboardingCompleted ?? true);
          const migratedStatus = parsed.onboardingStatus ?? ((parsed.onboardingCompleted ?? true) ? "completed" : "not_started");
          setOnboardingStatus(migratedStatus);
          const persistedOnboardingStep = parsed.currentOnboardingStep as string | null | undefined;
          const migratedStep = persistedOnboardingStep === "welcome" || persistedOnboardingStep === "name"
            ? "firstWeek"
            : persistedOnboardingStep === "trial"
              ? "freeWeek"
              : parsed.currentOnboardingStep;
          setCurrentOnboardingStep(migratedStep ?? (migratedStatus === "not_started" ? "firstWeek" : parsed.onboardingCoachStep === "mic" ? "reflectionCoach" : null));
          setOnboardingCoachCompleted(parsed.onboardingCoachCompleted ?? false);
          setOnboardingCoachStep(parsed.onboardingCoachStep ?? null);
          setOnboardingSkippedAt(parsed.onboardingSkippedAt ?? null);
          setOnboardingCoachCompletedAt(parsed.onboardingCompletedAt ?? null);
          setReflectionCoachMarkSeen(parsed.reflectionCoachMarkSeen ?? false);
          setJourneyCoachMarkSeen(parsed.journeyCoachMarkSeen ?? false);
          setSanctuaryCoachMarkSeen(parsed.sanctuaryCoachMarkSeen ?? false);
          setComplimentaryAccess(parsed.complimentaryAccess?.isDemo ? null : normalizeComplimentaryAccess(parsed.complimentaryAccess));
          setSanctuaryTheme(parsed.sanctuaryTheme || "cloud");
          setDraftSanctuaryTheme(parsed.sanctuaryTheme || "cloud");
        } catch {}
      setStorageLoaded(true);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("tranqly-response-feedback").then((raw) => {
      if (raw) try { setResponseFeedbackHistory(JSON.parse(raw)); } catch {}
    });
  }, []);

  useEffect(() => {
    setNotificationDraft(notificationSettings);
  }, [notificationSettings]);

  useEffect(() => {
    if (!storageLoaded || new Date().getMonth() !== 11 || seasonalSanctuaryUnlocks.snowfall) return;
    setSeasonalSanctuaryUnlocks((current) => ({
      ...current,
      snowfall: new Date().toISOString(),
    }));
    setNewlyUnlockedSanctuary("snowfall");
  }, [seasonalSanctuaryUnlocks.snowfall, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded || !complimentaryAccess || complimentaryAccess.status !== "active") return;
    const syncAccessStatus = () => {
      const normalized = normalizeComplimentaryAccess(complimentaryAccess);
      if (normalized?.status !== complimentaryAccess.status) {
        setComplimentaryAccess(normalized);
      }
    };
    syncAccessStatus();
    const delay = Math.max(1000, new Date(complimentaryAccess.endsAt).getTime() - Date.now() + 1000);
    const timeout = setTimeout(syncAccessStatus, delay);
    return () => clearTimeout(timeout);
  }, [complimentaryAccess, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    const state: AppState = {
      checkIns,
      premium,
      coachUsage,
      moods,
      lastDeepInsight,
      weeklyInsights,
      notificationSettings,
      sanctuaryUnlockNotifications,
      seasonalSanctuaryUnlocks,
      authUser,
      displayName,
      sanctuaryTheme,
      onboardingCompleted,
      onboardingCoachCompleted,
      onboardingCoachStep,
      onboardingSkippedAt,
      onboardingCompletedAt: onboardingCoachCompletedAt,
      reflectionCoachMarkSeen,
      journeyCoachMarkSeen,
      sanctuaryCoachMarkSeen,
      onboardingStatus,
      currentOnboardingStep,
      onboardingVersion: 2,
      complimentaryAccess: normalizeComplimentaryAccess(complimentaryAccess),
    };
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(state));
  }, [
    checkIns,
    premium,
    coachUsage,
    moods,
    lastDeepInsight,
    weeklyInsights,
    notificationSettings,
    sanctuaryUnlockNotifications,
    seasonalSanctuaryUnlocks,
    authUser,
    displayName,
    sanctuaryTheme,
    onboardingCompleted,
    onboardingCoachCompleted,
    onboardingCoachStep,
    onboardingSkippedAt,
    onboardingCoachCompletedAt,
    reflectionCoachMarkSeen,
    journeyCoachMarkSeen,
    sanctuaryCoachMarkSeen,
    onboardingStatus,
    currentOnboardingStep,
    complimentaryAccess,
    storageLoaded,
  ]);

  useEffect(() => {
    if (!storageLoaded || Platform.OS !== "ios") return;
    if (!REVENUECAT_IOS_API_KEY) {
      setPremium(false);
      setPurchasesReady(false);
      setPurchasesLoading(false);
      setPurchaseSetupError(REVENUECAT_CONFIG_ERROR);
      return;
    }
    if (purchasesConfiguredRef.current) return;
    let cancelled = false;
    const updatePremiumAccess = (customerInfo: CustomerInfo) => {
      if (!cancelled && revenueCatIdentityUserRef.current === authUserIdRef.current) {
        const entitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
        setPremium(Boolean(entitlement));
        setActiveSubscriptionProductId(entitlement?.productIdentifier ?? customerInfo.activeSubscriptions[0] ?? null);
      }
    };

    async function initializePurchases() {
      setPurchasesLoading(true);
      setPurchaseSetupError("");
      try {
        await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
        const alreadyConfigured = await Purchases.isConfigured().catch(() => false);
        if (!alreadyConfigured) {
          Purchases.configure({
            apiKey: REVENUECAT_IOS_API_KEY,
            appUserID: authUserIdRef.current ?? undefined,
          });
        }
        purchasesConfiguredRef.current = true;
        Purchases.addCustomerInfoUpdateListener(updatePremiumAccess);
        const expectedUserId = authUserIdRef.current;
        const currentAppUserId = await Purchases.getAppUserID();
        const customerInfo = expectedUserId && currentAppUserId !== expectedUserId
          ? (await Purchases.logIn(expectedUserId)).customerInfo
          : await Purchases.getCustomerInfo();
        revenueCatIdentityUserRef.current = expectedUserId;
        setRevenueCatIdentityUserId(expectedUserId);
        updatePremiumAccess(customerInfo);
        const offerings = await Purchases.getOfferings();
        const currentOffering = offerings.current;
        if (!currentOffering) {
          throw new Error("RevenueCat has no current offering configured.");
        }
        if (!cancelled) {
          const { monthlyPackage, yearlyPackage } = getValidatedStorePackages(currentOffering);
          setStorePrices({
            monthly: monthlyPackage?.product.priceString ?? null,
            yearly: yearlyPackage?.product.priceString ?? null,
          });
          setStoreProductIds({
            monthly: monthlyPackage?.product.identifier ?? null,
            yearly: yearlyPackage?.product.identifier ?? null,
          });
          setPurchasesReady(true);
        }
      } catch (error) {
        purchasesConfiguredRef.current = false;
        setPurchasesReady(false);
        setPurchaseSetupError("Tranqly could not load App Store plans. Tap Retry App Store.");
        console.warn("RevenueCat initialization failed", error);
        logMobileApiError({
          errorCode: "revenuecat_initialization_failed",
          errorMessage: error instanceof Error ? error.message : "RevenueCat initialization failed",
          featureArea: "purchases",
        });
      } finally {
        if (!cancelled) setPurchasesLoading(false);
      }
    }

    void initializePurchases();
    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(updatePremiumAccess);
    };
  }, [storageLoaded]);

  useEffect(() => {
    if (!storageLoaded || Platform.OS !== "ios" || !purchasesReady || !purchasesConfiguredRef.current) return;
    let cancelled = false;

    async function syncRevenueCatIdentity() {
      try {
        revenueCatIdentityUserRef.current = null;
        setRevenueCatIdentityUserId(null);
        setPremium(false);
        setActiveSubscriptionProductId(null);
        const currentAppUserId = await Purchases.getAppUserID();
        let customerInfo: CustomerInfo | null = null;
        if (authUser?.localId && currentAppUserId !== authUser.localId) {
          customerInfo = (await Purchases.logIn(authUser.localId)).customerInfo;
        } else if (!authUser?.localId && !(await Purchases.isAnonymous())) {
          customerInfo = await Purchases.logOut();
        } else {
          customerInfo = await Purchases.getCustomerInfo();
        }
        revenueCatIdentityUserRef.current = authUser?.localId ?? null;
        setRevenueCatIdentityUserId(authUser?.localId ?? null);
        if (!cancelled && customerInfo) {
          const entitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
          setPremium(Boolean(entitlement));
          setActiveSubscriptionProductId(entitlement?.productIdentifier ?? customerInfo.activeSubscriptions[0] ?? null);
        }
      } catch (error) {
        console.warn("RevenueCat identity sync failed", error);
        logMobileApiError({
          errorCode: "revenuecat_identity_sync_failed",
          errorMessage: error instanceof Error ? error.message : "RevenueCat identity sync failed",
          featureArea: "purchases",
        });
      }
    }

    void syncRevenueCatIdentity();
    return () => {
      cancelled = true;
    };
  }, [authUser?.localId, purchasesReady, storageLoaded]);

  const todayMood = moods[todayKey()] || null;

  async function submitMobileAuth(mode: "signIn" | "signUp") {
    const email = authEmail.trim();
    if (!FIREBASE_API_KEY) {
      Alert.alert(
        "Firebase not configured",
        "Set EXPO_PUBLIC_FIREBASE_API_KEY in apps/mobile/.env, then restart Expo."
      );
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAuthNotice("Please enter a valid email address.");
      return;
    }
    if (mode === "signUp" && !isPasswordValid(authPassword)) {
      setAuthNotice("Your password needs 8 characters, one uppercase letter, one number, and one special character.");
      return;
    }
    if (mode === "signIn" && !authPassword) {
      setAuthNotice("Please enter your password.");
      return;
    }

    setAuthBusy(true);
    setAuthNotice("");
    const endpoint = mode === "signUp" ? "signUp" : "signInWithPassword";
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: authPassword, returnSecureToken: true }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "AUTH_FAILED");
      setAuthUser({
        email: data.email || email,
        localId: data.localId,
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
        providerId: "password",
      });
      setAuthPassword("");
      setShowEmailAuth(false);
      setAuthNotice(mode === "signUp" ? "Account created. This device is linked to your Tranqly account." : "Signed in. This device is linked to your Tranqly account.");
    } catch (error) {
      setAuthNotice(mobileAuthErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendMobilePasswordReset() {
    const email = authEmail.trim();
    if (!FIREBASE_API_KEY) {
      setAuthNotice("Firebase is not configured for this build.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAuthNotice("Please enter a valid email address.");
      return;
    }
    setAuthBusy(true);
    setAuthNotice("");
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "RESET_FAILED");
      setAuthNotice("Password reset email sent.");
    } catch (error) {
      setAuthNotice(mobileAuthErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  function signOutMobile() {
    revenueCatIdentityUserRef.current = null;
    setRevenueCatIdentityUserId(null);
    setPremium(false);
    setActiveSubscriptionProductId(null);
    setAuthUser(null);
    setAuthPassword("");
    setAuthNotice("Signed out on this device.");
  }

  function setTodayMood(m: string) {
    setMoods((prev) => ({ ...prev, [todayKey()]: m }));
  }

  function updateMobileNotificationSettings(
    patch:
      | Partial<NotificationSettings>
      | ((current: NotificationSettings) => NotificationSettings)
  ) {
    setNotificationSettings((current) => {
      const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...next };
    });
  }

  async function saveMobileNotificationSettings() {
    let nextDraft = { ...DEFAULT_NOTIFICATION_SETTINGS, ...notificationDraft };
    if (nextDraft.dailyReminderEnabled && nextDraft.permissionStatus !== "granted") {
      const permission = await requestNotificationPermission();
      nextDraft = {
        ...nextDraft,
        permissionStatus: permission === "granted" ? "granted" : "denied",
        dailyReminderEnabled: permission === "granted" ? nextDraft.dailyReminderEnabled : false,
      };
    }
    updateMobileNotificationSettings(nextDraft);
    setNotificationsExpanded(false);
  }

  async function requestNotificationPermission() {
    const existing = await Notifications.getPermissionsAsync();
    if (notificationPermissionState(existing) === "granted") {
      updateMobileNotificationSettings({ permissionStatus: "granted", notificationPromptShown: true });
      return "granted" as const;
    }
    const next = await Notifications.requestPermissionsAsync();
    const granted = notificationPermissionState(next) === "granted";
    updateMobileNotificationSettings({
      permissionStatus: granted ? "granted" : "denied",
      notificationPromptShown: true,
    });
    return granted ? ("granted" as const) : ("denied" as const);
  }

  async function scheduleReminderNotifications(settings = notificationSettings) {
    if (Platform.OS === "web") return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (settings.pauseReminders || settings.permissionStatus !== "granted") return;

    if (settings.dailyReminderEnabled) {
      const cadenceDays = dailyReminderCadenceDays(settings);
      const nextTime = adjustedTimeForQuietHours(settings.dailyReminderTime, settings);
      const { hours, minutes } = (() => {
        const [h = "19", m = "30"] = nextTime.split(":");
        return { hours: Number(h), minutes: Number(m) };
      })();
      if (cadenceDays === 1) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Your sanctuary is waiting.",
            body: "Take one quiet minute for yourself today.",
            data: { route: "coach", kind: "daily_reflection" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: hours,
            minute: minutes,
            repeats: true,
          },
        });
      } else {
        const first = new Date();
        first.setHours(hours, minutes, 0, 0);
        if (first <= new Date()) first.setDate(first.getDate() + cadenceDays);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Your next reflection is ready when you are.",
            body: "What’s one thing you want to remember about today?",
            data: { route: "coach", kind: "daily_reflection" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(60, Math.floor((first.getTime() - Date.now()) / 1000)),
            repeats: false,
          },
        });
      }
    }

    if (settings.weeklyInsightEnabled) {
      const nextTime = adjustedTimeForQuietHours(settings.weeklyInsightTime, settings);
      const [hours = "19", minutes = "00"] = nextTime.split(":");
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Your weekly reflection is ready.",
          body: "See what Tranqly noticed this week.",
          data: { route: "journey", kind: "weekly_insight" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          weekday: 1,
          hour: Number(hours),
          minute: Number(minutes),
          repeats: true,
        },
      });
    }
  }

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const compactWidth = screenWidth < 390;
  const densityMode: "compact" | "regular" | "comfortable" = screenHeight < 650 ? "compact" : screenHeight <= 780 ? "regular" : "comfortable";
  const shortLayout = densityMode === "compact";
  const micDiameter = densityMode === "compact" ? 104 : densityMode === "regular" ? 126 : 146;
  const initialOnboardingOpen = !onboardingCompleted &&
    (currentOnboardingStep === "firstWeek" || currentOnboardingStep === "freeWeek" || currentOnboardingStep === "trial");
  const activeCoachStep = onboardingStatus === "in_progress" &&
    (currentOnboardingStep === "reflectionCoach" || currentOnboardingStep === "journeyCoach" || currentOnboardingStep === "sanctuaryCoach")
    ? currentOnboardingStep
    : null;
  const onboardingCardHeight = Math.min(
    Math.max(screenHeight * 0.78, Math.min(640, screenHeight - 28)),
    screenHeight - 28
  );

  function measureCoachTarget() {
    if (!activeCoachStep) return;
    const ref = activeCoachStep === "reflectionCoach"
      ? micCoachTargetRef
      : activeCoachStep === "journeyCoach"
        ? journeyCoachTargetRef
        : sanctuaryCoachTargetRef;
    requestAnimationFrame(() => {
      const node = ref.current as unknown as {
        getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
        measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
      } | null;
      const saveTarget = (x: number, y: number, width: number, height: number) => {
        if (!width || !height) return;
        setCoachTarget({ x, y, width, height, centerX: x + width / 2, centerY: y + height / 2 });
      };
      if (Platform.OS === "web" && node?.getBoundingClientRect) {
        const rect = node.getBoundingClientRect();
        saveTarget(rect.left, rect.top, rect.width, rect.height);
        return;
      }
      node?.measureInWindow?.(saveTarget);
    });
  }

  useEffect(() => {
    if (!activeCoachStep) {
      setCoachTarget(null);
      setCoachMarksReady(false);
      return;
    }
    setCoachTarget(null);
    setCoachMarksReady(false);
    const measureTimer = setTimeout(measureCoachTarget, 80);
    const revealTimer = setTimeout(() => setCoachMarksReady(true), 260);
    return () => {
      clearTimeout(measureTimer);
      clearTimeout(revealTimer);
    };
  }, [activeCoachStep, screenHeight, screenWidth]);

  const coachCardHeight = activeCoachStep === "reflectionCoach" ? 166 : 154;
  const coachCardTop = activeCoachStep === "reflectionCoach"
    ? Math.min(screenHeight - coachCardHeight - 104, Math.max(18, screenHeight * 0.58))
    : coachTarget
      ? Math.max(18, Math.min(screenHeight - coachCardHeight - 18, coachTarget.y - coachCardHeight - 12))
      : Math.max(18, screenHeight - coachCardHeight - 132);
  const coachPointerStartY = activeCoachStep === "reflectionCoach" ? coachCardTop : coachCardTop + coachCardHeight;
  const micPulse = useRef(new Animated.Value(1)).current;
  const firstWeekCardAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const recordingStoppingRef = useRef(false);
  const recordingStartingRef = useRef(false);
  const notificationPromptAfterInsightRef = useRef(false);
  const promptSelection = selectMobilePrompt(checkIns, sanctuaryTheme, moods[todayKey()] || null, promptOffset);
  const dailyPrompt = promptSelection.prompt;

  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.getPermissionsAsync().then((permission) => {
      const status = notificationPermissionState(permission);
      setNotificationSettings((current) => ({
        ...current,
        permissionStatus: status === "unknown" ? current.permissionStatus : status,
      }));
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = String(response.notification.request.content.data?.route || "");
      updateMobileNotificationSettings({ lastReminderOpenedAt: new Date().toISOString() });
      if (route === "coach") {
        setTab("coach");
      } else if (route === "journey") {
        setTab("journey");
      } else if (route === "sanctuary") {
        setTab("you");
        setShowThemePicker(true);
      }
    });
    return () => responseSub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    void scheduleReminderNotifications(notificationSettings);
  }, [notificationSettings]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(micPulse, {
          toValue: 1.12,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(micPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [micPulse]);

  useEffect(() => {
    if (!recording) {
      setVoiceElapsed(0);
      return;
    }

    setVoiceElapsed(0);
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.min(
        VOICE_LIMIT_SECONDS,
        Math.floor((Date.now() - startedAt) / 1000)
      );
      setVoiceElapsed(elapsed);
      if (elapsed >= VOICE_LIMIT_SECONDS) {
        void stopRecording(recording);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [recording]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setComposerError("");
    if (needsWeekTwo) {
      promptWeekTwoContinuation();
      return;
    }
    if (!API_BASE_URL) {
      Alert.alert(
        "Server not configured",
        "Set EXPO_PUBLIC_API_BASE_URL to your Tranqly web server URL, then restart Expo."
      );
      return;
    }
    Keyboard.dismiss();

    const entry: CheckIn = {
      id: Date.now().toString(),
      text: trimmed,
      createdAt: new Date().toISOString(),
      dateKey: todayKey(),
      source: reflectionSource,
      prompt: dailyPrompt,
      promptType: promptSelection.promptType,
      promptWhy: promptSelection.whyThisQuestion,
    };

    const previousReflectionDays = qualifyingReflectionDays(checkIns);
    const nextReflectionDays = qualifyingReflectionDays([entry, ...checkIns]);
    const notice = growthNoticeFor(previousReflectionDays, nextReflectionDays);
    if (notice) {
      setGrowthNotice(`Your sanctuary has grown. ${notice}`);
      setTimeout(() => setGrowthNotice(""), 4500);
    }
    setCheckIns((prev) => [entry, ...prev]);
    updateMobileNotificationSettings((current) => updateReflectionTiming(current, entry.createdAt, checkIns));
    if (
      checkIns.length === 0 &&
      notificationSettings.permissionStatus === "unknown" &&
      !notificationSettings.notificationPromptShown
    ) {
      notificationPromptAfterInsightRef.current = true;
    }
    const unlockedTheme = sanctuaryThemesByUnlock().find(
      (theme) =>
        theme.unlockType === "reflections" &&
        previousReflectionDays < theme.unlockDays &&
        nextReflectionDays >= theme.unlockDays
    );
    if (unlockedTheme) {
      setNewlyUnlockedSanctuary(unlockedTheme.key);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (
      unlockedTheme &&
      notificationSettings.sanctuaryUnlockEnabled &&
      notificationSettings.permissionStatus === "granted" &&
      !sanctuaryUnlockNotifications[unlockedTheme.key]
    ) {
      setTimeout(() => {
        void Notifications.scheduleNotificationAsync({
          content: {
            title: `${unlockedTheme.label} is ready.`,
            body: "Explore your new sanctuary.",
            data: { route: "sanctuary", kind: "sanctuary_unlock", themeId: unlockedTheme.key },
          },
          trigger: null,
        });
      }, 600);
      setSanctuaryUnlockNotifications((current) => ({
        ...current,
        [unlockedTheme.key]: new Date().toISOString(),
      }));
    }
    setText("");
    setShowTranscriptPreview(false);
    setReflectionSource("typed");

    const todayUsage = coachUsage.dateKey === todayKey() ? coachUsage : { dateKey: todayKey(), count: 0 };
    if (!effectivePremium && todayUsage.count >= FREE_AI_INSIGHTS_PER_DAY) {
      Alert.alert(
        "Reflection saved",
        "Your reflection was saved. Continue your journey when you are ready for more Tranqly insights."
      );
      setShowPremiumModal(true);
      return;
    }

    setCoachUsage(
      todayUsage.dateKey === todayKey()
        ? { ...todayUsage, count: todayUsage.count + 1 }
        : { dateKey: todayKey(), count: 1 }
    );
    setPending(true);

    try {
      const coachStartedAt = Date.now();
      const mobileMemorySummary = [
        topThemeSummary(checkIns),
        topStruggleSummary(checkIns),
        `You reflect most often in the ${reflectionTimeSummary(checkIns)}.`,
      ].filter(Boolean);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), COACH_TIMEOUT_MS);
      console.info("Posting coach request to", `${API_BASE_URL}/api/coach`);
      const res = await fetch(`${API_BASE_URL}/api/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          entry: trimmed,
          text: trimmed,
          name: displayName.trim() || undefined,
          mood: todayMood,
          streak,
          prompt: dailyPrompt,
          promptType: promptSelection.promptType,
          promptWhy: promptSelection.whyThisQuestion,
          memoryProfileSummary: mobileMemorySummary,
          recentPromptHistory: checkIns
            .slice(0, 10)
            .map((c) => ({ prompt: c.prompt, promptType: c.promptType, promptWhy: c.promptWhy }))
            .filter((item) => item.prompt),
          recentHelpfulFeedback: responseFeedbackHistory.slice(0, 5),
          currentSanctuary: sanctuaryTheme,
          userPlan: effectivePremium ? "plus" : "free",
          history: checkIns,
          recentEntries: checkIns.slice(0, 10).map((c) => ({
            text: c.text,
            dateKey: c.dateKey,
            previousInsight: c.reply?.message,
            tags: c.reply?.tags ?? c.reply?.themes,
          })),
        }),
      });
      clearTimeout(timeout);
      console.info("Coach response status", res.status);
      if (res.ok) {
        const data = await res.json();
        console.info("Coach response payload", {
          requestId: data.requestId,
          fallback: data.fallback,
          blocked: data.blocked,
          source: data.source,
          error: data.error,
          failureReason: data.failureReason,
          title: data.title,
        });
        const serverFallback = Boolean(data.fallback || data.source === "local" || data.error === "ai_unavailable");
        if (serverFallback) {
          logMobileApiError({
            requestId: typeof data.requestId === "string" ? data.requestId : undefined,
            errorCode: "mobile_coach_fallback",
            errorMessage: "Server returned fallback signal for coach insight.",
            featureArea: "coach",
            statusCode: res.status,
            durationMs: Date.now() - coachStartedAt,
            route: "/api/coach",
          });
        }
        entry.reply = serverFallback
          ? safeLocalCoachReply(trimmed)
          : {
              message: data.message || "",
              nextStep: data.nextStep || "",
              title: data.title,
              preview: data.preview,
              nudgeLabel: data.nudgeLabel,
              pattern: data.pattern,
              summary: data.summary,
              themes: data.themes,
              tags: data.tags,
              emotionalTone: data.emotionalTone,
              followUpQuestions: data.followUpQuestions,
              source: "ai",
              createdAt: new Date().toISOString(),
            };
      } else {
        console.warn("Coach request returned non-ok status", res.status);
        logMobileApiError({
          errorCode: "mobile_coach_non_ok",
          errorMessage: `Coach request returned status ${res.status}.`,
          featureArea: "coach",
          statusCode: res.status,
          durationMs: Date.now() - coachStartedAt,
          route: "/api/coach",
        });
        entry.reply = safeLocalCoachReply(trimmed);
      }
    } catch (err) {
      console.warn("Coach request failed", err);
      logMobileApiError({
        errorCode: "mobile_coach_request_failed",
        errorMessage: err instanceof Error ? err.message : "Coach request failed.",
        featureArea: "coach",
        durationMs: undefined,
        route: "/api/coach",
      });
      setComposerError("Insight took too long. Your reflection was saved, try again in a moment.");
      setTimeout(() => setComposerError(""), 5000);
      entry.reply = safeLocalCoachReply(trimmed);
    }

    if (entry.reply) {
      setCoachModal({ text: entry.text, reply: entry.reply });
    }

    const di: DeepInsight = localDeepInsight(trimmed);
    setLastDeepInsight(di);

    setCheckIns((prev) => prev.map((c) => c.id === entry.id ? entry : c));
    setPending(false);
  }

  function closeCoachResponse() {
    setCoachModal(null);
    if (!notificationPromptAfterInsightRef.current) return;
    notificationPromptAfterInsightRef.current = false;
    setTimeout(() => setShowNotificationPrompt(true), 350);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, CheckIn[]>();
    for (const c of checkIns) {
      if (!map.has(c.dateKey)) map.set(c.dateKey, []);
      map.get(c.dateKey)!.push(c);
    }
    const sorted = Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
    return sorted.map(([dateKey, entries]) => ({ dateKey, entries }));
  }, [checkIns]);
  const recentJourneyGroups = useMemo(() => {
    if (showAllReflections) return grouped;
    let remaining = 5;
    const groups: { dateKey: string; entries: CheckIn[] }[] = [];
    for (const group of grouped) {
      if (remaining <= 0) break;
      const entries = group.entries.slice(0, remaining);
      if (entries.length) {
        groups.push({ dateKey: group.dateKey, entries });
        remaining -= entries.length;
      }
    }
    return groups;
  }, [grouped, showAllReflections]);

  const today = todayKey();
  const effectivePremium = hasTranqlyAccess(premium, complimentaryAccess);
  const activePaidPlan = useMemo<"monthly" | "yearly" | "plus" | "free">(() => {
    if (!premium) return "free";
    if (activeSubscriptionProductId && activeSubscriptionProductId === storeProductIds.yearly) return "yearly";
    if (activeSubscriptionProductId && activeSubscriptionProductId === storeProductIds.monthly) return "monthly";
    if (/year|annual/i.test(activeSubscriptionProductId ?? "")) return "yearly";
    if (/month/i.test(activeSubscriptionProductId ?? "")) return "monthly";
    return "plus";
  }, [activeSubscriptionProductId, premium, storeProductIds.monthly, storeProductIds.yearly]);
  const subscriptionStatusLabel = premium
    ? activePaidPlan === "monthly"
      ? "Monthly"
      : activePaidPlan === "yearly"
        ? "Yearly"
        : "Active"
    : complimentaryAccess?.status === "active"
      ? "First Week"
      : "Free";
  const weekCheckInCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    return new Set(
      checkIns
        .filter((c) => c.dateKey >= startKey && c.dateKey <= todayKey())
        .map((c) => c.dateKey)
    ).size;
  }, [checkIns]);

  useEffect(() => {
    if (!storageLoaded || !API_BASE_URL || checkIns.length === 0) return;
    const normalizedAccess = normalizeComplimentaryAccess(complimentaryAccess);
    const firstWeekNeedsReflection = Boolean(
      normalizedAccess &&
        normalizedAccess.status !== "active" &&
        !normalizedAccess.weeklyReflectionDeliveredAt
    );
    if (!effectivePremium && !firstWeekNeedsReflection) return;
    const period = firstWeekNeedsReflection && normalizedAccess
      ? {
          start: new Date(normalizedAccess.startedAt),
          end: new Date(normalizedAccess.endsAt),
          startKey: todayKeyFromDate(new Date(normalizedAccess.startedAt)),
          endKey: todayKeyFromDate(new Date(normalizedAccess.endsAt)),
        }
      : latestCompletedWeeklyPeriod();
    if (weeklyInsights.some((insight) => insight.weekStart === period.startKey)) return;
    if (weeklyGenerationKeyRef.current === period.startKey) return;
    const periodEntries = checkIns.filter(
      (entry) => entry.dateKey >= period.startKey && entry.dateKey <= period.endKey
    );
    const reflectionDays = new Set(periodEntries.map((entry) => entry.dateKey)).size;
    if (reflectionDays < 3) return;

    weeklyGenerationKeyRef.current = period.startKey;
    setWeeklyGenerating(true);
    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: displayName.trim() || undefined,
            streak: currentStreak(checkIns),
            totalEntries: checkIns.length,
            recentEntries: periodEntries.slice(0, 14).map((entry) => ({
              text: entry.text,
              dateKey: entry.dateKey,
              prompt: entry.prompt,
              dailyInsight: entry.reply?.message,
            })),
            recentMoods: Object.entries(moods)
              .filter(([dateKey]) => dateKey >= period.startKey && dateKey <= period.endKey)
              .map(([dateKey, mood]) => ({ dateKey, mood })),
            periodStart: period.startKey,
            periodEnd: period.endKey,
            reflectionDays,
            userId: authUser?.localId,
            userPlan: effectivePremium ? "plus" : "free",
          }),
        });
        const data = await response.json();
        if (!response.ok || data.fallback || !data.insight) {
          throw new Error(data.error || "Weekly reflection was not available yet.");
        }
        const insight: DeepInsight = {
          headline: data.headline || "Your week in reflection",
          insight: data.insight,
          suggestion: data.suggestion || data.next_focus || "Carry one small steadying moment into the week ahead.",
          affirmation: data.affirmation || "A few honest reflections can still reveal something worth noticing.",
          createdAt: new Date().toISOString(),
          weekStart: period.startKey,
          weekEnd: period.endKey,
          gentleFocusTitle: data.gentleFocusTitle || "Next gentle focus",
          evidenceLevel: data.evidenceLevel,
          completionMessage: data.completionMessage,
          reflectionDays,
          reflectionCount: periodEntries.length,
          rewardUnlocked: false,
          rewardId: undefined,
        };
        setWeeklyInsights((current) => dedupeMobileWeeklyInsights([insight, ...current]));
        if (firstWeekNeedsReflection) {
          setComplimentaryAccess((current) => current ? {
            ...current,
            weeklyReflectionDeliveredAt: new Date().toISOString(),
          } : current);
        }
      } catch (error) {
        weeklyGenerationKeyRef.current = null;
        if (__DEV__) console.warn("Weekly reflection generation failed", error);
      } finally {
        setWeeklyGenerating(false);
      }
    })();
  }, [
    authUser?.localId,
    checkIns,
    complimentaryAccess,
    displayName,
    effectivePremium,
    moods,
    storageLoaded,
    weeklyInsights,
  ]);
  const monthStats = useMemo(() => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthEntries = checkIns.filter((c) => c.dateKey.startsWith(monthPrefix));
    const uniqueDays = new Set(monthEntries.map((c) => c.dateKey)).size;
    const allText = monthEntries.map((c) => c.text).join(" ").toLowerCase();
    const calmHits = (allText.match(/calm|peace|slow|quiet|rest|outside|walk/g) ?? []).length;
    const gratitudeHits = (allText.match(/grateful|thankful|appreciate|good|happy|love/g) ?? []).length;
    const stressHits = (allText.match(/stress|busy|overwhelm|tired|anxious|hard/g) ?? []).length;

    return {
      calm: calmHits >= stressHits ? "Up" : "Building",
      consistency: `${uniqueDays} days`,
      gratitude: gratitudeHits > 2 ? "High" : gratitudeHits > 0 ? "Growing" : "Starting",
      stress: stressHits > calmHits ? "Worth watching" : "Lower than last week",
    };
  }, [checkIns]);
  const journeyMemory = useMemo(() => buildMobileJourney(checkIns), [checkIns]);

  function formatDate(dateKey: string) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function openCoachModal(entryText: string, reply: CoachReply) {
    setResponseFeedbackOpen(false);
    setCoachModal({ text: entryText, reply });
  }

  function saveMobileResponseFeedback(helpful: boolean, reason?: string) {
    const next = [{ helpful, reason, detail: responseFeedbackText.trim() || undefined, createdAt: new Date().toISOString() }, ...responseFeedbackHistory].slice(0, 100);
    setResponseFeedbackHistory(next);
    void AsyncStorage.setItem("tranqly-response-feedback", JSON.stringify(next));
  }

  function deleteCheckIn(id: string) {
    setCheckIns((prev) => prev.filter((c) => c.id !== id));
  }

  function openPremium() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowPremiumModal(true);
  }

  async function validMobileAuthUser() {
    if (!authUser) throw new Error("Sign in before contacting support.");
    if (authUser.expiresAt > Date.now() + 60_000) return authUser;
    if (!FIREBASE_API_KEY || !authUser.refreshToken) {
      throw new Error("Your sign-in expired. Sign in again to continue.");
    }

    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(authUser.refreshToken)}`,
      }
    );
    const data = await response.json();
    if (!response.ok || !data.id_token) {
      setAuthUser(null);
      throw new Error("Your sign-in expired. Sign in again to continue.");
    }
    const refreshed: MobileAuthUser = {
      ...authUser,
      localId: data.user_id || authUser.localId,
      idToken: data.id_token,
      refreshToken: data.refresh_token || authUser.refreshToken,
      expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    };
    setAuthUser(refreshed);
    return refreshed;
  }

  async function submitMobileSupportTicket() {
    Keyboard.dismiss();
    setSupportNotice("");
    if (!authUser) {
      setSupportNotice("Sign in above before submitting a support ticket.");
      return;
    }
    if (!supportSubject.trim() || !supportMessage.trim()) {
      setSupportNotice("Add a subject and message before submitting.");
      return;
    }
    if (!FIREBASE_PROJECT_ID) {
      setSupportNotice("Support is not configured in this build. Email support@tranqly.com instead.");
      return;
    }

    setSupportBusy(true);
    try {
      const user = await validMobileAuthUser();
      await createMobileSupportTicket(
        { projectId: FIREBASE_PROJECT_ID, idToken: user.idToken },
        {
          uid: user.localId,
          email: user.email,
          subject: supportSubject,
          message: supportMessage,
          category: supportCategory,
          appVersion: Constants.expoConfig?.version || "1.0.0",
          osVersion: String(Platform.Version),
        }
      );
      setSupportSubject("");
      setSupportMessage("");
      setSupportNotice("Ticket submitted. You can follow up at support@tranqly.com.");
      setSupportExpanded(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not submit the ticket.";
      setSupportNotice(message);
      logMobileApiError({
        errorCode: "support_ticket_failed",
        errorMessage: message,
        featureArea: "support",
      });
    } finally {
      setSupportBusy(false);
    }
  }

  function applyFirebaseAuthResult(
    data: Record<string, any>,
    providerId: "apple.com" | "google.com",
    fallbackEmail = ""
  ) {
    const user: MobileAuthUser = {
      email: data.email || fallbackEmail || "Connected account",
      localId: data.localId,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
      providerId,
    };
    setAuthUser(user);
    setAuthEmail(data.email || fallbackEmail || "");
    setShowEmailAuth(false);
    setAuthNotice("Signed in. This device is linked to your Tranqly account.");
  }

  async function signInWithFirebaseProvider(
    providerId: "apple.com" | "google.com",
    idToken: string | undefined,
    options?: { accessToken?: string; nonce?: string; fallbackEmail?: string }
  ) {
    if (!FIREBASE_API_KEY) throw new Error("Firebase is not configured for this build.");
    if (providerId === "google.com" && GOOGLE_CLIENT_PROJECT_MISMATCH) {
      throw new Error("GOOGLE_CLIENT_PROJECT_MISMATCH");
    }
    const hasIdToken = Boolean(idToken);
    const hasGoogleAccessToken = providerId === "google.com" && Boolean(options?.accessToken);
    if (!hasIdToken && !hasGoogleAccessToken) throw new Error("INVALID_CREDENTIAL");
    const parameters = [
      idToken ? `id_token=${encodeURIComponent(idToken)}` : "",
      hasGoogleAccessToken && options?.accessToken ? `access_token=${encodeURIComponent(options.accessToken)}` : "",
      options?.nonce ? `nonce=${encodeURIComponent(options.nonce)}` : "",
      `providerId=${encodeURIComponent(providerId)}`,
    ].filter(Boolean);
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestUri: "http://localhost",
          postBody: parameters.join("&"),
          returnIdpCredential: true,
          returnSecureToken: true,
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      const errorCode = data?.error?.message || "FEDERATED_AUTH_FAILED";
      console.warn("Firebase provider sign-in failed", {
        providerId,
        status: response.status,
        errorCode,
      });
      logMobileApiError({
        errorCode: "federated_auth_failed",
        errorMessage: errorCode,
        featureArea: "auth",
        statusCode: response.status,
        route: "firebase/accounts:signInWithIdp",
        metadata: {
          providerId,
          credentialType: hasIdToken && hasGoogleAccessToken ? "id_token_and_access_token" : hasIdToken ? "id_token" : "access_token",
        },
      });
      throw new Error(errorCode);
    }
    console.info("Firebase provider sign-in succeeded", {
      providerId,
      localId: Boolean(data.localId),
      email: Boolean(data.email),
    });
    applyFirebaseAuthResult(data, providerId, options?.fallbackEmail);
  }

  async function signInWithApple() {
    setAuthBusy(true);
    setAuthNotice("");
    try {
      if (!(await AppleAuthentication.isAvailableAsync())) {
        throw new Error("Apple Sign In is not available on this device.");
      }
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error("Apple did not return a valid sign-in token.");
      await signInWithFirebaseProvider("apple.com", credential.identityToken, {
        nonce: rawNonce,
        fallbackEmail: credential.email || "Apple account",
      });
      const appleName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ").trim();
      if (appleName && !displayName.trim()) setDisplayName(appleName);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "ERR_REQUEST_CANCELED") {
        console.warn("Apple sign-in failed", { code, message: error instanceof Error ? error.message : String(error) });
        setAuthNotice(mobileAuthErrorMessage(error));
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function signInWithGoogleCredential(idToken?: string, accessToken?: string) {
    setAuthBusy(true);
    setAuthNotice("");
    try {
      await signInWithFirebaseProvider("google.com", idToken, { accessToken });
    } catch (error) {
      console.warn("Google sign-in failed", { message: error instanceof Error ? error.message : String(error) });
      setAuthNotice(mobileAuthErrorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  function pressBottomTab(nextTab: Tab) {
    if (nextTab === tab) return;
    const order: Tab[] = ["coach", "journey", "you"];
    const direction = order.indexOf(nextTab) > order.indexOf(tab) ? 1 : -1;
    void Haptics.selectionAsync();
    tabSlide.setValue(direction * 26);
    tabOpacity.setValue(0.92);
    setTab(nextTab);
    Animated.parallel([
      Animated.timing(tabSlide, {
        toValue: 0,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(tabOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }

  function skipOnboarding() {
    const now = new Date().toISOString();
    Keyboard.dismiss();
    setShowOnboardingComplete(false);
    setDisplayName(onboardingName.trim());
    setOnboardingCompleted(true);
    setOnboardingStatus("skipped");
    setCurrentOnboardingStep(null);
    setOnboardingCoachCompleted(true);
    setOnboardingCoachStep(null);
    setReflectionCoachMarkSeen(true);
    setJourneyCoachMarkSeen(true);
    setSanctuaryCoachMarkSeen(true);
    setOnboardingSkippedAt(now);
    setOnboardingCoachCompletedAt(now);
    setComplimentaryAccess((current) => current ?? createFirstWeekAccess());
    setTab("coach");
  }

  function nextCoachMark() {
    setCoachTarget(null);
    setCoachMarksReady(false);
    if (currentOnboardingStep === "reflectionCoach") {
      setReflectionCoachMarkSeen(true);
      setCurrentOnboardingStep("journeyCoach");
      return;
    }
    if (currentOnboardingStep === "journeyCoach") {
      setJourneyCoachMarkSeen(true);
      setCurrentOnboardingStep("sanctuaryCoach");
      return;
    }
    const now = new Date().toISOString();
    setSanctuaryCoachMarkSeen(true);
    setOnboardingStatus("completed");
    setCurrentOnboardingStep(null);
    setOnboardingCoachCompleted(true);
    setOnboardingCoachCompletedAt(now);
    setComplimentaryAccess((current) => current ?? createFirstWeekAccess());
    setShowOnboardingComplete(true);
  }

  function completeInitialOnboarding() {
    Keyboard.dismiss();
    setDisplayName(onboardingName.trim());
    setOnboardingCompleted(true);
    setOnboardingStatus("in_progress");
    setCurrentOnboardingStep("reflectionCoach");
    setOnboardingCoachCompleted(false);
    setOnboardingCoachStep(null);
    setReflectionCoachMarkSeen(false);
    setJourneyCoachMarkSeen(false);
    setSanctuaryCoachMarkSeen(false);
    setOnboardingSkippedAt(null);
    setOnboardingCoachCompletedAt(null);
    setTab("coach");
  }

  function moveInitialOnboarding(next: "firstWeek" | "freeWeek") {
    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOnboardingStatus("in_progress");
    setCurrentOnboardingStep(next);
  }

  async function refreshAppStorePlans() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS !== "ios" || !REVENUECAT_IOS_API_KEY) {
      setPurchasesReady(false);
      setPurchaseSetupError(REVENUECAT_CONFIG_ERROR || "App Store billing is not configured in this build.");
      Alert.alert(
        "App Store plans unavailable",
        REVENUECAT_CONFIG_ERROR || "App Store billing is not configured in this build."
      );
      return;
    }
    setPurchasesLoading(true);
    setPurchaseSetupError("");
    try {
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
      const alreadyConfigured = await Purchases.isConfigured().catch(() => false);
      if (!alreadyConfigured) Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY });
      purchasesConfiguredRef.current = true;
      const customerInfo = await Purchases.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
      setPremium(Boolean(entitlement));
      setActiveSubscriptionProductId(entitlement?.productIdentifier ?? customerInfo.activeSubscriptions[0] ?? null);
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      if (!currentOffering) throw new Error("RevenueCat has no current offering configured.");
      const { monthlyPackage, yearlyPackage } = getValidatedStorePackages(currentOffering);
      setStorePrices({
        monthly: monthlyPackage.product.priceString,
        yearly: yearlyPackage.product.priceString,
      });
      setStoreProductIds({
        monthly: monthlyPackage.product.identifier,
        yearly: yearlyPackage.product.identifier,
      });
      setPurchasesReady(true);
    } catch (error) {
      setPurchasesReady(false);
      setPurchaseSetupError("Tranqly could not load App Store plans. Tap Retry App Store.");
      console.warn("RevenueCat plan refresh failed", error);
      logMobileApiError({
        errorCode: "revenuecat_plan_refresh_failed",
        errorMessage: error instanceof Error ? error.message : "RevenueCat plan refresh failed",
        featureArea: "purchases",
      });
    } finally {
      setPurchasesLoading(false);
    }
  }

  async function startCheckout(planOverride?: "monthly" | "yearly") {
    const checkoutPlan = planOverride ?? selectedPlan;
    const wasPremium = premium;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "ios") {
      if (!REVENUECAT_IOS_API_KEY || !purchasesConfiguredRef.current || !purchasesReady) {
        Alert.alert(
          "Purchases unavailable",
          "App Store purchases are not configured for this build yet."
        );
        return;
      }
      setCheckoutBusy(true);
      try {
        const offerings = await Purchases.getOfferings();
        const currentOffering = offerings.current;
        if (currentOffering) {
          const { monthlyPackage, yearlyPackage } = getValidatedStorePackages(currentOffering);
          setStorePrices({
            monthly: monthlyPackage.product.priceString,
            yearly: yearlyPackage.product.priceString,
          });
          setStoreProductIds({
            monthly: monthlyPackage.product.identifier,
            yearly: yearlyPackage.product.identifier,
          });
        }
        const validatedPackages = currentOffering ? getValidatedStorePackages(currentOffering) : null;
        const planPackage = checkoutPlan === "yearly"
          ? validatedPackages?.yearlyPackage
          : validatedPackages?.monthlyPackage;
        if (!planPackage) {
          Alert.alert("Checkout unavailable", "Tranqly Plus is not available in this build yet.");
          return;
        }
        const result = await Purchases.purchasePackage(planPackage);
        const activeEntitlement = result.customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
        const plusActive = Boolean(activeEntitlement);
        if (!plusActive) {
          Alert.alert("Purchase not activated", "The App Store did not activate Tranqly Plus. Please try again.");
          return;
        }
        setPremium(true);
        setActiveSubscriptionProductId(activeEntitlement?.productIdentifier ?? result.customerInfo.activeSubscriptions[0] ?? planPackage.product.identifier);
        setShowPremiumModal(false);
        if (wasPremium) {
          Alert.alert(
            "Plan updated",
            "The App Store confirmed your Tranqly Plus plan change. Apple will show when the new billing period begins."
          );
        } else {
          const shouldEnterForest = sanctuaryTheme !== "forest";
          if (shouldEnterForest) {
            setSanctuaryTheme("forest");
            setDraftSanctuaryTheme("forest");
          }
          setPurchaseSuccessAddedForest(shouldEnterForest);
          setTab("coach");
          setShowPurchaseSuccess(true);
        }
        return;
      } catch (error) {
        const purchaseError = error as { userCancelled?: boolean; message?: string };
        if (!purchaseError.userCancelled) {
          console.warn("RevenueCat purchase failed", error);
          Alert.alert("Checkout unavailable", "Checkout could not start. Please try again.");
        }
        return;
      } finally {
        setCheckoutBusy(false);
      }
    }
    if (!API_BASE_URL) {
      Alert.alert(
        "Checkout unavailable",
        "Set EXPO_PUBLIC_API_BASE_URL to your Tranqly web server URL, then restart Expo."
      );
      return;
    }
    setCheckoutBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: checkoutPlan }),
      });
      const data = await res.json();
      if (data.url) {
        await Linking.openURL(data.url);
        return;
      }
      Alert.alert("Checkout unavailable", "Checkout could not start. Please try again.");
    } catch {
      Alert.alert("Checkout unavailable", "Checkout could not start. Please try again.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function restoreAppStorePurchases() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS !== "ios" || !REVENUECAT_IOS_API_KEY || !purchasesConfiguredRef.current || !purchasesReady) {
      Alert.alert("Restore unavailable", "App Store purchases are not configured for this build yet.");
      return;
    }
    setCheckoutBusy(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const activeEntitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
      const plusActive = Boolean(activeEntitlement);
      setPremium(plusActive);
      setActiveSubscriptionProductId(activeEntitlement?.productIdentifier ?? customerInfo.activeSubscriptions[0] ?? null);
      if (plusActive) {
        setShowPremiumModal(false);
        Alert.alert("Purchase restored", "Tranqly Plus is active again.");
      } else {
        Alert.alert("No purchase found", "No active Tranqly Plus purchase was found for this App Store account.");
      }
    } catch (error) {
      console.warn("RevenueCat restore failed", error);
      Alert.alert("Restore unavailable", "Tranqly could not restore purchases. Please try again.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function manageAppStoreSubscription() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS !== "ios" || !REVENUECAT_IOS_API_KEY || !purchasesConfiguredRef.current) {
      Alert.alert("Subscription management unavailable", "Open your App Store subscriptions to manage Tranqly Plus.");
      return;
    }
    try {
      await Purchases.showManageSubscriptions();
    } catch (error) {
      console.warn("RevenueCat subscription management failed", error);
      Alert.alert("Could not open subscriptions", "Open Settings, tap your Apple Account, then Subscriptions to manage Tranqly Plus.");
    }
  }

  function CoachFace({ size = 44 }: { size?: number }) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#1E2938",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: "#263142",
        }}
      >
        <Text style={{ fontSize: size * 0.45 }}>*</Text>
      </View>
    );
  }

  const streak = currentStreak(checkIns);
  const totalReflectionDays = qualifyingReflectionDays(checkIns);
  const isSanctuaryThemeUnlocked = (theme: (typeof SANCTUARY_THEMES)[number]) =>
    isThemeUnlocked(
      theme,
      totalReflectionDays,
      effectivePremium,
      Boolean(seasonalSanctuaryUnlocks[theme.key])
    );
  const sanctuaryThemeProgressLabel = (theme: (typeof SANCTUARY_THEMES)[number]) =>
    isSanctuaryThemeUnlocked(theme) ? "Unlocked" : themeProgressLabel(theme, totalReflectionDays, effectivePremium);
  const weeklyReflectionDays = Math.min(7, currentWeekReflectionDays(checkIns));
  const notificationStatusLabel = notificationSettings.permissionStatus === "unknown"
    ? "Permission Needed"
    : notificationSettings.permissionStatus === "denied"
      ? "Off"
      : notificationSettings.dailyReminderEnabled || notificationSettings.weeklyInsightEnabled || notificationSettings.sanctuaryUnlockEnabled
        ? "On"
        : "Off";
  const best = bestStreak(checkIns);
  const latestToday = checkIns.find((c) => c.dateKey === todayKey() && c.reply);
  const showSubmittedCoach = Boolean(latestToday?.reply && !pending);
  const greeting = greetingForNow();
  const firstName = displayName.trim().split(/\s+/)[0];
  const selectedSanctuary = getSanctuaryTheme(sanctuaryTheme);
  const detailSanctuary = getSanctuaryTheme(sanctuaryDetailTheme);
  const forestHavenReward = getSanctuaryTheme("forest");

  useEffect(() => {
    if (!showPurchaseSuccess) return;
    purchaseSuccessProgress.setValue(0);
    const animation = Animated.timing(purchaseSuccessProgress, {
      toValue: 1,
      duration: 2800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [purchaseSuccessProgress, showPurchaseSuccess]);

  const showFirstWeekCompleteModal = Boolean(
    onboardingCompleted &&
      !premium &&
      complimentaryAccess &&
      (complimentaryAccess.status === "completed" || complimentaryAccess.status === "expired") &&
      !complimentaryAccess.conversionPromptShownAt
  );
  const needsWeekTwo =
    !premium &&
    complimentaryAccess &&
    (complimentaryAccess.status === "completed" || complimentaryAccess.status === "expired");

  useEffect(() => {
    if (!storageLoaded || isSanctuaryThemeUnlocked(getSanctuaryTheme(sanctuaryTheme))) return;
    setSanctuaryTheme("cloud");
    setDraftSanctuaryTheme("cloud");
  }, [effectivePremium, sanctuaryTheme, seasonalSanctuaryUnlocks, storageLoaded, totalReflectionDays]);

  useEffect(() => {
    if (!storageLoaded || !authUser || !FIREBASE_PROJECT_ID) return;
    if (
      Platform.OS === "ios" &&
      REVENUECAT_IOS_API_KEY &&
      revenueCatIdentityUserId !== authUser.localId
    ) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const user = await validMobileAuthUser();
          if (cancelled) return;
          await syncMobileUserProfile(
            { projectId: FIREBASE_PROJECT_ID, idToken: user.idToken },
            {
              uid: user.localId,
              email: user.email,
              displayName: displayName.trim() || null,
              onboardingCompleted,
              onboardingCoachStep,
              onboardingSkippedAt,
              onboardingCompletedAt: onboardingCoachCompletedAt,
              subscriptionStatus: premium
                ? "active"
                : hasActiveComplimentaryAccess(complimentaryAccess)
                  ? "trial"
                  : "free",
              plan: premium ? "premium" : "free",
              appVersion: Constants.expoConfig?.version || "1.0.0",
              osVersion: String(Platform.Version),
              selectedTheme: sanctuaryTheme,
              streakCount: streak,
              reflectionCount: checkIns.length,
              lastReflectionAt: checkIns[0]?.createdAt ?? null,
            }
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Mobile profile sync failed";
          if (__DEV__) console.warn("Mobile profile sync failed", message);
          logMobileApiError({
            errorCode: "mobile_profile_sync_failed",
            errorMessage: message,
            featureArea: "account_sync",
          });
        }
      })();
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    authUser?.localId,
    checkIns.length,
    displayName,
    effectivePremium,
    onboardingCoachCompletedAt,
    onboardingCoachStep,
    onboardingCompleted,
    onboardingSkippedAt,
    premium,
    revenueCatIdentityUserId,
    sanctuaryTheme,
    storageLoaded,
    streak,
  ]);

  const firstWeekEntries = complimentaryAccess
    ? checkIns.filter((entry) => {
        const time = new Date(entry.createdAt).getTime();
        return time >= new Date(complimentaryAccess.startedAt).getTime() && time <= new Date(complimentaryAccess.endsAt).getTime();
      })
    : [];
  const firstWeekReflectionDays = new Set(firstWeekEntries.map((entry) => entry.dateKey)).size;
  const firstWeekInsight = weeklyInsights[0] ?? null;
  const firstWeekSummaryItems = firstWeekReflectionDays >= 7
    ? ["7 reflection days", "1 weekly reflection", "Forest Haven unlocked"]
    : firstWeekReflectionDays >= 3
      ? [`${firstWeekReflectionDays} reflection days`, "1 weekly reflection", "A few themes noticed"]
      : firstWeekReflectionDays === 2
        ? ["2 reflection days", "Weekly reflection still building", "A theme beginning to form"]
      : firstWeekReflectionDays === 1
        ? ["1 reflection day", "Weekly reflection still building", "1 moment worth revisiting"]
        : ["Your space is still here", "Your weekly reflection is waiting to begin"];
  const firstWeekGains = [
    firstWeekReflectionDays >= 3 ? "Your first Weekly Reflection" : "A weekly reflection beginning to form",
    "Personalized AI insights",
    firstWeekReflectionDays >= 3 ? "Your first emotional patterns" : "The first moments Tranqly can learn from",
    ...(firstWeekReflectionDays >= 7 ? ["Forest Haven, yours to keep"] : []),
    `${firstWeekReflectionDays || "A few"} meaningful reflection ${firstWeekReflectionDays === 1 ? "day" : "days"}`,
  ];
  const nextWeekDiscoveries = [
    "Deeper patterns across more of your days",
    "Reflections that remember more about you",
    "A Weekly Reflection that becomes more personal",
    "Progress toward your next sanctuary",
  ];
  const firstWeekReflectionText = (firstWeekInsight?.insight ??
    (firstWeekEntries.length
      ? "You took time to check in with yourself this week. What you shared may not form a full pattern yet, but it still gives you something meaningful to return to."
      : "You did not share a reflection this week, so there is not a personal pattern to bring together yet. Your space is still here whenever you feel ready to return."))
    .replace(/Across these seven reflections, Tranqly noticed a clear thread:/i, "Across your reflections this week, a clear thread appeared:")
    .replace(/Across these seven reflections/i, "Across your reflections this week")
    .replace(/You were beginning to notice which moments helped you feel steadier and return to yourself\./i, "You began noticing which moments helped you feel steadier and more like yourself.");
  const firstWeekPlanLabel = selectedPlan === "yearly" ? "Yearly plan selected" : "Monthly plan selected";
  const firstWeekPlanBilling = selectedPlan === "yearly"
    ? storePrices.yearly ? `${storePrices.yearly} billed annually` : "Loading App Store price..."
    : storePrices.monthly ? `${storePrices.monthly} billed monthly` : "Loading App Store price...";
  function markFirstWeekConversionSeen() {
    setComplimentaryAccess((current) =>
      current
        ? {
            ...current,
            conversionPromptShownAt: new Date().toISOString(),
          }
        : current
    );
  }

  useEffect(() => {
    if (!showFirstWeekCompleteModal) return;
    firstWeekCardAnims.forEach((value) => value.setValue(0));
    Animated.stagger(
      100,
      firstWeekCardAnims.map((value) =>
        Animated.spring(value, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [firstWeekCardAnims, showFirstWeekCompleteModal]);
  function promptWeekTwoContinuation() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGrowthNotice("Your first week is complete. Ready for another one?");
    setTimeout(() => setGrowthNotice(""), 6500);
    setShowPremiumModal(true);
  }
  const upcomingSanctuary = nextThemeUnlock(totalReflectionDays, effectivePremium);
  const reflectionsToNextSanctuary = upcomingSanctuary
    ? Math.max(0, upcomingSanctuary.unlockDays - totalReflectionDays)
    : 0;
  const detailSanctuaryReflectionCount = detailSanctuary.unlockType === "reflections"
    ? Math.max(0, totalReflectionDays - detailSanctuary.unlockDays)
    : totalReflectionDays;
  const appTheme = APP_THEME_PALETTES[sanctuaryTheme] || APP_THEME_PALETTES.twilight;
  const firstWeekDay = complimentaryAccess?.status === "active"
    ? Math.min(7, Math.max(1, Math.floor((Date.now() - new Date(complimentaryAccess.startedAt).getTime()) / 86400000) + 1))
    : 1;
  const reminderSuggestion = adaptiveSuggestion(notificationSettings);
  const voiceProgress = Math.min(1, voiceElapsed / VOICE_LIMIT_SECONDS);
  const composerStatus = composerError
    ? composerError
    : recording
      ? `Listening... ${voiceElapsed}s / ${VOICE_LIMIT_SECONDS}s`
      : transcribing
        ? "Transcribing your voice..."
        : pending
          ? "Building your insight..."
          : captured
            ? "Reflection captured."
            : text.trim()
              ? "Ready for insights."
              : "Ready when you are.";
  const voiceProgressBar = (
    <View style={styles.voiceLimitWrap}>
      <View style={[styles.voiceLimitTrack, { backgroundColor: appTheme.ink }]}>
        <View
          style={[
            styles.voiceLimitFill,
            {
              backgroundColor: appTheme.accent,
              width: `${voiceProgress * 100}%`,
            },
          ]}
        />
      </View>
      <Text style={[styles.voiceLimitText, { color: appTheme.faint }]}>
        {voiceElapsed}s / {VOICE_LIMIT_SECONDS}s
      </Text>
    </View>
  );
  const themedCard = { backgroundColor: appTheme.card, borderColor: appTheme.edge };
  const themedInk = { backgroundColor: appTheme.ink, borderColor: appTheme.edge };
  const themedWeekly = { backgroundColor: appTheme.weeklyBg, borderColor: appTheme.edge };
  const themedTitle = { color: appTheme.fg };
  const themedBody = { color: appTheme.dim };
  const themedMuted = { color: appTheme.faint };
  const themedAccent = { color: appTheme.accent };
  const themedAccent2 = { color: appTheme.accent2 };
  const coachPatternEvidence = coachModal
    ? Math.max(1, checkIns.filter((entry) => (coachModal.reply.tags ?? coachModal.reply.themes ?? []).some((tag) => entry.text.toLowerCase().includes(tag.toLowerCase()))).length)
    : 1;
  const coachStepLabels = ["One Gentle Step", "A Question to Carry", "Something to Notice", "No Action Needed Today"];
  const coachStepLabel = coachModal ? coachModal.reply.nudgeLabel ?? coachStepLabels[coachModal.text.length % coachStepLabels.length] : coachStepLabels[0];

  return (
    <SafeAreaProvider style={[styles.appRoot, { backgroundColor: appTheme.bg }]}>
      <SafeAreaView style={[styles.shell, { backgroundColor: appTheme.bg }]}>
        <StatusBar style="light" />
        <Modal visible={initialOnboardingOpen} transparent animationType="fade" onRequestClose={skipOnboarding}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <Pressable style={styles.onboardingOverlay} onPress={Keyboard.dismiss}>
            <Pressable
              onPress={Keyboard.dismiss}
              style={[styles.onboardingCardShell, themedCard, { height: onboardingCardHeight }]}
            >
              <View style={styles.onboardingHeader}>
                <Text style={[styles.onboardingStepText, themedAccent]}>
                  Step {currentOnboardingStep === "firstWeek" ? "1" : "2"} of 5
                </Text>
                <View style={styles.onboardingProgressRow}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.onboardingProgressSegment,
                        { backgroundColor: index < (currentOnboardingStep === "firstWeek" ? 1 : 2) ? appTheme.accent : appTheme.ink },
                      ]}
                    />
                  ))}
                </View>
                <Image source={TRANQLY_LOGO} style={styles.onboardingLogoImage} resizeMode="contain" />
                <Text style={[styles.onboardingTitle, themedTitle]}>
                  {currentOnboardingStep === "firstWeek"
                    ? "Your first week with Tranqly"
                    : "Begin your journey"}
                </Text>
                <Text style={[styles.onboardingBody, themedBody]}>
                  {currentOnboardingStep === "firstWeek"
                    ? "Over the next seven days, Tranqly will help you reflect, notice recurring themes, and prepare your first weekly reflection."
                    : "Your first week is on us. Reflect for seven days, receive your first weekly reflection, then decide whether you'd like to continue."}
                </Text>
              </View>

              <ScrollView
                style={styles.onboardingMiddle}
                contentContainerStyle={styles.onboardingMiddleContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {currentOnboardingStep === "firstWeek" ? [
                  ["Today", "Take a minute to reflect by voice or text."],
                  ["Over the next week", "Every reflection helps Tranqly notice the themes and moments that matter most to you."],
                  ["Day 7", "At the end of your first week, you will receive a personalized weekly reflection that brings together everything you shared."],
                ].map(([title, body]) => (
                  <View key={title} style={[styles.onboardingTimelineItem, themedInk, { borderColor: appTheme.edge }]} accessible accessibilityLabel={`${title}. ${body}`}>
                    <Text style={[styles.onboardingTimelineTitle, themedAccent]}>{title}</Text>
                    <Text style={[styles.onboardingTimelineBody, themedBody]}>{body}</Text>
                  </View>
                )).concat([
                  <View key="name-field" style={styles.onboardingNameField}>
                    <Text style={[styles.onboardingInputLabel, themedBody]}>What should I call you? (Optional)</Text>
                    <TextInput
                      value={onboardingName}
                      onChangeText={setOnboardingName}
                      placeholder="Your name"
                      placeholderTextColor={appTheme.faint}
                      autoCapitalize="words"
                      blurOnSubmit
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={[styles.onboardingInput, themedInk, themedTitle, { borderColor: appTheme.edge }]}
                    />
                  </View>,
                ]) : null}
                {currentOnboardingStep === "freeWeek" || currentOnboardingStep === "trial" ? [
                  ["Today", "Begin reflecting with full access to Tranqly."],
                  ["During the week", "Receive thoughtful responses and begin building your first weekly reflection."],
                  ["Day 7", "Your first weekly reflection will be ready. After you read it, you can decide whether you would like to continue."],
                ].map(([day, body]) => (
                  <View key={day} style={[styles.onboardingTrialItem, themedInk, { borderColor: appTheme.edge }]} accessible accessibilityLabel={`${day}. ${body}`}>
                    <Text style={[styles.onboardingTimelineTitle, themedAccent]}>{day}</Text>
                    <Text style={[styles.onboardingTrialBody, themedBody]}>{body}</Text>
                  </View>
                )) : null}
              </ScrollView>

              <View style={[styles.onboardingFooter, { borderTopColor: appTheme.edge }]}>
                <Pressable
                  onPress={() => {
                    if (currentOnboardingStep === "firstWeek") moveInitialOnboarding("freeWeek");
                    else completeInitialOnboarding();
                  }}
                  style={[styles.onboardingButton, { backgroundColor: appTheme.button }]}
                >
                  <Text style={[styles.onboardingButtonText, themedTitle]}>
                    {currentOnboardingStep === "firstWeek" ? "Next" : "Begin your journey"}
                  </Text>
                </Pressable>
                {currentOnboardingStep === "freeWeek" || currentOnboardingStep === "trial" ? (
                  <Text style={[styles.onboardingBillingNote, themedMuted]}>No payment required. Nothing renews automatically.</Text>
                ) : null}
              </View>
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Modal>
        <Modal
          visible={Boolean(onboardingCompleted && ((activeCoachStep && coachMarksReady) || showOnboardingComplete))}
          transparent
          animationType="fade"
          onRequestClose={skipOnboarding}
        >
          <View style={styles.coachMarkOverlay}>
            {showOnboardingComplete ? (
              <View style={[styles.onboardingCompleteCard, { backgroundColor: appTheme.card, borderColor: appTheme.accent }]}>
                <Text style={[styles.onboardingCompleteTitle, themedTitle]}>You're all set</Text>
                <Text style={[styles.onboardingCompleteBody, themedBody]}>
                  Your first week starts now. Take your time. Your first weekly reflection will be waiting in seven days.
                </Text>
                <Pressable
                  onPress={() => {
                    setShowOnboardingComplete(false);
                    setTab("coach");
                  }}
                  style={[styles.onboardingCompleteButton, { backgroundColor: appTheme.button }]}
                >
                  <Text style={[styles.coachMarkPrimaryText, themedTitle]}>Start reflecting</Text>
                </Pressable>
              </View>
            ) : null}
            {!showOnboardingComplete && coachTarget ? (
              <>
                <View testID="coach-target-highlight" pointerEvents="none" style={[styles.coachMarkHighlight, { left: coachTarget.x - 8, top: coachTarget.y - 8, width: coachTarget.width + 16, height: coachTarget.height + 16, borderRadius: Math.max(coachTarget.width, coachTarget.height), borderColor: appTheme.accent, shadowColor: appTheme.accent }]} />
                <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={screenWidth} height={screenHeight}>
                  <Path d={`M ${screenWidth / 2} ${coachPointerStartY} Q ${screenWidth / 2} ${(coachPointerStartY + coachTarget.centerY) / 2} ${coachTarget.centerX} ${coachTarget.centerY}`} fill="none" stroke={appTheme.accent} strokeWidth={2} strokeDasharray="5 7" />
                  <Circle cx={coachTarget.centerX} cy={coachTarget.centerY} r={4} fill={appTheme.accent} />
                </Svg>
              </>
            ) : null}
            {!showOnboardingComplete ? (
            <View style={[styles.coachMarkCard, { top: coachCardTop, backgroundColor: appTheme.card, borderColor: appTheme.accent }]}>
              <View style={styles.coachMarkHeader}>
                <View style={styles.coachMarkHeadingCopy}>
                  <Text style={[styles.coachMarkKicker, { color: appTheme.accent2 }]}>
                    {activeCoachStep === "reflectionCoach" ? "Today's Reflection" : activeCoachStep === "journeyCoach" ? "Journey" : "Sanctuary"}
                  </Text>
                  <Text style={[styles.coachMarkTitle, themedTitle]}>
                    {activeCoachStep === "reflectionCoach"
                      ? "Your first reflection"
                      : activeCoachStep === "journeyCoach"
                        ? "Your Journey"
                        : "Your sanctuary"}
                  </Text>
                </View>
                <View style={styles.coachMarkTopActions}>
                  <Text style={[styles.coachMarkProgressBadge, themedMuted]}>
                    {activeCoachStep === "reflectionCoach" ? "Step 3 of 5" : activeCoachStep === "journeyCoach" ? "Step 4 of 5" : "Step 5 of 5"}
                  </Text>
                  <Pressable
                    onPress={skipOnboarding}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Skip onboarding"
                    style={[styles.coachMarkCloseButton, { borderColor: appTheme.edge, backgroundColor: appTheme.ink }]}
                  >
                    <Text style={[styles.coachMarkCloseText, themedMuted]}>X</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={[styles.coachMarkBody, themedBody]}>
                {activeCoachStep === "reflectionCoach"
                  ? "Tap the microphone to speak, or type in the box below."
                  : activeCoachStep === "journeyCoach"
                    ? "Watch your reflections become a story over time."
                    : "Choose the environment that feels most calming while you reflect."}
              </Text>
              <View style={styles.coachMarkActions}>
                <Pressable onPress={nextCoachMark} style={[styles.coachMarkPrimary, { backgroundColor: appTheme.button }]}>
                  <Text style={[styles.coachMarkPrimaryText, themedTitle]}>
                    {activeCoachStep === "sanctuaryCoach" ? "Done" : "Next"}
                  </Text>
                </Pressable>
              </View>
            </View>
            ) : null}
          </View>
        </Modal>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.flex, { backgroundColor: appTheme.bg }]}
        >
          <Animated.View
            style={[
              styles.tabContentTransition,
              {
                opacity: tabOpacity,
                transform: [{ translateX: tabSlide }],
              },
            ]}
          >
          {tab === "coach" ? (
            <ScrollView
              testID="insights-scroll"
              style={styles.fitCoachScroll}
              contentContainerStyle={styles.fitCoachShell}
              keyboardShouldPersistTaps="never"
              onScrollBeginDrag={Keyboard.dismiss}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.fitHeader}>
                <View style={styles.fitBrandRow}>
                  <Image source={TRANQLY_LOGO} style={styles.fitBrandLogo} resizeMode="contain" />
                  <Text style={[styles.fitBrand, { color: appTheme.fg }, shortLayout && styles.fitBrandShort]}>
                    Tranqly: Daily Reflections
                  </Text>
                </View>
                <Text style={[styles.fitStreak, { color: appTheme.faint }]}>{streak} day streak</Text>
              </View>

              <View style={styles.fitHero}>
                <Text style={[styles.fitEyebrow, { color: appTheme.dim }, shortLayout && styles.fitEyebrowShort]}>
                  {greeting}{firstName ? `, ${firstName}` : ""}
                </Text>
                <Text style={[styles.fitSubline, { color: appTheme.dim }]}>
                  Talk for 60 seconds. Understand yourself over time.
                </Text>
                <Text style={[styles.fitDiscoveryLine, { color: appTheme.accent2 }]}>
                  Discover something new about yourself. Every day.
                </Text>
              </View>

              {complimentaryAccess?.status === "active" ? (
                <View style={[styles.firstWeekBanner, { backgroundColor: appTheme.helperBg, borderColor: appTheme.helperEdge }]}>
                  <Text style={[styles.firstWeekBannerStrong, { color: appTheme.accent2 }]}>Day {firstWeekDay} of 7</Text>
                  <Text style={[styles.firstWeekBannerText, { color: appTheme.dim }]}>
                    Your first weekly reflection arrives in seven days.
                  </Text>
                </View>
              ) : null}
              {needsWeekTwo ? (
                <View style={[styles.firstWeekBanner, { backgroundColor: appTheme.helperBg, borderColor: appTheme.helperEdge }]}>
                  <Text style={[styles.firstWeekBannerStrong, { color: appTheme.accent2 }]}>Welcome back.</Text>
                  <Text style={[styles.firstWeekBannerText, { color: appTheme.dim }]}>
                    Your first week is waiting if you would like to revisit it. When you are ready, begin Week Two.
                  </Text>
                </View>
              ) : null}

              {growthNotice ? (
                <View style={[styles.growthNoticeCard, { backgroundColor: appTheme.helperBg, borderColor: appTheme.accent }]}>
                  <Text style={[styles.growthNoticeText, { color: appTheme.accent2 }]}>{growthNotice}</Text>
                </View>
              ) : null}

              {showSubmittedCoach && latestToday?.reply ? (
                <>
                <View style={[styles.fitSubmittedCard, { backgroundColor: appTheme.card, borderColor: appTheme.edge }, shortLayout && styles.fitSubmittedCardShort]}>
                  <Text style={[styles.fitKicker, { color: appTheme.accent2 }]}>Today&apos;s Insight</Text>
                  <Pressable onPress={() => openCoachModal(latestToday.text, latestToday.reply!)} style={[styles.fitInsightPreview, { backgroundColor: appTheme.ink, borderColor: appTheme.edge }, compactWidth && styles.fitInsightPreviewNarrow, shortLayout && styles.fitInsightPreviewShort]}>
                    <Text numberOfLines={2} ellipsizeMode="tail" allowFontScaling style={[styles.fitSubmittedTitle, { color: appTheme.fg }, compactWidth && styles.fitSubmittedTitleNarrow, shortLayout && styles.fitSubmittedTitleShort]}>
                      {latestToday.reply.title ?? "Today I noticed..."}
                    </Text>
                    <Text
                      numberOfLines={2}
                      ellipsizeMode="tail"
                      allowFontScaling
                      style={[styles.fitSubmittedBody, { color: appTheme.dim }, compactWidth && styles.fitSubmittedBodyNarrow, shortLayout && styles.fitSubmittedBodyShort]}
                    >
                      {latestToday.reply.preview ?? latestToday.reply.message}
                    </Text>
                    <View style={styles.fitSeeMoreButton}>
                      <Text style={[styles.inlinePremiumLink, { color: appTheme.accent }]}>See more</Text>
                    </View>
                  </Pressable>
                  <View style={[styles.fitDivider, { backgroundColor: appTheme.edge }]} />
                  <Text style={[styles.fitKicker, { color: appTheme.accent2 }]}>Ask a follow-up</Text>
                  <View style={[styles.fitFollowUpComposer, shortLayout && styles.fitFollowUpComposerShort]}>
                    <View style={styles.fitFollowUpStack}>
                      <View style={styles.fitMicPulseWrap}>
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.fitFollowUpPulse,
                            {
                              backgroundColor: appTheme.accent,
                              opacity: micPulse.interpolate({
                                inputRange: [1, 1.12],
                                outputRange: [0.36, 0],
                              }),
                              transform: [{ scale: micPulse }],
                            },
                          ]}
                        />
                        <Pressable
                          ref={micCoachTargetRef}
                          onLayout={measureCoachTarget}
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            void toggleRecord();
                          }}
                          disabled={transcribing || pending}
                          style={({ pressed }) => [
                            styles.fitFollowUpMic,
                            { backgroundColor: appTheme.ink, shadowColor: appTheme.accent },
                            recording && styles.fitMicButtonRecording,
                            pressed && styles.micPressed,
                            (transcribing || pending) && styles.micDisabled,
                          ]}
                        >
                          <Svg width={41} height={41} viewBox="0 0 24 24" fill="none">
                            <Path
                              d="M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V4Z"
                              stroke={appTheme.accent2}
                              strokeWidth={2}
                            />
                            <Path
                              d="M5 10.5a7 7 0 0 0 14 0M12 18v3M8.5 21h7"
                              stroke={appTheme.accent2}
                              strokeWidth={2}
                              strokeLinecap="round"
                            />
                          </Svg>
                        </Pressable>
                      </View>
                      {voiceProgressBar}
                      <Text style={[styles.fitFollowUpHint, { color: appTheme.faint }]}>
                        {recording
                          ? "I'm listening... tap when you're done"
                          : "Tap to speak, or type below"}
                      </Text>
                      <TextInput
                        value={text}
                        onChangeText={setText}
                        placeholder={
                          transcribing
                            ? "Transcribing your voice..."
                            : "Ask Tranqly a follow-up, or add more for today."
                        }
                        placeholderTextColor={appTheme.faint}
                        multiline
                        blurOnSubmit
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        style={[styles.fitFollowUpInput, { backgroundColor: appTheme.ink, borderColor: appTheme.edge, color: appTheme.fg }, shortLayout && styles.fitFollowUpInputShort]}
                      />
                    </View>
                    <Pressable
                      disabled={!text.trim() || pending || transcribing}
                      style={[
                        styles.fitShareButton,
                        (!text.trim() || pending || transcribing) && styles.disabled,
                      ]}
                      onPress={submit}
                    >
                      <LinearGradient
                        colors={
                          !text.trim() || pending || transcribing
                            ? [appTheme.disabled, appTheme.disabled]
                            : [appTheme.button, appTheme.button]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.fitFollowUpShare}
                      >
                        <Text
                          style={[
                            styles.fitWeeklyButtonText,
                            { color: appTheme.fg },
                            (!text.trim() || pending || transcribing) && { color: appTheme.dim },
                          ]}
                        >
                          Continue Conversation
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>
                {false && <View style={[styles.fitSubmittedCard, { backgroundColor: appTheme.card, borderColor: appTheme.edge }, shortLayout && styles.fitSubmittedCardShort]}>
                  <Text style={[styles.fitKicker, { color: appTheme.accent2 }]}>Today&apos;s Insight</Text>
                  <Text style={[styles.fitSubmittedTitle, { color: appTheme.fg }, shortLayout && styles.fitSubmittedTitleShort]}>
                    {latestToday?.reply?.title ?? "Today I noticed..."}
                  </Text>
                  <Text style={[styles.fitSubmittedBody, { color: appTheme.dim }, shortLayout && styles.fitSubmittedBodyShort]}>
                    {latestToday?.reply?.message}
                  </Text>
                  <Pressable onPress={() => latestToday?.reply && openCoachModal(latestToday.text, latestToday.reply)}>
                    <Text style={[styles.inlinePremiumLink, { color: appTheme.accent }]}>See more</Text>
                  </Pressable>
                </View>}
                </>
              ) : (
                <>
              <View style={[styles.fitComposer, { backgroundColor: appTheme.card, borderColor: appTheme.edge }, shortLayout && styles.fitComposerShort]}>
                <View style={styles.fitPromptBlock}>
                  <Text style={[styles.fitKicker, { color: appTheme.accent2 }]}>Today&apos;s Discovery</Text>
                  <Text testID="daily-prompt" style={[styles.fitPromptText, { color: appTheme.fg }]}>{dailyPrompt}</Text>
                  {promptSelection.whyThisQuestion ? (
                    <Text style={[styles.promptReasonText, { color: appTheme.faint }]}>
                      {promptSelection.whyThisQuestion}
                    </Text>
                  ) : null}
                  <Pressable
                    testID="refresh-prompt"
                    accessibilityRole="button"
                    accessibilityLabel="Refresh prompt"
                    onPress={() => setPromptOffset((value) => value + 1)}
                    style={styles.anotherPromptButton}
                  >
                    <Text style={[styles.anotherPromptText, { color: appTheme.accent }]}>Refresh Prompt</Text>
                  </Pressable>
                </View>
                <View style={[styles.fitMicWrap, shortLayout && styles.fitMicWrapShort]}>
                  <View style={styles.fitMicPulseWrap}>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.fitMicPulse,
                        shortLayout && styles.fitMicPulseShort,
                        {
                          backgroundColor: appTheme.accent,
                          opacity: micPulse.interpolate({
                            inputRange: [1, 1.12],
                            outputRange: [0.36, 0],
                          }),
                          transform: [{ scale: micPulse }],
                        },
                      ]}
                    />
                    <Pressable
                      ref={micCoachTargetRef}
                      onLayout={measureCoachTarget}
                      testID="reflection-mic"
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        void toggleRecord();
                      }}
                      disabled={transcribing || pending}
                      style={({ pressed }) => [
                        styles.fitMicButton,
                        shortLayout && styles.fitMicButtonShort,
                        { backgroundColor: appTheme.ink, shadowColor: appTheme.accent, width: micDiameter, height: micDiameter, borderRadius: micDiameter / 2 },
                        recording && styles.fitMicButtonRecording,
                        pressed && styles.micPressed,
                        (transcribing || pending) && styles.micDisabled,
                      ]}
                    >
                    {recording ? (
                      <View style={styles.waveformRow}>
                        {[18, 34, 24, 42, 28, 36, 20].map((height, index) => (
                          <Animated.View
                            key={index}
                            style={[
                              styles.waveformBar,
                              { backgroundColor: appTheme.accent2 },
                              {
                                height,
                                transform: [
                                  {
                                    scaleY: micPulse.interpolate({
                                      inputRange: [1, 1.12],
                                      outputRange: [0.65 + (index % 3) * 0.1, 1],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          />
                        ))}
                      </View>
                    ) : transcribing ? (
                      <Text style={styles.fitMicLoading}>...</Text>
                    ) : (
                      <Svg width={shortLayout ? 44 : 50} height={shortLayout ? 44 : 50} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V4Z"
                          stroke={appTheme.accent2}
                          strokeWidth={2.2}
                        />
                        <Path
                          d="M5 10.5a7 7 0 0 0 14 0M12 18v3M8.5 21h7"
                          stroke={appTheme.accent2}
                          strokeWidth={2.2}
                          strokeLinecap="round"
                        />
                      </Svg>
                    )}
                    </Pressable>
                  </View>
                  {voiceProgressBar}
                  <Text style={[styles.fitVoiceHint, { color: appTheme.faint }, shortLayout && styles.fitVoiceHintShort]}>
                    {captured
                      ? "Reflection captured"
                      : recording
                      ? "Speak naturally."
                      : transcribing
                        ? "Turning your voice into text..."
                        : "Tap the mic, or type below"}
                  </Text>
                </View>

                {false && showTranscriptPreview && text.trim() ? (
                  <View style={styles.fitTranscriptCard}>
                    <Text style={styles.fitKicker}>Here&apos;s what I heard</Text>
                    <Text style={styles.fitTranscriptText}>"{text.trim()}"</Text>
                  </View>
                ) : null}

                <View style={[styles.fitStatusCard, { backgroundColor: appTheme.ink, borderColor: appTheme.edge }]}>
                  <Text
                    style={[
                      styles.fitStatusText,
                      { color: composerError ? "#F6A6B2" : appTheme.accent2 },
                      shortLayout && styles.fitStatusTextShort,
                    ]}
                  >
                    {composerStatus}
                  </Text>
                </View>

                <TextInput
                  testID="reflection-input"
                  value={text}
                  onChangeText={setText}
                  placeholder={
                    recording
                      ? "Your thoughts will appear here..."
                      : transcribing
                      ? "Transcribing your voice..."
                      : "Add more details, or type your reflection here."
                  }
                  placeholderTextColor={appTheme.faint}
                  multiline
                  blurOnSubmit
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  style={[styles.fitInput, { backgroundColor: appTheme.ink, borderColor: appTheme.edge, color: appTheme.fg }, shortLayout && styles.fitInputShort]}
                />
              </View>

              {false && <View style={[styles.fitBasedCard, { backgroundColor: appTheme.helperBg, borderColor: appTheme.helperEdge }, shortLayout && styles.fitBasedCardShort]}>
                <Text style={[styles.fitKicker, { color: appTheme.accent2 }]}>Need a little help?</Text>
                <Text style={[styles.fitCardText, { color: appTheme.dim }, shortLayout && styles.fitCardTextShort]}>
                  {inspirationFor(text)}
                </Text>
              </View>}

              <Pressable
                testID="submit-reflection"
                accessibilityRole="button"
                accessibilityLabel="Get insights"
                disabled={!text.trim() || pending || transcribing || Boolean(recording)}
                style={[
                  styles.fitShareButton,
                  (!text.trim() || pending || transcribing || Boolean(recording)) && styles.disabled,
                ]}
                onPress={submit}
              >
                <LinearGradient
                  colors={
                    !text.trim() || pending || transcribing || Boolean(recording)
                      ? [appTheme.disabled, appTheme.disabled]
                      : [appTheme.button, appTheme.button]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.fitShareGradient, shortLayout && styles.fitShareGradientShort]}
                >
                  {pending ? (
                    <ActivityIndicator color={appTheme.fg} />
                  ) : (
                    <Text
                      style={[
                        styles.shareText,
                        { color: appTheme.fg },
                        (!text.trim() || pending || transcribing || Boolean(recording)) && { color: appTheme.dim },
                        shortLayout && styles.shareTextShort,
                      ]}
                    >
                      Get Insights
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
                </>
              )}

              <View style={[styles.fitWeeklyPreview, { backgroundColor: appTheme.weeklyBg, borderColor: appTheme.edge }, shortLayout && styles.fitWeeklyPreviewShort]}>
                <View style={styles.fitWeeklyHeader}>
                  <Text style={[styles.fitKicker, { color: appTheme.accent2 }]}>Weekly Reflection</Text>
                  <Text style={[styles.fitWeeklyCount, { color: appTheme.accent2 }]}>
                    Sunday
                  </Text>
                </View>
                <Text style={[styles.fitWeeklyProgressText, { color: appTheme.dim }]}>
                  {weeklyGenerating
                    ? "Tranqly is preparing your weekly reflection."
                    : weeklyInsights.length
                      ? "Your latest weekly reflection is ready."
                      : weekCheckInCount >= 3
                        ? "You have shared enough to notice meaningful themes. Your reflection arrives Sunday."
                        : weekCheckInCount === 0
                          ? "Your weekly reflection will begin building after your first reflection."
                          : "Your weekly reflection is still building. A few more check-ins will help Tranqly uncover meaningful patterns."}
                </Text>
                <View style={styles.fitWeeklyProgress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 3, now: Math.min(3, weekCheckInCount) }} accessibilityLabel={`Weekly Reflection, ${Math.min(3, weekCheckInCount)} of 3 Reflection Days`}>
                  {Array.from({ length: 3 }, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.fitWeeklyProgressSegment,
                        { backgroundColor: appTheme.ink },
                        index < Math.min(3, weekCheckInCount) && { backgroundColor: appTheme.accent },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.fitWeeklyProgressText, { color: appTheme.fg }]}>
                  {weekCheckInCount} Reflection Day{weekCheckInCount === 1 ? "" : "s"} this week
                </Text>
                {weeklyInsights.length ? (
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setSelectedWeeklyInsight(weeklyInsights[0]);
                      setShowJourneyDeepInsight(true);
                    }}
                    style={[styles.fitWeeklyButton, { backgroundColor: appTheme.button }]}
                  >
                    <Text style={[styles.fitWeeklyButtonText, { color: appTheme.fg }]}>Read Weekly Reflection</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          ) : null}

          {false && tab === "coach" ? (
            <View style={styles.coachShell}>
              {/* Input section at top */}
              <View style={[styles.inputSection, shortLayout && styles.inputSectionShort]}>
                <View style={[styles.greeting, shortLayout && styles.greetingShort]}>
                  <Text style={[styles.greetingName, shortLayout && styles.greetingNameShort]}>
                    How are you feeling?
                  </Text>
                  <View style={[styles.greetingBadge, shortLayout && styles.greetingBadgeShort]}>
                    <Text style={[styles.greetingEmoji, shortLayout && styles.greetingEmojiShort]}>
                      *
                    </Text>
                    <Text style={[styles.greetingSub, shortLayout && styles.greetingSubShort]}>
                      Share your thoughts with Tranqly
                    </Text>
                  </View>
                </View>

                <View style={[styles.inputRow, shortLayout && styles.inputRowShort]}>
                  <Pressable
                    onPress={toggleRecord}
                    disabled={transcribing || pending}
                    style={({ pressed }) => [
                      styles.micButton,
                      shortLayout && styles.micButtonShort,
                      pressed && styles.micPressed,
                      (transcribing || pending) && styles.micDisabled,
                    ]}
                  >
                    {recording ? (
                      <View style={styles.recordingIndicator}>
                        {[1, 2, 3].map((i) => (
                          <View
                            key={i}
                            style={[
                              styles.recordingRing,
                              { width: 32 + i * 16, height: 32 + i * 16 },
                            ]}
                          />
                        ))}
                        <Text style={styles.micIcon}>Stop</Text>
                      </View>
                    ) : (
                      <Text style={[styles.micIcon, shortLayout && styles.micIconShort]}>
                        {transcribing ? "..." : "Mic"}
                      </Text>
                    )}
                  </Pressable>

                  <View style={[styles.textInputWrap, shortLayout && styles.textInputWrapShort]}>
                    <TextInput
                      value={text}
                      onChangeText={setText}
                      placeholder={
                        transcribing
                          ? "Transcribing your voice..."
                          : "Big or small, whatever happened today. No judgment here."
                      }
                      placeholderTextColor="#5B6478"
                      style={[styles.input, shortLayout && styles.inputShort]}
                    />
                  </View>
                </View>

                <Pressable
                  disabled={!text.trim() || pending || transcribing}
                  style={[
                    styles.shareButton,
                    (!text.trim() || pending || transcribing) &&
                      styles.disabled,
                    shortLayout && styles.shareButtonShort,
                  ]}
                  onPress={submit}
                >
                  <LinearGradient
                    colors={
                      !text.trim() || pending || transcribing
                        ? ["#263142", "#263142"]
                        : ["#B894FF", "#D8C4FF"]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.shareGradient}
                  >
                    {pending ? (
                      <ActivityIndicator color="#081014" />
                    ) : (
                      <Text style={[styles.shareText, shortLayout && styles.shareTextShort]}>Get Insights</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>

              {/* Scrollable feed */}
              <ScrollView
                style={styles.coachFeed}
                contentContainerStyle={styles.coachFeedContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {todayMood && (
                  <View style={[styles.moodChip, shortLayout && styles.moodChipShort]}>
                    <Text style={[styles.moodChipText, shortLayout && styles.moodChipTextShort]}>
                      {todayMood}
                    </Text>
                  </View>
                )}

                {lastDeepInsight && (
                  <View style={[styles.deepCard, shortLayout && styles.deepCardShort]}>
                    <View style={styles.deepHeader}>
                      <Text style={styles.deepBadge}>DeepInsight</Text>
                      {!effectivePremium && <Text style={styles.deepPremium}>PREMIUM</Text>}
                    </View>
                    <Text style={[styles.deepHeadline, shortLayout && styles.deepHeadlineShort]}>
                      {lastDeepInsight?.headline}
                    </Text>
                    <Text style={[styles.deepBody, shortLayout && styles.deepBodyShort]}>
                      {lastDeepInsight?.insight}
                    </Text>
                    <View style={[styles.deepSuggestionBox, shortLayout && styles.deepSuggestionBoxShort]}>
                      <Text style={[styles.deepSuggestionText, shortLayout && styles.deepSuggestionTextShort]}>
                        Tip: {lastDeepInsight?.suggestion}
                      </Text>
                    </View>
                    <Text style={[styles.deepAffirmation, shortLayout && styles.deepAffirmationShort]}>
                      {lastDeepInsight?.affirmation}
                    </Text>
                  </View>
                )}

                {checkIns.filter((c) => c.dateKey === todayKey()).length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {checkIns.filter((c) => c.dateKey === todayKey()).map((c) => (
                      <View key={c.id}>
                        <View style={[styles.userBubble, shortLayout && styles.userBubbleShort]}>
                          <Text style={[styles.userBubbleText, shortLayout && styles.userBubbleTextShort]}>
                            {c.text}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.emptyPrompt, shortLayout && styles.emptyPromptShort]}>
                    Whatever today looked like, it's worth reflecting on.{'\n'}Tranqly is here. No judgment, ever.
                  </Text>
                )}

                {pending && (
                  <View style={styles.typingRow}>
                    <Text style={styles.typingDot}>.</Text>
                    <Text style={styles.typingDot}>.</Text>
                    <Text style={styles.typingDot}>.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          ) : null}

          {tab === "journey" ? (
            <ScrollView
              testID="journey-scroll"
              contentContainerStyle={styles.journeyContent}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={Keyboard.dismiss}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.journeyHeader}>
                <Text style={[styles.monthKicker, themedAccent2]}>Growth Over Time</Text>
                <Text style={[styles.journeyTitle, themedTitle, shortLayout && styles.journeyTitleShort]}>
                  Your journey
                </Text>
                <Text style={[styles.journeySubtitle, themedBody, shortLayout && styles.journeySubtitleShort]}>
                  Watch your growth unfold over time.
                </Text>
              </View>

              <View style={[styles.sanctuaryCard, themedCard]}>
                <View style={styles.sanctuaryCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sanctuaryTitle, themedTitle]}>{selectedSanctuary.label}</Text>
                    <Text style={[styles.sanctuarySubtitle, themedBody]}>Your Sanctuary</Text>
                    <Text style={[styles.sanctuaryProgressText, themedMuted]}>
                      {totalReflectionDays === 0 ? "Your first reflection begins here." : `You've reflected here for ${totalReflectionDays} days.`}
                    </Text>
                  </View>
                  <Pressable
                    testID="journey-explore-sanctuary"
                    accessibilityRole="button"
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setSanctuaryDetailTheme(sanctuaryTheme);
                      setShowSanctuaryModal(true);
                    }}
                    style={[styles.sanctuaryTopButton, themedInk]}
                  >
                    <Text style={[styles.sanctuaryTopButtonText, themedAccent]}>Explore Sanctuary</Text>
                  </Pressable>
                </View>
                <View style={styles.sanctuaryArtworkFrame}>
                  <Image source={selectedSanctuary.artwork} style={styles.sanctuaryArtworkImage} resizeMode="cover" />
                  <LinearGradient
                    colors={["rgba(11,14,20,0)", "rgba(11,14,20,0.82)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={[styles.sanctuaryArtworkText, themedTitle]}>{selectedSanctuary.description}</Text>
                </View>
                <View style={[styles.sanctuaryProgressBox, themedInk]}>
                  <View style={styles.sanctuaryStatBlock}>
                    <SproutStatIcon color={appTheme.accent2} />
                    <View style={styles.sanctuaryStatCopy}>
                      <Text style={[styles.sanctuaryDays, themedAccent2]} numberOfLines={1} adjustsFontSizeToFit>
                        {totalReflectionDays}
                      </Text>
                      <Text style={[styles.sanctuaryProgressText, themedMuted]}>Reflection days</Text>
                    </View>
                  </View>
                  <View style={styles.sanctuaryDivider} />
                  <View style={styles.sanctuaryStatBlock}>
                    <Text style={styles.sanctuaryStatIcon}>Streak</Text>
                    <View style={styles.sanctuaryStatCopy}>
                      <Text style={[styles.sanctuaryDays, themedAccent2]} numberOfLines={1} adjustsFontSizeToFit>{streak}</Text>
                      <Text style={[styles.sanctuaryProgressText, themedMuted]}>Current streak</Text>
                    </View>
                  </View>
                  <View style={styles.sanctuaryDivider} />
                  <View style={styles.sanctuaryUnlockBlock}>
                    <Text style={[styles.sanctuaryProgressText, themedMuted]}>Next Sanctuary</Text>
                    <Text style={[styles.sanctuaryUnlockName, themedTitle]}>
                      {upcomingSanctuary?.label ?? "All sanctuaries"}
                    </Text>
                    <Text style={[styles.sanctuaryNext, themedAccent2]}>
                      {upcomingSanctuary
                        ? `Unlocks in ${reflectionsToNextSanctuary} reflection day${reflectionsToNextSanctuary === 1 ? "" : "s"}`
                        : "Sanctuary collection complete"}
                    </Text>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  setTab("you");
                  setShowThemePicker(true);
                }}
                style={[styles.journeyCard, themedCard]}
              >
                <View style={styles.premiumHeader}>
                  <View>
                    <Text style={[styles.journeySectionTitle, themedAccent2]}>Your Sanctuaries</Text>
                    <Text style={[styles.journeyCardText, themedBody]}>
                      {PRIMARY_SANCTUARY_KEYS.filter((key) => isSanctuaryThemeUnlocked(getSanctuaryTheme(key))).length} of {PRIMARY_SANCTUARY_KEYS.length} discovered
                    </Text>
                  </View>
                  <Text style={[styles.inlinePremiumLink, themedAccent]}>View all</Text>
                </View>
                <Text style={[styles.youCardMuted, themedMuted, { marginTop: 8 }]}>Every 7 lifetime Reflection Days reveals a new sanctuary. Multiple reflections in one day count once, and missing a day never removes progress.</Text>
                {upcomingSanctuary ? (
                  <View style={[styles.authSummaryCard, themedInk, { marginTop: 12 }]}> 
                    <Text style={[styles.authSummaryLabel, themedAccent2]}>Next sanctuary</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
                      <Image source={upcomingSanctuary.artwork} style={{ width: 58, height: 58, borderRadius: 14 }} resizeMode="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.authSummaryValue, themedTitle]}>{upcomingSanctuary.label}</Text>
                        <Text style={[styles.youCardMuted, themedMuted]}>{totalReflectionDays} / {upcomingSanctuary.unlockDays} reflection days</Text>
                        <Text style={[styles.inlinePremiumLink, themedAccent]}>{reflectionsToNextSanctuary} more reflection day{reflectionsToNextSanctuary === 1 ? "" : "s"} to unlock</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                style={[styles.journeyPremiumCard, themedWeekly]}
                onPress={() => {
                  if (!weeklyInsights.length) return;
                  setSelectedWeeklyInsight(weeklyInsights[0]);
                  setShowJourneyDeepInsight(true);
                }}
              >
                <View style={styles.premiumHeader}>
                  <View>
                    <Text style={[styles.journeySectionTitle, themedAccent2]}>Weekly Reflection</Text>
                    <Text style={[styles.journeyCardText, themedBody]}>
                      {weeklyInsights.length
                        ? "Your latest weekly reflection is ready."
                        : weeklyReflectionDays >= 3
                          ? "Your weekly reflection arrives Sunday."
                          : "Your weekly reflection is still building. A few more check-ins will help Tranqly uncover meaningful patterns."}
                    </Text>
                  </View>
                  <Text style={[styles.youCardMuted, themedMuted]}>Sunday</Text>
                </View>
                <View style={styles.fitWeeklyProgress}>
                  {Array.from({ length: 3 }, (_, index) => {
                    return <View key={index} style={[styles.fitWeeklyProgressSegment, { backgroundColor: index < weeklyReflectionDays ? appTheme.accent : appTheme.ink }]} />;
                  })}
                </View>
                <Text style={[styles.youCardMuted, themedMuted]}>{weeklyReflectionDays} Reflection Day{weeklyReflectionDays === 1 ? "" : "s"} this week</Text>
                {weeklyInsights.length ? (
                  <Text style={[styles.inlinePremiumLink, themedAccent]}>{weeklyInsights.length > 1 ? "View Weekly Reflection History" : "Read Weekly Reflection"}</Text>
                ) : null}
              </Pressable>

              <View style={[styles.monthCard, themedCard]}>
                <Text style={[styles.monthKicker, themedAccent2]}>This Month's Growth</Text>
                <View style={styles.monthGrid}>
                  <View style={[styles.monthTile, themedInk]}>
                    <View style={styles.monthIconWrap}>
                      <MonthIcon type="calm" size={58} />
                    </View>
                    <Text style={[styles.monthLabel, { color: monthIconColors.calm }]}>Calm</Text>
                    <Text style={[styles.monthValue, themedTitle]}>{monthStats.calm}</Text>
                  </View>
                  <View style={[styles.monthTile, themedInk]}>
                    <View style={styles.monthIconWrap}>
                      <MonthIcon type="consistency" size={58} />
                    </View>
                    <Text style={[styles.monthLabel, { color: monthIconColors.consistency }]}>Consistency</Text>
                    <Text style={[styles.monthValue, themedTitle]}>{monthStats.consistency}</Text>
                  </View>
                  <View style={[styles.monthTile, themedInk]}>
                    <View style={styles.monthIconWrap}>
                      <MonthIcon type="gratitude" size={58} />
                    </View>
                    <Text style={[styles.monthLabel, { color: monthIconColors.gratitude }]}>Gratitude</Text>
                    <Text style={[styles.monthValue, themedTitle]}>{monthStats.gratitude}</Text>
                  </View>
                  <View style={[styles.monthTile, themedInk]}>
                    <View style={styles.monthIconWrap}>
                      <MonthIcon type="stress" size={58} />
                    </View>
                    <Text style={[styles.monthLabel, { color: monthIconColors.stress }]}>Stress</Text>
                    <Text style={[styles.monthValue, themedTitle]}>{monthStats.stress}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.journeyCard, themedCard]}>
                <Text style={[styles.journeySectionTitle, themedAccent2]}>Patterns I've Noticed</Text>
                <View style={{ marginTop: 10, gap: 8 }}>
                  {journeyMemory.memoryFacts.map((fact) => (
                    <Pressable key={fact} onPress={() => Alert.alert("Pattern I've Noticed", `${fact}\n\nThis is a gentle observation from your recent reflections, not a definitive conclusion.`)} style={[styles.patternObservationRow, themedInk]}>
                      <Text style={[styles.patternObservationCheck, themedAccent]}>›</Text>
                      <Text style={[styles.journeyCardText, themedBody, { flex: 1 }]}>{fact}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.journeyUpdated, themedMuted]}>Updated today</Text>
              </View>

              {false && lastDeepInsight && (
                <View style={[styles.deepCard, { marginBottom: 16 }, shortLayout && styles.deepCardShort]}>
                  <View style={styles.deepHeader}>
                    <Text style={styles.deepBadge}>DeepInsight</Text>
                    {!effectivePremium && <Text style={styles.deepPremium}>PREMIUM</Text>}
                  </View>
                  <Text style={[styles.deepHeadline, shortLayout && styles.deepHeadlineShort]}>
                    {lastDeepInsight?.headline}
                  </Text>
                  <Text style={[styles.deepBody, shortLayout && styles.deepBodyShort]}>
                    {lastDeepInsight?.insight}
                  </Text>
                  <View style={[styles.deepSuggestionBox, shortLayout && styles.deepSuggestionBoxShort]}>
                    <Text style={[styles.deepSuggestionText, shortLayout && styles.deepSuggestionTextShort]}>
                      Tip: {lastDeepInsight?.suggestion}
                    </Text>
                  </View>
                  <Text style={[styles.deepAffirmation, shortLayout && styles.deepAffirmationShort]}>
                    {lastDeepInsight?.affirmation}
                  </Text>
                </View>
              )}
{false && <View style={styles.journeyCard}>
                <Text style={styles.journeySectionTitle}>Monthly Patterns</Text>
                <View style={styles.patternGrid}>
                  {["Stress trend", "Gratitude trend", "Motivation trend", "Work and family themes"].map((item) => (
                    <View key={item} style={styles.patternTile}>
                      <Text style={styles.patternText}>{item}</Text>
                    </View>
                  ))}
                </View>
                <Pressable onPress={openPremium}>
                  <Text style={styles.inlinePremiumLink}>Unlock monthly patterns</Text>
                </Pressable>
              </View>}

              {false && <View style={styles.journeyCard}>
                <Text style={styles.journeySectionTitle}>Milestones</Text>
                <View style={styles.milestoneRow}>
                  {["7 check-ins", "First weekly insight", "Most reflective week", "Biggest personal win"].map((item) => (
                    <View key={item} style={styles.milestonePill}>
                      <Text style={styles.milestoneText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>}

              {false && <View style={styles.askCard}>
                <Text style={styles.askTitle}>Ask Tranqly</Text>
                <Text style={styles.journeyCardText}>
                  Ask questions about your reflection history, like what keeps stressing you out or what helped you feel better this month.
                </Text>
                <Pressable
                  onPress={openPremium}
                  style={styles.askButton}
                >
                  <Text style={styles.askButtonText}>Unlock Ask Tranqly</Text>
                </Pressable>
              </View>}

              {/* Recent reflections */}
              {grouped.length === 0 ? (
                <View style={[styles.emptyState, shortLayout && styles.emptyStateShort]}>
                  <Text style={[styles.emptyText, shortLayout && styles.emptyTextShort]}>
                    No entries yet. Start your journey today.
                  </Text>
                </View>
              ) : (
                <View style={{ paddingBottom: 100 }}>
                  <Text style={[styles.journeySectionTitle, themedAccent2]}>Recent Reflections</Text>
                  {recentJourneyGroups.map(({ dateKey, entries }) => (
                    <View key={dateKey} style={styles.historyGroup}>
                      <Text style={[styles.historyDateHeader, themedMuted, shortLayout && styles.historyDateHeaderShort]}>
                        {dateKey === today ? "Today" : formatDate(dateKey)}
                      </Text>
                      {entries.map((c) => (
                        <View key={c.id} style={[styles.historyItem, themedCard]}>
                          <Text style={[styles.date, themedMuted]}>
                            {formatTime(c.createdAt)}
                          </Text>
                          <Text style={[styles.historyText, themedBody]}>{c.text}</Text>
                          <View style={styles.journeyChipRow}>
                            {journeyTagsForText(c.text).map((tag) => (
                              <View key={tag.key} style={[styles.journeyMiniChip, { backgroundColor: appTheme.helperBg, borderColor: appTheme.helperEdge }]}>
                                <JourneyTagIcon type={tag.key} color={appTheme.faint} />
                                <Text style={[styles.journeyMiniChipText, themedAccent]}>{tag.label}</Text>
                              </View>
                            ))}
                          </View>
                          {c.reply && (
                            <Pressable
                              onPress={() => openCoachModal(c.text, c.reply!)}
                              style={({ pressed }) => [
                                styles.coachReplyIndicator,
                                { backgroundColor: appTheme.helperBg, borderColor: appTheme.helperEdge },
                                pressed && { opacity: 0.7 },
                              ]}
                            >
                              <Text style={[styles.coachReplyIndicatorText, themedAccent]}>View Tranqly Response</Text>
                              <Text style={[styles.coachReplyArrow, themedAccent]}>›</Text>
                            </Pressable>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                  {checkIns.length > 5 ? (
                    <Pressable
                      style={[styles.fitWeeklyButton, { backgroundColor: appTheme.button }]}
                      onPress={() => setShowAllReflections((value) => !value)}
                    >
                      <Text style={[styles.fitWeeklyButtonText, themedTitle]}>
                        {showAllReflections ? "Show recent" : "View all reflections"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}


                          </ScrollView>
          ) : null}

          {tab === "you" ? (
            <ScrollView
              testID="you-scroll"
              contentContainerStyle={styles.youContent}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={Keyboard.dismiss}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.youHeader}>
                <Text style={[styles.youTitle, themedTitle, shortLayout && styles.youTitleShort]}>You</Text>
              </View>

              <View style={[styles.youCard, themedCard]}>
                <Text style={[styles.youSectionTitle, themedAccent2]}>Preferences</Text>
                <Text style={[styles.youInputLabel, themedTitle]}>Your name</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="What should Tranqly call you?"
                  placeholderTextColor={appTheme.faint}
                  style={[styles.youInput, themedInk, themedTitle]}
                />
              </View>

              <View style={[styles.youCard, themedCard]}>
                <Text style={[styles.youSectionTitle, themedAccent2]}>Your Sanctuary</Text>
                <View style={styles.currentSanctuaryBanner}>
                  <Image source={selectedSanctuary.artwork} style={styles.currentSanctuaryImage} resizeMode="cover" />
                  <LinearGradient colors={["rgba(11,14,20,0.12)", "rgba(11,14,20,0.88)"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.currentSanctuaryCopy}>
                    <View style={[styles.sanctuaryThemeIconWrap, { borderColor: selectedSanctuary.accent }]}>
                      <ThemeIcon type={selectedSanctuary.key} color={selectedSanctuary.accent} size={22} />
                    </View>
                    <Text style={styles.currentSanctuaryTitle}>{selectedSanctuary.label}</Text>
                    <Text style={styles.currentSanctuaryText} numberOfLines={2}>{selectedSanctuary.description}</Text>
                    <Text style={[styles.currentSanctuaryBadge, { color: selectedSanctuary.accent }]}>Selected</Text>
                  </View>
                </View>
                <View style={styles.currentSanctuaryActions}>
                  <Pressable testID="change-sanctuary" accessibilityRole="button" onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowThemePicker(true); }} style={[styles.themePreviewButton, { flex: 1, backgroundColor: appTheme.helperBg, borderColor: appTheme.edge }]}> 
                    <Text style={[styles.themePreviewButtonText, themedAccent]}>Change Sanctuary</Text>
                  </Pressable>
                  <Pressable onPress={() => { setSanctuaryDetailTheme(sanctuaryTheme); setShowSanctuaryModal(true); }} style={[styles.themePreviewButton, { flex: 1, backgroundColor: appTheme.helperBg, borderColor: appTheme.edge }]}>
                    <Text style={[styles.themePreviewButtonText, themedAccent]}>Explore Sanctuary</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.youCard, themedCard]}>
                <View style={styles.authCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.youSectionTitle, themedAccent2]}>Account</Text>
                    <Text style={[styles.youCardBody, themedBody]}>
                      {authUser
                        ? `Signed in with ${mobileAuthProviderLabel(authUser)} as ${authUser.email}.`
                        : "Sign in to manage your Tranqly account. Saved reflections remain on this device."}
                    </Text>
                  </View>
                  <Text style={[styles.authStatusPill, { borderColor: appTheme.edge, color: appTheme.accent }]}>
                    {authUser ? "Connected" : "Local"}
                  </Text>
                </View>
                {authUser ? (
                  <View style={styles.authForm}>
                    <View style={[styles.authSummaryCard, themedInk]}>
                      <Text style={[styles.authSummaryLabel, themedAccent2]}>Signed in as</Text>
                      <Text style={[styles.authSummaryValue, themedTitle]}>{authUser.email}</Text>
                      <Text style={[styles.authSummaryLabel, themedAccent2, { marginTop: 12 }]}>Sign-in method</Text>
                      <Text style={[styles.authSummaryValue, themedTitle]}>{mobileAuthProviderLabel(authUser)}</Text>
                      <Text style={[styles.youCardMuted, themedMuted]}>
                        Your Tranqly account is connected on this device.
                      </Text>
                    </View>
                    <View style={styles.authButtonRow}>
                      <Pressable
                        style={[styles.authSecondaryButton, { borderColor: appTheme.edge }]}
                        onPress={() => setAuthNotice("Your Tranqly account is already connected on this device.")}
                      >
                        <Text style={[styles.authSecondaryText, themedAccent]}>Manage account</Text>
                      </Pressable>
                      <Pressable style={[styles.authPrimaryButton, { backgroundColor: appTheme.button }]} onPress={signOutMobile}>
                        <Text style={[styles.authPrimaryText, themedTitle]}>Sign out</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.authForm}>
                    {Platform.OS === "ios" ? (
                      <AppleAuthentication.AppleAuthenticationButton
                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                        cornerRadius={14}
                        style={{ width: "100%", height: 52, opacity: authBusy ? 0.55 : 1 }}
                        onPress={() => void signInWithApple()}
                      />
                    ) : null}
                    {(Platform.OS === "ios" && GOOGLE_IOS_CLIENT_ID) || (Platform.OS === "web" && GOOGLE_WEB_CLIENT_ID) ? (
                      <GoogleAccountButton
                        busy={authBusy}
                        borderColor={appTheme.edge}
                        backgroundColor={appTheme.ink}
                        textColor={appTheme.fg}
                        onCredential={(idToken, accessToken) => void signInWithGoogleCredential(idToken, accessToken)}
                        onError={setAuthNotice}
                      />
                    ) : (
                      <Pressable
                        style={[styles.authProviderButton, { borderColor: appTheme.edge, backgroundColor: appTheme.ink }]}
                        onPress={() => setAuthNotice("Google Sign In needs its public OAuth client ID in this build.")}
                      >
                        <GoogleProviderIcon />
                        <Text style={[styles.authSecondaryText, themedAccent]}>Continue with Google</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={[styles.authPrimaryButton, { backgroundColor: appTheme.button }]}
                      onPress={() => {
                        setShowEmailAuth((value) => !value);
                        setAuthNotice("");
                      }}
                    >
                      <Text style={[styles.authPrimaryText, themedTitle]}>Continue with Email</Text>
                    </Pressable>
                    {showEmailAuth ? (
                      <View style={[styles.authEmailCard, themedInk]}>
                        <TextInput
                          value={authEmail}
                          onChangeText={setAuthEmail}
                          placeholder="Email"
                          placeholderTextColor={appTheme.faint}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                          style={[styles.youInput, { backgroundColor: appTheme.card, color: appTheme.fg, borderColor: appTheme.edge }]}
                        />
                        <TextInput
                          value={authPassword}
                          onChangeText={setAuthPassword}
                          placeholder="Password"
                          placeholderTextColor={appTheme.faint}
                          secureTextEntry
                          style={[styles.youInput, { backgroundColor: appTheme.card, color: appTheme.fg, borderColor: appTheme.edge }]}
                        />
                        <View style={[styles.authSummaryCard, { backgroundColor: appTheme.card, borderColor: appTheme.edge }]}>
                          <View style={styles.passwordHeaderRow}>
                            <Text style={[styles.authSummaryLabel, themedAccent2]}>Password</Text>
                            <Text style={[styles.youCardMuted, themedMuted]}>{passwordStrength}</Text>
                          </View>
                          {passwordRules.map((rule) => (
                            <Text key={rule.key} style={[styles.passwordRuleText, rule.met ? themedAccent : themedMuted]}>
                              {rule.met ? "✓" : "○"} {rule.label}
                            </Text>
                          ))}
                        </View>
                        <View style={styles.authButtonRow}>
                          <Pressable
                            disabled={authBusy}
                            style={[styles.authPrimaryButton, { backgroundColor: appTheme.button }, authBusy && { opacity: 0.6 }]}
                            onPress={() => submitMobileAuth("signIn")}
                          >
                            <Text style={[styles.authPrimaryText, themedTitle]}>{authBusy ? "Working..." : "Sign in"}</Text>
                          </Pressable>
                          <Pressable
                            disabled={authBusy || !isPasswordValid(authPassword)}
                            style={[styles.authSecondaryButton, { borderColor: appTheme.edge }, (authBusy || !isPasswordValid(authPassword)) && { opacity: 0.5 }]}
                            onPress={() => submitMobileAuth("signUp")}
                          >
                            <Text style={[styles.authSecondaryText, themedAccent]}>Create account</Text>
                          </Pressable>
                        </View>
                        <View style={styles.authMetaActions}>
                          <Pressable onPress={sendMobilePasswordReset}>
                            <Text style={[styles.authMetaText, themedAccent]}>Forgot password</Text>
                          </Pressable>
                          <Pressable onPress={() => setShowEmailAuth(false)}>
                            <Text style={[styles.authMetaText, themedMuted]}>Back to sign-in options</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                )}
                {authNotice ? <Text style={[styles.youCardMuted, themedMuted]}>{authNotice}</Text> : null}
              </View>

              <View testID="subscription-plan-card" style={[styles.youCard, themedWeekly]}>
                <View style={styles.authCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.youSectionTitle, themedAccent2]}>Your Tranqly Plan</Text>
                    <Text style={[styles.youCardBody, themedBody]}>
                      {premium
                        ? activePaidPlan === "monthly"
                          ? "Your journey continues month to month. Move to yearly whenever you want a simpler annual plan."
                          : activePaidPlan === "yearly"
                            ? "Your yearly plan keeps thoughtful insights, weekly reflections, and every sanctuary open to you."
                            : "Tranqly Plus is active. Your reflections can keep building into more personal insights over time."
                        : complimentaryAccess?.status === "active"
                          ? "Your first week includes the full Tranqly experience. Choose a plan anytime if you would like to continue after it ends."
                          : "Reflect freely, then continue with Plus when you want unlimited insights, weekly reflections, and every sanctuary."}
                    </Text>
                  </View>
                  <Text style={[styles.authStatusPill, { borderColor: appTheme.helperEdge, color: appTheme.accent }]}>
                    {subscriptionStatusLabel}
                  </Text>
                </View>

                {premium ? (
                  <View style={styles.authForm}>
                    <View style={[styles.subscriptionPlanSummary, themedInk, { borderColor: appTheme.edge }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.authSummaryLabel, themedAccent2]}>
                          {activePaidPlan === "monthly" ? "Monthly plan" : activePaidPlan === "yearly" ? "Yearly plan" : "Tranqly Plus"}
                        </Text>
                        <Text style={[styles.subscriptionPlanPrice, themedTitle]}>
                          {activePaidPlan === "monthly"
                            ? storePrices.monthly ? `${storePrices.monthly} per month` : "Active through the App Store"
                            : activePaidPlan === "yearly"
                              ? storePrices.yearly ? `${storePrices.yearly} per year` : "Active through the App Store"
                              : "Active through the App Store"}
                        </Text>
                      </View>
                      <CompletionCheckMark color={appTheme.accent2} size={22} />
                    </View>
                    {activePaidPlan === "monthly" ? (
                      <Pressable
                        testID="settings-switch-yearly"
                        accessibilityRole="button"
                        onPress={() => {
                          setSelectedPlan("yearly");
                          setShowPremiumModal(true);
                        }}
                        style={[styles.authPrimaryButton, { backgroundColor: appTheme.button }]}
                      >
                        <Text style={[styles.authPrimaryText, themedTitle]}>Switch to Yearly</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void manageAppStoreSubscription()}
                      style={[styles.authSecondaryButton, { borderColor: appTheme.edge }]}
                    >
                      <Text style={[styles.authSecondaryText, themedAccent]}>Manage Subscription</Text>
                    </Pressable>
                    <Text style={[styles.youCardMuted, themedMuted, { marginTop: 0 }]}>Apple confirms all plan changes before billing.</Text>
                  </View>
                ) : (
                  <View style={styles.authForm}>
                    <View style={styles.premiumPlanGrid}>
                      <Pressable
                        testID="settings-plan-yearly"
                        accessibilityRole="button"
                        onPress={() => {
                          setSelectedPlan("yearly");
                          setShowPremiumModal(true);
                        }}
                        style={[styles.premiumPlanCard, { borderColor: appTheme.accent, backgroundColor: appTheme.helperBg }]}
                      >
                        <View style={styles.premiumPlanHeader}>
                          <Text style={[styles.premiumPlanName, themedTitle]}>Yearly</Text>
                          <Text style={[styles.premiumPlanBadge, themedAccent2]}>BEST VALUE</Text>
                        </View>
                        <Text style={[styles.premiumPlanPrice, themedTitle]}>{storePrices.yearly ? `${storePrices.yearly} per year` : "View plan"}</Text>
                        <Text style={[styles.premiumPlanDetail, themedMuted]}>One calm year of Tranqly Plus.</Text>
                      </Pressable>
                      <Pressable
                        testID="settings-plan-monthly"
                        accessibilityRole="button"
                        onPress={() => {
                          setSelectedPlan("monthly");
                          setShowPremiumModal(true);
                        }}
                        style={[styles.premiumPlanCard, { borderColor: appTheme.edge }]}
                      >
                        <Text style={[styles.premiumPlanName, themedTitle]}>Monthly</Text>
                        <Text style={[styles.premiumPlanPrice, themedTitle]}>{storePrices.monthly ? `${storePrices.monthly} per month` : "View plan"}</Text>
                        <Text style={[styles.premiumPlanDetail, themedMuted]}>Continue one month at a time.</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void restoreAppStorePurchases()}
                      disabled={checkoutBusy || (Platform.OS === "ios" && !purchasesReady)}
                      style={[styles.subscriptionRestoreButton, { borderColor: appTheme.edge }]}
                    >
                      <Text style={[styles.authMetaText, themedMuted]}>Restore an existing purchase</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={[styles.youCard, themedCard]}>
                <View style={styles.authCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.youSectionTitle, themedAccent2]}>Notifications</Text>
                    <Text style={[styles.youCardBody, themedBody]}>
                      Gentle reminders for reflections, weekly insights, and new sanctuaries.
                    </Text>
                  </View>
                  <Text style={[styles.authStatusPill, { borderColor: appTheme.edge, color: appTheme.accent }]}>
                    {notificationStatusLabel}
                  </Text>
                </View>
                {!notificationsExpanded ? (
                  <View style={[styles.authSummaryCard, themedInk, { marginTop: 14 }]}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notificationLabel, themedTitle]}>Daily reflection reminder</Text>
                        <Text style={[styles.youCardMuted, themedMuted]}>
                          {notificationSettings.dailyReminderEnabled
                            ? `${formatHourLabel(notificationSettings.dailyReminderTime)} • ${QUIET_MINUTE_OPTIONS.find((option) => option.key === notificationSettings.quietMinuteOption)?.label ?? "Custom"}`
                            : "Off"}
                        </Text>
                        <View style={{ gap: 6, marginTop: 10 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={[styles.themePickerSmallText, themedMuted]}>Weekly Reflection</Text><Text style={[styles.themePickerSmallText, themedAccent]}>{notificationSettings.weeklyInsightEnabled ? "On" : "Off"}</Text></View>
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={[styles.themePickerSmallText, themedMuted]}>Sanctuary Unlocks</Text><Text style={[styles.themePickerSmallText, themedAccent]}>{notificationSettings.sanctuaryUnlockEnabled ? "On" : "Off"}</Text></View>
                        </View>
                      </View>
                      <Pressable
                        testID="notifications-edit"
                        onPress={() => setNotificationsExpanded(true)}
                        style={[styles.themePickerSmallButton, { borderColor: appTheme.edge }]}
                      >
                        <Text style={[styles.themePickerSmallText, themedAccent]}>Edit</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.authForm}>
                    {notificationSettings.permissionStatus !== "granted" ? (
                      <Pressable
                        style={[styles.authPrimaryButton, { backgroundColor: appTheme.button, marginTop: 4 }]}
                        onPress={async () => {
                          const result = await requestNotificationPermission();
                          if (result === "granted") {
                            setNotificationDraft((current) => ({
                              ...current,
                              permissionStatus: "granted",
                              dailyReminderEnabled: true,
                            }));
                          }
                        }}
                      >
                        <Text style={[styles.authPrimaryText, themedTitle]}>Enable reminders</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={[styles.notificationRow, themedInk]}
                      onPress={() =>
                        setNotificationDraft((current) => ({
                          ...current,
                          dailyReminderEnabled: !current.dailyReminderEnabled,
                        }))
                      }
                    >
                      <Text style={[styles.notificationLabel, themedTitle]}>Daily reflection reminder</Text>
                      <Text style={[styles.notificationValue, themedAccent]}>
                        {notificationDraft.dailyReminderEnabled ? "On" : "Off"}
                      </Text>
                    </Pressable>
                    <View style={styles.notificationOptionsWrap}>
                      {QUIET_MINUTE_OPTIONS.map((option) => (
                        <Pressable
                          testID={`notification-option-${option.key}`}
                          accessibilityRole="button"
                          accessibilityLabel={`${option.label} reminder time`}
                          accessibilityState={{ selected: notificationDraft.quietMinuteOption === option.key }}
                          key={option.key}
                          style={[
                            styles.notificationOptionChip,
                            {
                              borderColor:
                                notificationDraft.quietMinuteOption === option.key
                                  ? appTheme.accent
                                  : appTheme.edge,
                              backgroundColor:
                                notificationDraft.quietMinuteOption === option.key
                                  ? appTheme.helperBg
                                  : appTheme.ink,
                            },
                          ]}
                          onPress={() => {
                            setNotificationDraft((current) => ({
                              ...current,
                              quietMinuteOption: option.key,
                              dailyReminderTime:
                                option.key === "custom" ? current.dailyReminderTime : option.suggestedTime,
                            }));
                            if (option.key === "custom") {
                              setReminderTimeDraft(dateFromReminderTime(notificationDraft.dailyReminderTime));
                              setShowReminderTimePicker(true);
                            }
                          }}
                        >
                          <Text style={[styles.notificationOptionText, notificationDraft.quietMinuteOption === option.key ? themedAccent : themedMuted]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      testID="reminder-time-row"
                      accessibilityRole="button"
                      accessibilityLabel={`Reminder time, ${formatHourLabel(notificationDraft.dailyReminderTime)}`}
                      style={[styles.notificationRow, themedInk]}
                      onPress={() => {
                        setNotificationDraft((current) => ({ ...current, quietMinuteOption: "custom" }));
                        setReminderTimeDraft(dateFromReminderTime(notificationDraft.dailyReminderTime));
                        setShowReminderTimePicker(true);
                      }}
                    >
                      <Text style={[styles.notificationLabel, themedTitle]}>Reminder time</Text>
                      <Text style={[styles.notificationValue, themedAccent]}>
                        {formatHourLabel(notificationDraft.dailyReminderTime)} ›
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.notificationRow, themedInk]}
                      onPress={() =>
                        setNotificationDraft((current) => ({
                          ...current,
                          weeklyInsightEnabled: !current.weeklyInsightEnabled,
                        }))
                      }
                    >
                      <Text style={[styles.notificationLabel, themedTitle]}>Weekly insight reminder</Text>
                      <Text style={[styles.notificationValue, themedAccent]}>
                        {notificationDraft.weeklyInsightEnabled ? `Sunday ${formatHourLabel(notificationDraft.weeklyInsightTime)}` : "Off"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.notificationRow, themedInk]}
                      onPress={() =>
                        setNotificationDraft((current) => ({
                          ...current,
                          sanctuaryUnlockEnabled: !current.sanctuaryUnlockEnabled,
                        }))
                      }
                    >
                      <Text style={[styles.notificationLabel, themedTitle]}>Sanctuary unlocks</Text>
                      <Text style={[styles.notificationValue, themedAccent]}>
                        {notificationDraft.sanctuaryUnlockEnabled ? "On" : "Off"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.notificationRow, themedInk]}
                      onPress={() =>
                        setNotificationDraft((current) => ({
                          ...current,
                          quietHoursEnabled: !current.quietHoursEnabled,
                        }))
                      }
                    >
                      <Text style={[styles.notificationLabel, themedTitle]}>Quiet hours</Text>
                      <Text style={[styles.notificationValue, themedAccent]}>
                        {notificationDraft.quietHoursEnabled
                          ? `${formatHourLabel(notificationDraft.quietHoursStart)} to ${formatHourLabel(notificationDraft.quietHoursEnd)}`
                          : "Off"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.notificationRow, themedInk]}
                      onPress={() =>
                        setNotificationDraft((current) => ({
                          ...current,
                          pauseReminders: !current.pauseReminders,
                        }))
                      }
                    >
                      <Text style={[styles.notificationLabel, themedTitle]}>Pause reminders</Text>
                      <Text style={[styles.notificationValue, themedAccent]}>
                        {notificationDraft.pauseReminders ? "Paused" : "Active"}
                      </Text>
                    </Pressable>
                    {reminderSuggestion ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={recording ? "Microphone recording, double tap to stop" : "Microphone, double tap to begin recording"}
                        accessibilityState={{ disabled: transcribing || pending }}
                        style={[styles.authSummaryCard, themedInk]}
                        onPress={() =>
                          setNotificationDraft((current) => ({
                            ...current,
                            reminderMode: "adaptive",
                            dailyReminderTime: reminderSuggestion.time,
                          }))
                        }
                      >
                        <Text style={[styles.authSummaryLabel, themedAccent2]}>Adaptive suggestion</Text>
                        <Text style={[styles.youCardMuted, themedMuted]}>{reminderSuggestion.copy}</Text>
                      </Pressable>
                    ) : null}
                    <View style={[styles.authButtonRow, { marginTop: 6 }]}>
                      <Pressable
                        style={[styles.authSecondaryButton, { borderColor: appTheme.edge }]}
                        onPress={() => {
                          setNotificationDraft(notificationSettings);
                          setNotificationsExpanded(false);
                        }}
                      >
                        <Text style={[styles.authSecondaryText, themedAccent]}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        testID="save-notification-settings"
                        style={[styles.authPrimaryButton, { backgroundColor: appTheme.button }]}
                        onPress={() => {
                          void saveMobileNotificationSettings();
                        }}
                      >
                        <Text style={[styles.authPrimaryText, themedTitle]}>Save</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>

              {false && <View style={[styles.youCard, themedCard]}>
                <Text style={[styles.youSectionTitle, themedAccent2]}>Your Sanctuary</Text>
                <View style={styles.currentSanctuaryBanner}>
                  <Image source={selectedSanctuary.artwork} style={styles.currentSanctuaryImage} resizeMode="cover" />
                  <LinearGradient
                    colors={["rgba(11,14,20,0.12)", "rgba(11,14,20,0.88)"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.currentSanctuaryCopy}>
                    <View style={[styles.sanctuaryThemeIconWrap, { borderColor: selectedSanctuary.accent }]}>
                      <ThemeIcon type={selectedSanctuary.key} color={selectedSanctuary.accent} size={22} />
                    </View>
                    <Text style={styles.currentSanctuaryTitle}>{selectedSanctuary.label}</Text>
                    <Text style={styles.currentSanctuaryText} numberOfLines={2}>{selectedSanctuary.description}</Text>
                    <Text style={[styles.currentSanctuaryBadge, { color: selectedSanctuary.accent }]}>Selected</Text>
                  </View>
                </View>
                <View style={styles.currentSanctuaryActions}>
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowThemePicker(true);
                    }}
                    style={[styles.themePreviewButton, { flex: 1, backgroundColor: appTheme.helperBg, borderColor: appTheme.edge }]}
                  >
                    <Text style={[styles.themePreviewButtonText, themedAccent]}>Change Sanctuary</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setSanctuaryDetailTheme(sanctuaryTheme);
                      setShowSanctuaryModal(true);
                    }}
                    style={[styles.themePreviewButton, { flex: 1, backgroundColor: appTheme.helperBg, borderColor: appTheme.edge }]}
                  >
                    <Text style={[styles.themePreviewButtonText, themedAccent]}>Explore Sanctuary</Text>
                  </Pressable>
                </View>
              </View>}

              <Modal
                visible={showThemePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowThemePicker(false)}
              >
                <View style={styles.themeModalBackdrop}>
                  <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowThemePicker(false)} />
                  <View style={[styles.themePickerCard, themedCard]}>
                    <View style={styles.themePickerHeader}>
                      <View>
                        <Text style={[styles.themePreviewBadge, themedAccent]}>Choose Sanctuary</Text>
                        <Text style={[styles.themePreviewTitle, themedTitle]}>Your Sanctuaries</Text>
                      </View>
                      <Pressable testID="close-theme-picker" accessibilityRole="button" accessibilityLabel="Close sanctuary picker" onPress={() => setShowThemePicker(false)} style={styles.themeModalClose}>
                        <Text style={[styles.themeModalCloseText, themedMuted]}>x</Text>
                      </Pressable>
                    </View>
                    <ScrollView testID="theme-picker-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 18 }}>
                      {[
                        ["Current", sanctuaryThemesByUnlock().filter((theme) => theme.key === sanctuaryTheme)],
                        ["Available", sanctuaryThemesByUnlock().filter((theme) => theme.key !== sanctuaryTheme && theme.unlockType !== "seasonal" && isSanctuaryThemeUnlocked(theme))],
                        ["Growing", sanctuaryThemesByUnlock().filter((theme) => theme.unlockType === "reflections" && !isSanctuaryThemeUnlocked(theme)).slice(0, 2)],
                        ["Locked", sanctuaryThemesByUnlock().filter((theme) => theme.unlockType === "reflections" && !isSanctuaryThemeUnlocked(theme)).slice(2)],
                        ["Seasonal", sanctuaryThemesByUnlock().filter((theme) => theme.unlockType === "seasonal")],
                      ].map(([label, rawThemes]) => {
                        const themes = rawThemes as typeof SANCTUARY_THEMES;
                        if (!themes.length) return null;
                        return (
                          <View key={label as string} style={styles.themePickerSection}>
                            <Text style={[styles.youSectionTitle, themedAccent2]}>{label as string}</Text>
                            <View style={styles.themePickerGrid}>
                              {themes.map((theme) => {
                                const unlocked = isSanctuaryThemeUnlocked(theme);
                                return (
                                  <Pressable
                                    key={theme.key}
                                    onPress={() => {
                                      setSanctuaryDetailTheme(theme.key);
                                      setShowThemePreview(true);
                                    }}
                                    style={({ pressed }) => [
                                      styles.themePickerTile,
                                      themedInk,
                                      !unlocked && { opacity: 0.72 },
                                      pressed && { opacity: 0.85 },
                                    ]}
                                  >
                                    <Image source={theme.artwork} style={styles.themePickerImage} resizeMode="cover" />
                                    <LinearGradient colors={["rgba(11,14,20,0)", "rgba(11,14,20,0.82)"]} style={StyleSheet.absoluteFill} />
                                    <View style={styles.themePickerTileCopy}>
                                      <ThemeIcon type={theme.key} color={theme.accent} size={22} />
                                      <Text style={styles.themePickerTileTitle}>{theme.label}</Text>
                                      <Text style={styles.themePickerTileSub} numberOfLines={1}>
                                        {unlocked ? theme.feeling : sanctuaryThemeProgressLabel(theme)}
                                      </Text>
                                      {!unlocked && theme.unlockType === "reflections" ? (
                                        <View
                                          accessibilityRole="progressbar"
                                          accessibilityValue={{ min: 0, max: theme.unlockDays, now: Math.min(totalReflectionDays, theme.unlockDays) }}
                                          style={{ height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.14)", marginTop: 7 }}
                                        >
                                          <View
                                            style={{
                                              width: `${Math.min(100, (totalReflectionDays / Math.max(1, theme.unlockDays)) * 100)}%`,
                                              height: "100%",
                                              borderRadius: 2,
                                              backgroundColor: theme.accent,
                                            }}
                                          />
                                        </View>
                                      ) : null}
                                      <View style={styles.themePickerActions}>
                                        <Pressable
                                          onPress={(event) => {
                                            event.stopPropagation();
                                            setSanctuaryDetailTheme(theme.key);
                                            setShowThemePreview(true);
                                          }}
                                          style={styles.themePickerSmallButton}
                                        >
                                          <Text style={[styles.themePickerSmallText, { color: theme.accent }]}>Preview</Text>
                                        </Pressable>
                                        <Pressable
                                          disabled={!unlocked}
                                          onPress={(event) => {
                                            event.stopPropagation();
                                            setSanctuaryTheme(theme.key);
                                            setDraftSanctuaryTheme(theme.key);
                                            setShowThemePicker(false);
                                          }}
                                          style={[styles.themePickerSmallButton, !unlocked && { opacity: 0.45 }]}
                                        >
                                          <Text style={[styles.themePickerSmallText, { color: unlocked ? theme.accent : appTheme.faint }]}>
                                            {sanctuaryTheme === theme.key ? "Selected" : unlocked ? "Select" : "Locked"}
                                          </Text>
                                        </Pressable>
                                      </View>
                                    </View>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              {(() => {
                const selected = detailSanctuary;
                return (
                  <Modal
                    visible={showThemePreview}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowThemePreview(false)}
                  >
                    <View style={styles.themeModalBackdrop}>
                      <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowThemePreview(false)} />
                      <View style={[styles.themeModalCard, themedCard]}>
                        <View style={styles.themeModalPicture}>
                          <Image source={selected.artwork} style={styles.themeModalImage} resizeMode="cover" />
                          <LinearGradient
                            colors={["rgba(11,14,20,0)", "rgba(11,14,20,0.72)"]}
                            style={StyleSheet.absoluteFill}
                          />
                          <Pressable
                            onPress={() => setShowThemePreview(false)}
                            style={styles.themeModalClose}
                          >
                            <Text style={[styles.themeModalCloseText, themedMuted]}>x</Text>
                          </Pressable>
                          <View style={styles.themeModalCopy}>
                            <Text style={[styles.themePreviewBadge, { color: selected.accent }]}>Preview</Text>
                            <Text style={[styles.themePreviewTitle, themedTitle]}>{selected.label}</Text>
                            <Text style={[styles.themePreviewText, themedBody]}>{selected.description}</Text>
                          </View>
                        </View>
                        <View style={styles.themeModalBody}>
                          <View style={styles.themeAmbientRow}>
                            {selected.ambient.map((effect) => (
                              <Text key={effect} style={[styles.themeAmbientPill, themedMuted]}>
                                {effect}
                              </Text>
                            ))}
                          </View>
                          <View style={styles.themeAmbientRow}>
                            {selected.palette.map((color) => (
                              <Text key={color} style={[styles.themePalettePill, themedMuted]}>
                                {color}
                              </Text>
                            ))}
                          </View>
                          <View style={[styles.themeMockNav, themedInk]}>
                            {TABS.map((tab, index) => {
                              const Icon = tab.icon;
                              return (
                                <View key={tab.key} style={styles.themeMockNavItem}>
                                  <Icon active={index === 0} />
                                  <Text style={[styles.themeMockLabel, index === 0 && { color: selected.accent }]}>{tab.label}</Text>
                                </View>
                              );
                            })}
                          </View>
                          <Pressable
                            onPress={() => {
                              if (!isSanctuaryThemeUnlocked(selected)) return;
                              setSanctuaryTheme(selected.key);
                              setDraftSanctuaryTheme(selected.key);
                              setShowThemePreview(false);
                              setShowThemePicker(false);
                            }}
                            disabled={sanctuaryTheme === selected.key || !isSanctuaryThemeUnlocked(selected)}
                            style={[
                              styles.themeApplyButton,
                              { backgroundColor: appTheme.button },
                              (sanctuaryTheme === selected.key || !isSanctuaryThemeUnlocked(selected)) && styles.themeApplyButtonDisabled,
                            ]}
                          >
                            <Text style={[styles.themeApplyButtonText, themedTitle]}>
                              {sanctuaryTheme === selected.key
                                ? "Theme applied"
                                : isSanctuaryThemeUnlocked(selected)
                                  ? "Select Theme"
                                  : sanctuaryThemeProgressLabel(selected)}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </Modal>
                );
              })()}

              <View style={[styles.youCard, themedCard]}>
                <Text style={[styles.youSectionTitle, themedAccent2]}>Privacy</Text>
                <Text style={[styles.youCardBody, themedBody]}>
                  Saved reflections stay on this device. Reflection text or audio is sent securely to Tranqly only when you request transcription or an insight.
                </Text>
                {complimentaryAccess?.status === "active" ? (
                  <Text style={[styles.youCardMuted, themedMuted]}>
                    First week active until {new Date(complimentaryAccess.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.
                  </Text>
                ) : null}
              </View>

              <View style={[styles.youCard, themedCard]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: supportExpanded }}
                  onPress={() => setSupportExpanded((value) => !value)}
                  style={styles.authCardHeader}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.youSectionTitle, themedAccent2]}>Contact & Support</Text>
                    <Text style={[styles.youCardBody, themedBody]}>
                      Send account, billing, recording, or app issues to Tranqly. Reflection text is never attached automatically.
                    </Text>
                  </View>
                  <Text style={[styles.authStatusPill, { borderColor: appTheme.edge, color: appTheme.accent }]}>
                    {supportExpanded ? "Close" : "Contact"}
                  </Text>
                </Pressable>
                {supportExpanded ? <View style={styles.authForm}>
                  <Text style={[styles.youInputLabel, themedTitle]}>What can we help with?</Text>
                  <View style={styles.supportCategoryWrap}>
                    {([
                      ["bug", "App issue"],
                      ["recording", "Recording"],
                      ["insights", "Insights"],
                      ["billing", "Billing"],
                      ["account", "Account"],
                      ["feedback", "Feedback"],
                    ] as [MobileSupportCategory, string][]).map(([value, label]) => {
                      const selected = supportCategory === value;
                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setSupportCategory(value)}
                          style={[
                            styles.supportCategoryChip,
                            { borderColor: selected ? appTheme.accent : appTheme.edge },
                            selected && { backgroundColor: appTheme.helperBg },
                          ]}
                        >
                          <Text style={[styles.supportCategoryText, selected ? themedAccent : themedMuted]}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    value={supportSubject}
                    onChangeText={setSupportSubject}
                    placeholder="Subject"
                    placeholderTextColor={appTheme.faint}
                    maxLength={120}
                    style={[styles.youInput, themedInk, themedTitle]}
                  />
                  <TextInput
                    value={supportMessage}
                    onChangeText={setSupportMessage}
                    placeholder="Describe what happened. Only include reflection text if you choose to."
                    placeholderTextColor={appTheme.faint}
                    multiline
                    textAlignVertical="top"
                    maxLength={2000}
                    style={[styles.youInput, styles.supportMessageInput, themedInk, themedTitle]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={supportBusy || !authUser}
                    onPress={() => void submitMobileSupportTicket()}
                    style={[
                      styles.authPrimaryButton,
                      { backgroundColor: appTheme.button },
                      (supportBusy || !authUser) && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={[styles.authPrimaryText, themedTitle]}>
                      {!authUser ? "Sign in to submit" : supportBusy ? "Submitting..." : "Submit support ticket"}
                    </Text>
                  </Pressable>
                  {supportNotice ? <Text style={[styles.youCardMuted, themedMuted, { marginTop: 0 }]}>{supportNotice}</Text> : null}
                  <View style={styles.supportLinkRow}>
                    <Pressable onPress={() => void Linking.openURL("mailto:support@tranqly.com")}>
                      <Text style={[styles.authMetaText, themedAccent]}>Email support</Text>
                    </Pressable>
                    <Pressable onPress={() => void Linking.openURL("https://tranqly.app/privacy")}>
                      <Text style={[styles.authMetaText, themedMuted]}>Privacy</Text>
                    </Pressable>
                    <Pressable onPress={() => void Linking.openURL("https://tranqly.app/terms")}>
                      <Text style={[styles.authMetaText, themedMuted]}>Terms</Text>
                    </Pressable>
                  </View>
                </View> : null}
              </View>

              <View style={[styles.youCard, themedCard]}>
                <Text style={[styles.youSectionTitle, themedAccent2]}>What Tranqly remembers</Text>
                <Text style={[styles.youCardBody, themedBody]}>
                  Tranqly may save short notes from your reflections so future responses can feel more personal.
                </Text>
                <Text style={[styles.youCardMuted, themedMuted]}>
                  Tranqly has not saved any lasting notes yet. The more you reflect, the more personal it can become.
                </Text>
                <Pressable onPress={() => Alert.alert("Manage Memory", "Tranqly has not saved any lasting notes yet.")} style={[styles.dataControlButton, themedInk]}>
                  <Text style={[styles.dataControlText, themedAccent]}>Manage Memory</Text>
                </Pressable>
              </View>

              <View style={[styles.youCard, themedWeekly]}>
                <View style={styles.authCardHeader}>
                  <View style={{ flex: 1 }}><Text style={[styles.authSummaryLabel, themedAccent2]}>Tranqly Plus</Text><Text style={[styles.youSectionTitle, themedTitle]}>Your Year in Reflection</Text></View>
                  <Text style={[styles.authStatusPill, { borderColor: appTheme.helperEdge, color: appTheme.accent }]}>Coming Soon</Text>
                </View>
                <Text style={[styles.youCardBody, themedBody]}>A private story of the reflection days, sanctuaries, themes, habits, and patterns that shaped your year.</Text>
                <View style={[styles.authButtonRow, { marginTop: 12 }]}>
                  <View style={[styles.authSummaryCard, themedInk, { flex: 1 }]}><Text style={[styles.authSummaryValue, themedAccent]}>{totalReflectionDays}</Text><Text style={[styles.youCardMuted, themedMuted]}>Reflection days so far</Text></View>
                  <View style={[styles.authSummaryCard, themedInk, { flex: 1 }]}><Text style={[styles.authSummaryValue, themedAccent]}>{PRIMARY_SANCTUARY_KEYS.filter((key) => isSanctuaryThemeUnlocked(getSanctuaryTheme(key))).length}</Text><Text style={[styles.youCardMuted, themedMuted]}>Sanctuaries discovered</Text></View>
                </View>
                <Text style={[styles.youCardMuted, themedMuted]}>Private by default. Shared summaries will not include sensitive reflection details.</Text>
              </View>

              <View style={[styles.youCard, themedCard]}>
                <Text style={[styles.youSectionTitle, themedAccent2]}>Data controls</Text>
                <Pressable style={[styles.dataControlButton, themedInk]} onPress={() => void Share.share({ message: JSON.stringify({ exportedAt: new Date().toISOString(), reflections: checkIns, weeklyReflections: weeklyInsights }, null, 2), title: "Tranqly data export" })}>
                  <Text style={[styles.dataControlText, themedBody]}>Export My Data</Text>
                </Pressable>
                <Pressable
                  style={[styles.dataControlButton, themedInk]}
                  onPress={() => Alert.alert("Reset Tranqly Memory?", "Tranqly will rebuild memory from future reflections.")}
                >
                  <Text style={[styles.dataControlText, themedBody]}>Reset Tranqly Memory</Text>
                </Pressable>
                <Pressable
                  style={[styles.dataControlButton, themedInk]}
                  onPress={() => {
                    setOnboardingName(displayName);
                    setOnboardingCompleted(false);
                    setOnboardingStatus("not_started");
                    setCurrentOnboardingStep("firstWeek");
                    setOnboardingCoachCompleted(false);
                    setOnboardingCoachStep(null);
                    setReflectionCoachMarkSeen(false);
                    setJourneyCoachMarkSeen(false);
                    setSanctuaryCoachMarkSeen(false);
                    setOnboardingSkippedAt(null);
                    setOnboardingCoachCompletedAt(null);
                    setComplimentaryAccess(null);
                    setTab("coach");
                  }}
                >
                  <Text style={[styles.dataControlText, themedBody]}>Restart onboarding</Text>
                </Pressable>
                <Pressable
                  style={styles.dangerButton}
                  onPress={() =>
                    Alert.alert("Delete reflections?", "This removes all local reflections and resets Tranqly memory.", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          setCheckIns([]);
                          setLastDeepInsight(null);
                          setWeeklyInsights([]);
                          setMoods({});
                        },
                      },
                    ])
                  }
                >
                  <Text style={styles.dangerButtonText}>Delete all reflections</Text>
                </Pressable>
                {authUser ? <Pressable style={[styles.dangerButton, { marginTop: 12 }]} onPress={() => Alert.alert("Delete account?", "This permanently deletes your Tranqly account. This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete Account", style: "destructive", onPress: async () => { if (!FIREBASE_API_KEY) return; const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: authUser.idToken }) }); if (response.ok) { setAuthUser(null); setCheckIns([]); setWeeklyInsights([]); setLastDeepInsight(null); } else Alert.alert("Could not delete account", "Please sign in again and retry."); } }])}>
                  <Text style={styles.dangerButtonText}>Delete Account</Text>
                </Pressable> : null}
              </View>

              <Text style={styles.youFooter}>Tranqly - your reflections live on your device</Text>
            </ScrollView>
          ) : null}

          {false && tab === "you" ? (
            <ScrollView contentContainerStyle={styles.youContent} showsVerticalScrollIndicator={false}>
              <View style={styles.youHeader}>
                <View>
                  <Text style={[styles.youTitle, shortLayout && styles.youTitleShort]}>You</Text>
                  <Text style={[styles.youSub, shortLayout && styles.youSubShort]}>
                    {checkIns.length} check-in{checkIns.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={styles.youAvatar}>
                  <Text style={styles.youAvatarText}>*</Text>
                </View>
              </View>

              <View style={styles.youCard}>
                <View style={styles.youCardRow}>
                  <Text style={[styles.youCardLabel, shortLayout && styles.youCardLabelShort]}>Current streak</Text>
                  <Text style={[styles.youCardValue, shortLayout && styles.youCardValueShort]}>{streak} days</Text>
                </View>
                <View style={styles.youCardDivider} />
                <View style={styles.youCardRow}>
                  <Text style={[styles.youCardLabel, shortLayout && styles.youCardLabelShort]}>Best streak</Text>
                  <Text style={[styles.youCardValue, shortLayout && styles.youCardValueShort]}>{best} days</Text>
                </View>
              </View>
            </ScrollView>
          ) : null}
          </Animated.View>
        </KeyboardAvoidingView>

          <View style={[styles.tabs, { backgroundColor: appTheme.ink, borderColor: appTheme.edge }]}>
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <Pressable
                  key={key}
                  ref={key === "journey" ? journeyCoachTargetRef : key === "you" ? sanctuaryCoachTargetRef : undefined}
                  onLayout={measureCoachTarget}
                  testID={`tab-${key}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  onPress={() => pressBottomTab(key)}
                  style={({ pressed }) => [
                    styles.tab,
                    active && styles.tabActiveLift,
                    active && { backgroundColor: appTheme.button },
                    pressed && styles.tabPressed,
                  ]}
                >
                  {key === "you" ? (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active ? "rgba(255,255,255,0.14)" : "transparent",
                      }}
                    >
                      <ThemeIcon type={sanctuaryTheme} color={active ? appTheme.fg : appTheme.faint} size={19} />
                    </View>
                  ) : (
                    <Icon active={active} />
                  )}
                  <Text
                    style={[styles.tabText, { color: appTheme.faint }, active && { color: appTheme.fg }]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Modal
            visible={showNotificationPrompt}
            transparent
            animationType="fade"
            onRequestClose={() => setShowNotificationPrompt(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setShowNotificationPrompt(false)}>
              <Pressable style={[styles.modalCard, themedCard]} onPress={() => {}}>
                <Text style={[styles.kicker, themedAccent2]}>Notifications</Text>
                <Text style={[styles.modalMessage, themedTitle]}>
                  Want a gentle reminder to check in each day?
                </Text>
                <Text style={[styles.youCardMuted, themedMuted]}>
                  Your quiet place is ready when you are.
                </Text>
                <View style={[styles.authButtonRow, { marginTop: 18 }]}>
                  <Pressable
                    style={[styles.authPrimaryButton, { backgroundColor: appTheme.button }]}
                    onPress={async () => {
                      const result = await requestNotificationPermission();
                      if (result === "granted") {
                        updateMobileNotificationSettings({
                          dailyReminderEnabled: true,
                          weeklyInsightEnabled: true,
                          sanctuaryUnlockEnabled: true,
                        });
                      }
                      setShowNotificationPrompt(false);
                    }}
                  >
                    <Text style={[styles.authPrimaryText, themedTitle]}>Enable reminders</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.authSecondaryButton, { borderColor: appTheme.edge }]}
                    onPress={() => {
                      updateMobileNotificationSettings({ notificationPromptShown: true });
                      setShowNotificationPrompt(false);
                    }}
                  >
                    <Text style={[styles.authSecondaryText, themedAccent]}>Not now</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal
            visible={showReminderTimePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowReminderTimePicker(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setShowReminderTimePicker(false)}>
              <Pressable testID="reminder-time-picker" style={[styles.modalCard, themedCard]} onPress={() => {}}>
                <Text style={[styles.kicker, themedAccent2]}>Daily Reminder</Text>
                <Text style={[styles.modalMessage, themedTitle]}>Choose your quiet minute</Text>
                <Text style={[styles.youCardMuted, themedMuted]}>
                  Tranqly will send one gentle reminder at this time.
                </Text>
                {Platform.OS === "web" ? (
                  <Text style={[styles.reminderTimePreview, themedAccent]}>{formatHourLabel(reminderTimeFromDate(reminderTimeDraft))}</Text>
                ) : (
                  <DateTimePicker
                    value={reminderTimeDraft}
                    mode="time"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minuteInterval={5}
                    themeVariant="dark"
                    onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                      if (event.type === "dismissed") {
                        if (Platform.OS !== "ios") setShowReminderTimePicker(false);
                        return;
                      }
                      if (selectedDate) setReminderTimeDraft(selectedDate);
                    }}
                    style={styles.reminderTimePicker}
                  />
                )}
                <View style={[styles.authButtonRow, { marginTop: 18 }]}>
                  <Pressable
                    style={[styles.authSecondaryButton, { borderColor: appTheme.edge }]}
                    onPress={() => setShowReminderTimePicker(false)}
                  >
                    <Text style={[styles.authSecondaryText, themedAccent]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    testID="save-reminder-time"
                    style={[styles.authPrimaryButton, { backgroundColor: appTheme.button }]}
                    onPress={() => {
                      setNotificationDraft((current) => ({
                        ...current,
                        quietMinuteOption: "custom",
                        dailyReminderTime: reminderTimeFromDate(reminderTimeDraft),
                      }));
                      setShowReminderTimePicker(false);
                    }}
                  >
                    <Text style={[styles.authPrimaryText, themedTitle]}>Save Time</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Coach reply modal */}
          <Modal
            visible={coachModal !== null}
            transparent
            animationType="fade"
            onRequestClose={closeCoachResponse}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={closeCoachResponse}
            >
              <Pressable
                style={[styles.modalCard, themedCard, shortLayout && styles.modalCardShort]}
                onPress={() => {}}
              >
                <Pressable
                  style={styles.modalClose}
                  onPress={closeCoachResponse}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close response"
                >
                  <Text style={styles.modalCloseText}>x</Text>
                </Pressable>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <View
                    style={{
                      width: shortLayout ? 36 : 44,
                      height: shortLayout ? 36 : 44,
                      borderRadius: shortLayout ? 18 : 22,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: appTheme.helperBg,
                      borderWidth: 1,
                      borderColor: appTheme.edge,
                    }}
                  >
                    <ThemeIcon type={sanctuaryTheme} color={appTheme.accent} size={shortLayout ? 22 : 26} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.kicker, themedAccent2, shortLayout && styles.kickerShort]}>
                      Your Reflection
                    </Text>
                    <Text style={[styles.modalUserEntry, themedTitle, shortLayout && styles.modalUserEntryShort]}>
                      "{coachModal?.text}"
                    </Text>
                  </View>
                </View>

                <Text style={[styles.modalMessage, themedBody, shortLayout && styles.modalMessageShort]}>
                  <Text style={[styles.kicker, themedAccent2, shortLayout && styles.kickerShort]}>What Stood Out{"\n"}</Text>
                  {coachModal?.reply.message}
                </Text>

                <View style={[styles.nextStepBox, themedInk, shortLayout && styles.nextStepBoxShort]}>
                  <Text style={[styles.nextStepLabel, themedAccent2, shortLayout && styles.nextStepLabelShort]}>{coachStepLabel}</Text>
                  <Text style={[styles.nextStep, themedTitle, shortLayout && styles.nextStepShort]}>
                    {coachModal?.reply.nextStep}
                  </Text>
                </View>
                {coachModal?.reply.pattern ? (
                  <View style={[styles.nextStepBox, themedInk, shortLayout && styles.nextStepBoxShort]}>
                    <Text style={[styles.nextStepLabel, themedAccent2, shortLayout && styles.nextStepLabelShort]}>{coachPatternEvidence >= 3 ? "Pattern to Watch" : coachPatternEvidence === 2 ? "A Pattern May Be Emerging" : "Something to Notice"}</Text>
                    <Text style={[styles.nextStep, themedTitle, shortLayout && styles.nextStepShort]}>
                      {coachModal.reply.pattern}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.responseFeedbackRow, { borderColor: appTheme.edge }]}>
                  <Text style={[styles.responseFeedbackLabel, themedMuted]}>Was this helpful?</Text>
                  <View style={styles.responseFeedbackActions}>
                    <Pressable onPress={() => { saveMobileResponseFeedback(true); setResponseFeedbackOpen(false); }} style={[styles.responseFeedbackButton, themedInk]}>
                      <Text style={[styles.responseFeedbackText, themedAccent]}>Helpful</Text>
                    </Pressable>
                    <Pressable onPress={() => setResponseFeedbackOpen(true)} style={[styles.responseFeedbackButton, themedInk]}>
                      <Text style={[styles.responseFeedbackText, themedAccent]}>Not helpful</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal
            visible={showJourneyDeepInsight}
            transparent
            animationType="slide"
            onRequestClose={() => setShowJourneyDeepInsight(false)}
          >
            <View style={styles.sanctuaryModalOverlay}>
              <View style={[styles.sanctuaryModalCard, themedCard]}>
                <View style={styles.sanctuaryModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sanctuaryKicker, themedAccent2]}>Weekly Reflections</Text>
                    <Text style={[styles.sanctuaryModalTitle, themedTitle]}>Weekly Reflection History</Text>
                  </View>
                  <Pressable onPress={() => setShowJourneyDeepInsight(false)} style={[styles.sanctuaryCloseButton, themedInk]}>
                    <Text style={[styles.sanctuaryCloseText, themedAccent]}>Close</Text>
                  </Pressable>
                </View>
                {responseFeedbackOpen ? (
                  <View style={[styles.authSummaryCard, themedInk, { marginTop: 12 }]}>
                    <Text style={[styles.notificationLabel, themedTitle]}>What felt off?</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      {["Too obvious", "Too much advice", "Incorrect pattern", "Too personal", "Did not understand me"].map((reason) => (
                        <Pressable key={reason} onPress={() => { saveMobileResponseFeedback(false, reason); setResponseFeedbackOpen(false); setResponseFeedbackText(""); }} style={[styles.responseFeedbackButton, { borderColor: appTheme.edge }]}>
                          <Text style={[styles.responseFeedbackText, themedAccent]}>{reason}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput value={responseFeedbackText} onChangeText={setResponseFeedbackText} placeholder="Tell us more (optional)" placeholderTextColor={appTheme.faint} style={[styles.youInput, themedCard, themedTitle, { marginTop: 10 }]} />
                  </View>
                ) : null}
                <ScrollView testID="weekly-reflection-modal-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={styles.weeklyHistoryScroll}>
                  {selectedWeeklyInsight ? (
                    <View style={[styles.authSummaryCard, themedInk]}>
                      <Text style={[styles.authSummaryLabel, themedMuted]}>
                        Week of {new Date(selectedWeeklyInsight.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                      <Text style={[styles.deepHeadline, themedTitle]}>{selectedWeeklyInsight.headline}</Text>
                      <Text style={[styles.journeyCardText, themedBody]}>{selectedWeeklyInsight.insight}</Text>
                      <View style={[styles.authSummaryCard, { backgroundColor: appTheme.helperBg, borderColor: appTheme.helperEdge, marginTop: 10 }]}>
                        <Text style={[styles.authSummaryLabel, themedAccent2]}>Next Gentle Focus</Text>
                        <Text style={[styles.youCardMuted, themedBody]}>{selectedWeeklyInsight.suggestion}</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.journeyCardText, themedBody]}>Your first weekly reflection will appear here when it is ready.</Text>
                  )}
                  {weeklyInsights.length > 1 ? (
                    <View style={{ marginTop: 16, gap: 8 }}>
                      <Text style={[styles.authSummaryLabel, themedMuted]}>Previous weeks</Text>
                      {weeklyInsights.map((insight) => (
                        <Pressable key={insight.createdAt} onPress={() => setSelectedWeeklyInsight(insight)} style={[styles.notificationRow, themedInk, selectedWeeklyInsight?.createdAt === insight.createdAt && { borderColor: appTheme.accent }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.notificationLabel, themedTitle]}>{insight.headline}</Text>
                            <Text style={[styles.youCardMuted, themedMuted]}>{new Date(insight.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</Text>
                          </View>
                          <Text style={[styles.notificationValue, themedAccent]}>View</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <Modal
            visible={Boolean(newlyUnlockedSanctuary)}
            transparent
            animationType="fade"
            onRequestClose={() => setNewlyUnlockedSanctuary(null)}
          >
            <View style={styles.sanctuaryModalOverlay}>
              <View style={[styles.modalCard, themedCard]}>
                {newlyUnlockedSanctuary ? (
                  <>
                    <Text style={[styles.kicker, themedAccent2]}>New Sanctuary Unlocked</Text>
                    <Text style={[styles.sanctuaryModalTitle, themedTitle]}>{getSanctuaryTheme(newlyUnlockedSanctuary).label}</Text>
                    <View style={[styles.sanctuaryModalArtworkFrame, { marginTop: 14, height: 220 }]}>
                      <Image
                        source={getSanctuaryTheme(newlyUnlockedSanctuary).artwork}
                        style={styles.sanctuaryModalArtwork}
                        resizeMode="cover"
                      />
                      <LinearGradient colors={["rgba(11,14,20,0)", "rgba(11,14,20,0.72)"]} style={StyleSheet.absoluteFill} />
                      <Text style={[styles.sanctuaryArtworkText, themedTitle]}>
                        {getSanctuaryTheme(newlyUnlockedSanctuary).feeling}
                      </Text>
                    </View>
                    <Text style={[styles.modalMessage, themedBody]}>{getSanctuaryTheme(newlyUnlockedSanctuary).description}</Text>
                    <Text style={[styles.youCardMuted, themedMuted]}>You reflected on {totalReflectionDays} different days.</Text>
                    <View style={[styles.authButtonRow, { marginTop: 18 }]}>
                      <Pressable style={[styles.authSecondaryButton, { borderColor: appTheme.edge }]} onPress={() => setNewlyUnlockedSanctuary(null)}>
                        <Text style={[styles.authSecondaryText, themedAccent]}>Maybe Later</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.authPrimaryButton, { backgroundColor: appTheme.button }]}
                        onPress={() => {
                          const key = newlyUnlockedSanctuary;
                          setSanctuaryTheme(key);
                          setDraftSanctuaryTheme(key);
                          setSanctuaryDetailTheme(key);
                          setNewlyUnlockedSanctuary(null);
                          setShowSanctuaryModal(true);
                        }}
                      >
                        <Text style={[styles.authPrimaryText, themedTitle]}>Enter Sanctuary</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          </Modal>

          <Modal
            visible={showSanctuaryModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowSanctuaryModal(false)}
          >
            <View style={styles.sanctuaryModalOverlay}>
              <View style={[styles.sanctuaryModalCard, themedCard]}>
                <View style={styles.sanctuaryModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sanctuaryKicker, themedAccent2]}>Explore Sanctuary</Text>
                    <Text style={[styles.sanctuaryModalTitle, themedTitle]}>{detailSanctuary.label}</Text>
                    <View style={styles.sanctuaryMetaRow}>
                      {sanctuaryTheme === detailSanctuary.key ? (
                        <Text style={[styles.sanctuaryMetaPill, themedMuted]}>Current Sanctuary</Text>
                      ) : null}
                      {sanctuaryTheme !== detailSanctuary.key ? (
                        <Text style={[styles.sanctuaryMetaPill, themedMuted]}>
                          {sanctuaryThemeProgressLabel(detailSanctuary)}
                        </Text>
                      ) : null}
                      <Text style={[styles.sanctuaryMetaPill, themedMuted]}>
                        {detailSanctuaryReflectionCount} Reflection Day{detailSanctuaryReflectionCount === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Text style={[styles.sanctuarySubtitle, themedBody]}>
                      {detailSanctuary.description}
                    </Text>
                  </View>
                  <Pressable
                    testID="close-sanctuary"
                    accessibilityRole="button"
                    onPress={() => setShowSanctuaryModal(false)}
                    style={[styles.sanctuaryCloseButton, themedInk]}
                    hitSlop={12}
                  >
                    <Text style={[styles.sanctuaryCloseText, themedAccent]}>Close</Text>
                  </Pressable>
                </View>
                <ScrollView testID="sanctuary-modal-scroll" showsVerticalScrollIndicator={false}>
                  <View style={styles.sanctuaryModalArtworkFrame}>
                    <Image source={detailSanctuary.artwork} style={styles.sanctuaryModalArtwork} resizeMode="cover" />
                    <LinearGradient colors={["rgba(11,14,20,0)", "rgba(11,14,20,0.76)"]} style={StyleSheet.absoluteFill} />
                    <Text style={[styles.sanctuaryArtworkText, themedTitle]}>{detailSanctuary.feeling}</Text>
                  </View>

                  <View style={styles.sanctuaryStatsRow}>
                    <View style={styles.sanctuaryStatPill}>
                      <Text style={styles.sanctuaryStatValue}>{detailSanctuaryReflectionCount}</Text>
                      <Text style={styles.sanctuaryStatLabel}>Reflection Days</Text>
                    </View>
                    <View style={styles.sanctuaryStatPill}>
                      <Text style={styles.sanctuaryStatValue}>{streak}d</Text>
                      <Text style={styles.sanctuaryStatLabel}>Streak</Text>
                    </View>
                    <View style={styles.sanctuaryStatPill}>
                      <Text style={styles.sanctuaryStatValue}>{best}d</Text>
                      <Text style={styles.sanctuaryStatLabel}>Best</Text>
                    </View>
                  </View>

                  <View style={[styles.sanctuaryPersonalCard, { backgroundColor: appTheme.helperBg, borderColor: appTheme.edge }]}>
                    <Text style={[styles.sanctuaryPersonalTitle, themedAccent2]}>Palette</Text>
                    <Text style={[styles.sanctuaryInfoBody, themedBody]}>
                      {detailSanctuary.palette.join(", ")}
                    </Text>
                  </View>

                  {isSanctuaryThemeUnlocked(detailSanctuary) && sanctuaryTheme !== detailSanctuary.key ? (
                    <Pressable
                      style={[styles.themeApplyButton, { backgroundColor: appTheme.button, marginBottom: 18 }]}
                      onPress={() => {
                        setSanctuaryTheme(detailSanctuary.key);
                        setDraftSanctuaryTheme(detailSanctuary.key);
                        setShowSanctuaryModal(false);
                      }}
                    >
                      <Text style={[styles.themeApplyButtonText, themedTitle]}>Select Theme</Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <Modal
            visible={showFirstWeekCompleteModal}
            transparent
            animationType="fade"
            onRequestClose={markFirstWeekConversionSeen}
          >
            <Pressable style={styles.firstWeekSheetOverlay} onPress={markFirstWeekConversionSeen}>
              <Pressable
                style={[styles.firstWeekSheet, themedCard]}
                onPress={() => {}}
              >
                <View style={styles.firstWeekSheetHeader}>
                  <View style={styles.modalHandle} />
                <View style={[styles.premiumHeaderRow, { marginBottom: 0 }]}>
                  <View style={styles.firstWeekHeroCopy}>
                    <View style={[styles.firstWeekCelebrationIcon, { borderColor: appTheme.helperEdge, backgroundColor: appTheme.helperBg }]}>
                      <Image source={TRANQLY_LOGO} style={styles.firstWeekCelebrationLogo} resizeMode="contain" />
                    </View>
                    <Text style={[styles.authSummaryLabel, themedAccent2]}>Your first week</Text>
                    <Text style={[styles.firstWeekHeroTitle, themedTitle]}>
                      {firstWeekReflectionDays >= 7 ? "You've completed your first week." : "Your first week is ready to revisit."}
                    </Text>
                    <Text style={[styles.firstWeekHeroSubtitle, themedBody]}>
                      {firstWeekReflectionDays >= 7
                        ? "Seven days ago you began reflecting. Tranqly is already beginning to understand what helps you feel more like yourself."
                        : "What you shared has given Tranqly a meaningful place to begin. Your reflections will always be here when you want to return."}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Close first week summary"
                    onPress={markFirstWeekConversionSeen}
                    style={[styles.coachMarkCloseButton, { borderColor: appTheme.edge, backgroundColor: appTheme.ink }]}
                  >
                    <Text style={[styles.coachMarkCloseText, themedMuted]}>x</Text>
                  </Pressable>
                </View>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.firstWeekSheetScroll}
                >
                <View style={styles.weeklySummaryGrid}>
                  {firstWeekSummaryItems.map((item, index) => (
                    <Animated.View
                      key={item}
                      style={[
                        styles.weeklySummaryPill,
                        {
                          borderColor: appTheme.helperEdge,
                          backgroundColor: appTheme.helperBg,
                          opacity: firstWeekCardAnims[Math.min(index, firstWeekCardAnims.length - 1)],
                          transform: [{
                            scale: firstWeekCardAnims[Math.min(index, firstWeekCardAnims.length - 1)].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.94, 1],
                            }),
                          }],
                          shadowColor: appTheme.accent,
                        },
                      ]}
                    >
                      <CompletionCheckMark color={appTheme.accent2} size={17} />
                      <Text style={[styles.weeklySummaryText, themedTitle]}>{item}</Text>
                    </Animated.View>
                  ))}
                </View>
                {firstWeekReflectionDays > 0 && firstWeekReflectionDays < 7 ? (
                  <View style={[styles.weeklyProgressMessage, { borderColor: appTheme.edge, backgroundColor: appTheme.ink }]}>
                    <Text style={[styles.weeklyModalBody, themedBody]}>
                      You made meaningful space for yourself throughout the week.
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.weeklyDetailCard, themedInk]}>
                  <Text style={[styles.authSummaryLabel, themedAccent2]}>Weekly Reflection</Text>
                  <Text style={[styles.weeklyModalTitle, themedTitle]}>
                    {firstWeekReflectionDays >= 3
                      ? firstWeekInsight?.headline ?? (weeklyGenerating ? "Tranqly is bringing your week together" : "A few moments from your week")
                      : "Your weekly reflection is still building"}
                  </Text>
                  <Text style={[styles.weeklyModalBody, themedBody]}>
                    {firstWeekReflectionDays >= 3
                      ? firstWeekInsight?.insight ?? (weeklyGenerating ? "Your reflection will appear here in a moment." : firstWeekReflectionText)
                      : "A few more check-ins will help Tranqly uncover a meaningful pattern. What you already shared will stay here."}
                  </Text>
                  {firstWeekReflectionDays >= 3 ? (
                    <View style={[styles.weeklyExperimentBox, { borderColor: appTheme.helperEdge, backgroundColor: appTheme.helperBg }]}>
                      <Text style={[styles.authSummaryLabel, themedAccent2]}>{firstWeekInsight?.gentleFocusTitle ?? "Next gentle focus"}</Text>
                    <Text style={[styles.weeklyModalBody, themedTitle]}>
                      {firstWeekInsight?.suggestion ?? "Notice one moment this week where you feel a little more settled, supported, or clear."}
                    </Text>
                    </View>
                  ) : null}
                </View>
                {firstWeekReflectionDays >= 7 ? (
                  <View style={[styles.weeklyRewardCard, { borderColor: appTheme.helperEdge, backgroundColor: appTheme.helperBg }]}>
                    <Image source={forestHavenReward.artwork} style={styles.weeklyRewardImage} />
                    <View style={styles.weeklyRewardCopy}>
                      <Text style={[styles.authSummaryLabel, themedAccent2]}>Seven days of reflection</Text>
                      <Text style={[styles.weeklyModalTitle, themedTitle]}>Forest Haven unlocked</Text>
                      <Text style={[styles.weeklyModalBody, themedBody]}>
                        You've started building your sanctuary collection. Forest Haven is now yours forever.
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View style={[styles.firstWeekValueCard, { borderColor: appTheme.edge, backgroundColor: appTheme.ink }]}>
                  <Text style={[styles.firstWeekSectionTitle, themedTitle]}>This Week You Gained</Text>
                  {firstWeekGains.map((item) => (
                    <View key={item} style={styles.firstWeekValueRow}>
                      <CompletionCheckMark color={appTheme.accent2} size={18} />
                      <Text style={[styles.firstWeekValueText, themedBody]}>{item}</Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.firstWeekValueCard, { borderColor: appTheme.helperEdge, backgroundColor: appTheme.helperBg }]}>
                  <Text style={[styles.firstWeekSectionTitle, themedTitle]}>Next Week You'll Discover</Text>
                  {nextWeekDiscoveries.map((item) => (
                    <View key={item} style={styles.firstWeekValueRow}>
                      <View style={[styles.firstWeekFutureDot, { backgroundColor: appTheme.accent }]} />
                      <Text style={[styles.firstWeekValueText, themedBody]}>{item}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.firstWeekContinueTitle, themedTitle]}>Continue Your Journey</Text>
                <Text style={[styles.firstWeekContinueBody, themedBody]}>
                  Every reflection teaches Tranqly a little more about you. The more you share, the more personal your insights become.
                </Text>
                <Text style={[styles.firstWeekEmotionalBridge, { color: appTheme.accent2 }]}>
                  Your journey has already begun. The weeks ahead are where your insights become even more personal.
                </Text>
                <View style={styles.premiumPlanGrid}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedPlan === "yearly" }}
                    onPress={() => setSelectedPlan("yearly")}
                    style={[
                      styles.premiumPlanCard,
                      styles.firstWeekYearlyPlanCard,
                      { borderColor: selectedPlan === "yearly" ? appTheme.accent : appTheme.edge },
                      selectedPlan === "yearly" && { backgroundColor: appTheme.helperBg, shadowColor: appTheme.accent },
                    ]}
                  >
                    <View style={styles.premiumPlanHeader}>
                      <Text style={[styles.premiumPlanName, themedTitle]}>Yearly</Text>
                      <Text style={[styles.premiumPlanBadge, { color: appTheme.accent2 }]}>BEST VALUE</Text>
                    </View>
                    <Text style={[styles.premiumPlanPrice, themedTitle]}>
                      {storePrices.yearly ? `${storePrices.yearly} per year` : "Loading price..."}
                    </Text>
                    <Text style={[styles.premiumPlanDetail, themedMuted]}>About $5 per month. Save compared to monthly.</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedPlan === "monthly" }}
                    onPress={() => setSelectedPlan("monthly")}
                    style={[
                      styles.premiumPlanCard,
                      { borderColor: selectedPlan === "monthly" ? appTheme.accent : appTheme.edge },
                      selectedPlan === "monthly" && { backgroundColor: appTheme.helperBg },
                    ]}
                  >
                    <Text style={[styles.premiumPlanName, themedTitle]}>Monthly</Text>
                    <Text style={[styles.premiumPlanPrice, themedTitle]}>
                      {storePrices.monthly ? `${storePrices.monthly} per month` : "Loading price..."}
                    </Text>
                    <Text style={[styles.premiumPlanDetail, themedMuted]}>Continue month to month.</Text>
                  </Pressable>
                </View>
                <Text style={[styles.firstWeekOwnershipNote, themedMuted]}>
                  Your first week, Weekly Reflection, and unlocked sanctuaries remain yours whether you continue or not.
                </Text>
                </ScrollView>
                <View style={[styles.firstWeekPurchaseFooter, { borderColor: appTheme.edge, backgroundColor: appTheme.card }]}>
                <View style={[styles.firstWeekSelectedPlan, { borderColor: appTheme.edge, backgroundColor: appTheme.ink }]}>
                  <Text style={[styles.firstWeekSelectedPlanTitle, themedTitle]}>{firstWeekPlanLabel}</Text>
                  <Text style={[styles.firstWeekSelectedPlanDetail, themedMuted]}>{firstWeekPlanBilling}</Text>
                </View>
                <Pressable
                  onPress={() => { markFirstWeekConversionSeen(); void startCheckout(); }}
                  disabled={checkoutBusy || (Platform.OS === "ios" && !purchasesReady)}
                  style={[styles.premiumUpgradeButton, (checkoutBusy || (Platform.OS === "ios" && !purchasesReady)) && { opacity: 0.55 }]}
                >
                  <LinearGradient
                    colors={[appTheme.button, appTheme.button]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.premiumUpgradeGradient}
                  >
                    <Text style={[styles.premiumUpgradeText, themedTitle]}>
                      {checkoutBusy ? "Opening checkout..." : Platform.OS === "ios" && !purchasesReady ? "Loading App Store..." : "Continue my Journey"}
                    </Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={markFirstWeekConversionSeen} style={styles.premiumCloseButton}>
                  <Text style={[styles.premiumCloseText, themedMuted]}>Maybe Later</Text>
                </Pressable>
                <Pressable onPress={() => void restoreAppStorePurchases()} disabled={checkoutBusy || (Platform.OS === "ios" && !purchasesReady)} style={styles.premiumCloseButton}>
                  <Text style={[styles.premiumCloseText, themedAccent]}>Restore purchases</Text>
                </Pressable>
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 24 }}>
                  <Pressable onPress={() => void Linking.openURL("https://tranqly.app/terms")}>
                    <Text style={[styles.premiumPriceNote, themedMuted]}>Terms</Text>
                  </Pressable>
                  <Pressable onPress={() => void Linking.openURL("https://tranqly.app/privacy")}>
                    <Text style={[styles.premiumPriceNote, themedMuted]}>Privacy</Text>
                  </Pressable>
                </View>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal
            visible={showPurchaseSuccess}
            animationType="fade"
            presentationStyle="fullScreen"
            onRequestClose={() => {}}
          >
            <SafeAreaView testID="purchase-success-modal" style={[styles.purchaseSuccessRoot, { backgroundColor: appTheme.bg }]}>
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {[12, 24, 39, 58, 72, 86].map((left, index) => (
                  <Animated.View
                    key={left}
                    style={[
                      styles.purchaseSuccessParticle,
                      {
                        left: `${left}%`,
                        top: `${28 + (index % 3) * 18}%`,
                        backgroundColor: index % 2 ? appTheme.accent : appTheme.accent2,
                        opacity: purchaseSuccessProgress.interpolate({
                          inputRange: [0, 0.12, 0.72, 1],
                          outputRange: [0, 0.8, 0.5, 0],
                        }),
                        transform: [
                          {
                            translateY: purchaseSuccessProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [24 + index * 3, -70 - index * 9],
                            }),
                          },
                          {
                            scale: purchaseSuccessProgress.interpolate({
                              inputRange: [0, 0.25, 1],
                              outputRange: [0.4, 1, 0.65],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ))}
              </View>
              <ScrollView contentContainerStyle={styles.purchaseSuccessContent} showsVerticalScrollIndicator={false}>
                <Animated.View
                  style={[
                    styles.purchaseSuccessGlow,
                    {
                      shadowColor: appTheme.accent,
                      opacity: purchaseSuccessProgress.interpolate({
                        inputRange: [0, 0.18, 1],
                        outputRange: [0.45, 1, 0.75],
                      }),
                      transform: [{ scale: purchaseSuccessProgress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.9, 1.04, 1] }) }],
                    },
                  ]}
                >
                  <Image source={TRANQLY_LOGO} style={styles.purchaseSuccessLogo} resizeMode="contain" />
                </Animated.View>
                <Text style={[styles.purchaseSuccessKicker, { color: appTheme.accent2 }]}>TRANQLY PLUS</Text>
                <Text style={[styles.purchaseSuccessTitle, themedTitle]}>Welcome to Tranqly Plus</Text>
                <Text style={[styles.purchaseSuccessBody, themedBody]}>
                  Thank you for continuing your journey. Every reflection helps Tranqly understand you a little better. Your weekly reflections, personalized insights, and sanctuary collection will continue growing with you.
                </Text>

                <View style={[styles.purchaseSuccessList, { borderColor: appTheme.edge, backgroundColor: appTheme.card }]}>
                  {[
                    "Unlimited reflections",
                    "Personalized AI insights",
                    "Weekly reflections",
                    "Sanctuary progression",
                    "All future Tranqly Plus features",
                  ].map((item) => (
                    <View key={item} style={styles.purchaseSuccessListRow}>
                      <CompletionCheckMark color={appTheme.accent2} size={18} />
                      <Text style={[styles.purchaseSuccessListText, themedBody]}>{item}</Text>
                    </View>
                  ))}
                </View>

                {purchaseSuccessAddedForest ? (
                  <View style={[styles.purchaseSuccessReward, { borderColor: appTheme.helperEdge, backgroundColor: appTheme.helperBg }]}>
                    <Image source={forestHavenReward.artwork} style={styles.purchaseSuccessRewardImage} resizeMode="cover" />
                    <View style={styles.purchaseSuccessRewardCopy}>
                      <Text style={[styles.purchaseSuccessRewardLabel, { color: appTheme.accent2 }]}>YOUR SANCTUARY</Text>
                      <Text style={[styles.purchaseSuccessRewardTitle, themedTitle]}>Forest Haven is ready</Text>
                      <Text style={[styles.purchaseSuccessRewardBody, themedBody]}>It has been added to your sanctuary collection and selected for your next visit.</Text>
                    </View>
                  </View>
                ) : null}

                <Text style={[styles.purchaseSuccessReminder, { color: appTheme.accent2 }]}>
                  {totalReflectionDays >= 7
                    ? "You showed up for seven days. We are glad to keep growing with you."
                    : "The first week was only the beginning."}
                </Text>
                <Pressable
                  testID="purchase-success-continue"
                  onPress={() => {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setShowPurchaseSuccess(false);
                    setTab("coach");
                  }}
                  style={[styles.purchaseSuccessButton, { backgroundColor: appTheme.button }]}
                >
                  <Text style={[styles.purchaseSuccessButtonText, themedTitle]}>Continue My Journey</Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </Modal>

          <Modal
            visible={showPremiumModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowPremiumModal(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowPremiumModal(false)}
            >
              <Pressable
                style={[styles.premiumModalCard, themedCard, shortLayout && styles.modalCardShort]}
                onPress={() => {}}
              >
                <View style={styles.modalHandle} />
                <View style={[styles.premiumLotusIcon, { borderColor: appTheme.accent, backgroundColor: appTheme.helperBg }]}>
                  <ThemeIcon type="blossom" color={appTheme.accent2} size={28} />
                </View>
                <Text style={[styles.premiumModalTitle, themedTitle]}>
                  {premium ? "Choose your Tranqly Plus plan" : "Ready for another week?"}
                </Text>
                <Text style={[styles.premiumModalBody, themedBody]}>
                  {premium
                    ? "Your monthly plan is active. You can move to yearly whenever it feels right. Apple will confirm the change before billing."
                    : "Your first week is yours to keep, whether you continue or not.\n\nYour first week helped uncover meaningful patterns. Continue whenever it feels right."}
                </Text>
                {[
                  "More weeks of thoughtful responses",
                  "Weekly reflections that build on what you share",
                  "More sanctuaries to explore",
                  "More personal guidance over time",
                ].map((item) => (
                  <View key={item} style={styles.premiumPerkRow}>
                    <View style={[styles.premiumPerkIcon, { borderColor: appTheme.helperEdge }]}>
                      <Text style={[styles.premiumPerkIconText, themedAccent]}>+</Text>
                    </View>
                    <Text style={styles.premiumPerkText}>{item}</Text>
                  </View>
                ))}
                <View style={styles.premiumPlanGrid}>
                  <Pressable
                    onPress={() => setSelectedPlan("yearly")}
                    accessibilityState={{ selected: selectedPlan === "yearly" }}
                    style={[
                      styles.premiumPlanCard,
                      { borderColor: selectedPlan === "yearly" ? appTheme.accent : appTheme.edge },
                      selectedPlan === "yearly" && { backgroundColor: appTheme.helperBg },
                    ]}
                  >
                    <View style={styles.premiumPlanHeader}>
                      <Text style={[styles.premiumPlanName, themedTitle]}>Yearly</Text>
                      <Text style={[styles.premiumPlanBadge, { color: appTheme.accent2 }]}>BEST VALUE</Text>
                    </View>
                    <Text style={[styles.premiumPlanPrice, themedTitle]}>
                      {storePrices.yearly ? `${storePrices.yearly} per year` : purchasesLoading ? "Loading price..." : "Unavailable"}
                    </Text>
                    <Text style={[styles.premiumPlanDetail, themedMuted]}>Billed annually</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSelectedPlan("monthly")}
                    disabled={premium && activePaidPlan === "monthly"}
                    accessibilityState={{ selected: selectedPlan === "monthly", disabled: premium && activePaidPlan === "monthly" }}
                    style={[
                      styles.premiumPlanCard,
                      { borderColor: selectedPlan === "monthly" ? appTheme.accent : appTheme.edge },
                      selectedPlan === "monthly" && { backgroundColor: appTheme.helperBg },
                    ]}
                  >
                    <View style={styles.premiumPlanHeader}>
                      <Text style={[styles.premiumPlanName, themedTitle]}>Monthly</Text>
                      {premium && activePaidPlan === "monthly" ? (
                        <Text style={[styles.premiumPlanBadge, { color: appTheme.accent2 }]}>CURRENT</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.premiumPlanPrice, themedTitle]}>
                      {storePrices.monthly ? `${storePrices.monthly} per month` : purchasesLoading ? "Loading price..." : "Unavailable"}
                    </Text>
                    <Text style={[styles.premiumPlanDetail, themedMuted]}>Billed monthly</Text>
                  </Pressable>
                </View>
                {Platform.OS === "ios" && purchaseSetupError ? (
                  <Text style={[styles.premiumPriceNote, themedMuted]}>{purchaseSetupError}</Text>
                ) : null}
                <Pressable
                  onPress={() => Platform.OS === "ios" && !purchasesReady ? void refreshAppStorePlans() : void startCheckout()}
                  disabled={checkoutBusy || (Platform.OS === "ios" && purchasesLoading) || (premium && purchasesReady && activePaidPlan === selectedPlan)}
                  style={[
                    styles.premiumUpgradeButton,
                    (checkoutBusy || (Platform.OS === "ios" && purchasesLoading) || (premium && purchasesReady && activePaidPlan === selectedPlan)) && { opacity: 0.55 },
                  ]}
                >
                  <LinearGradient
                    colors={[appTheme.button, appTheme.button]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.premiumUpgradeGradient}
                  >
                    <Text style={[styles.premiumUpgradeText, themedTitle]}>
                      {checkoutBusy
                        ? "Opening checkout..."
                        : Platform.OS === "ios" && purchasesLoading
                          ? "Connecting to App Store..."
                          : Platform.OS === "ios" && !purchasesReady
                            ? "Retry App Store"
                          : premium && activePaidPlan === selectedPlan
                            ? "Current Plan"
                            : premium
                              ? "Switch to Yearly"
                              : "Continue my Journey"}
                    </Text>
                  </LinearGradient>
                </Pressable>
                <Text style={[styles.premiumPriceNote, themedMuted]}>
                  {premium
                    ? "Apple shows the effective date and billing details before confirming your plan change."
                    : "Billing starts only after you confirm a paid plan. Your saved reflections and first weekly reflection remain available if you do not continue."}
                </Text>
                <Pressable
                  onPress={() => setShowPremiumModal(false)}
                  style={styles.premiumCloseButton}
                >
                  <Text style={[styles.premiumCloseText, themedMuted]}>Not right now</Text>
                </Pressable>
                <Pressable
                  onPress={() => void restoreAppStorePurchases()}
                  disabled={checkoutBusy || (Platform.OS === "ios" && !purchasesReady)}
                  style={styles.premiumCloseButton}
                >
                  <Text style={[styles.premiumCloseText, themedAccent]}>Restore purchases</Text>
                </Pressable>
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 24 }}>
                  <Pressable onPress={() => void Linking.openURL("https://tranqly.app/terms")}>
                    <Text style={[styles.premiumPriceNote, themedMuted]}>Terms</Text>
                  </Pressable>
                  <Pressable onPress={() => void Linking.openURL("https://tranqly.app/privacy")}>
                    <Text style={[styles.premiumPriceNote, themedMuted]}>Privacy</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );

  async function toggleRecord() {
    if (recording) {
      await stopRecording(recording);
    } else {
      if (recordingStartingRef.current || transcribing || pending) return;
      if (needsWeekTwo) {
        promptWeekTwoContinuation();
        return;
      }
      recordingStartingRef.current = true;
      setComposerError("Preparing microphone...");
      try {
        let perm = await Audio.getPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) {
          perm = await Audio.requestPermissionsAsync();
        }
        if (!perm.granted) {
          setComposerError("");
          Alert.alert(
            "Microphone access needed",
            "Allow microphone access in Settings to record a reflection.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => void Linking.openSettings() },
            ]
          );
          return;
        }
        // iOS needs a short handoff after its permission sheet dismisses before
        // the recording audio session can be activated reliably.
        await new Promise((resolve) => setTimeout(resolve, 300));
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          interruptionModeIOS: 1,
          shouldDuckAndroid: true,
        });

        let activeRecording: Audio.Recording | null = null;
        let startError: unknown;
        for (let attempt = 0; attempt < 2; attempt++) {
          const candidate = new Audio.Recording();
          try {
            await candidate.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            await candidate.startAsync();
            activeRecording = candidate;
            break;
          } catch (error) {
            startError = error;
            try { await candidate.stopAndUnloadAsync(); } catch {}
            if (attempt === 0) {
              await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
              await new Promise((resolve) => setTimeout(resolve, 250));
              await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            }
          }
        }
        if (!activeRecording) throw startError || new Error("Recorder could not be prepared.");
        recordingStoppingRef.current = false;
        setRecording(activeRecording);
        setComposerError("");
      } catch (error) {
        console.warn("Recording start failed", error);
        void Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
        setComposerError("The microphone could not start. Please try once more.");
        setTimeout(() => setComposerError(""), 5000);
        logMobileApiError({
          errorCode: "mobile_recording_start_failed",
          errorMessage: error instanceof Error ? error.message : "Recording could not start.",
          featureArea: "recording",
        });
        Alert.alert("Recording error", "Could not start recording.");
      } finally {
        recordingStartingRef.current = false;
      }
    }
  }

  async function stopRecording(activeRecording: Audio.Recording) {
    if (recordingStoppingRef.current) return;
    recordingStoppingRef.current = true;
    try {
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();
      setRecording(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      if (!uri) return;
      await transcribeAudio(uri);
    } catch (error) {
      setRecording(null);
      void Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      console.warn("Recording stop failed", error);
      Alert.alert("Recording error", "Could not stop recording.");
    }
  }

  async function transcribeAudio(uri: string, retries = 2): Promise<void> {
    if (!API_BASE_URL) {
      Alert.alert(
        "Server not configured",
        "Set EXPO_PUBLIC_API_BASE_URL to your Tranqly web server URL, then restart Expo."
      );
      return;
    }
    setComposerError("");
    setTranscribing(true);
    const startedAt = Date.now();
    let lastError = "Could not transcribe audio.";
    let lastStatus: number | undefined;
    let lastRequestId: string | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const formData = new FormData();
        formData.append("audio", {
          uri,
          type: "audio/m4a",
          name: "recording.m4a",
        } as any);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);
        if (__DEV__) {
          console.info("Posting transcription request to", `${API_BASE_URL}/api/transcribe`, {
            attempt: attempt + 1,
            uri,
          });
        }
        const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
          method: "POST",
          signal: controller.signal,
          body: formData,
        });
        clearTimeout(timeout);
        lastStatus = res.status;
        if (__DEV__) {
          console.info("Transcription response status", res.status);
        }
        if (res.ok) {
          const data = await res.json();
          lastRequestId = typeof data.requestId === "string" ? data.requestId : lastRequestId;
          if (__DEV__) {
            console.info("Transcription response payload", {
              requestId: data.requestId,
              hasText: Boolean(data.text),
              chars: typeof data.text === "string" ? data.text.length : 0,
            });
          }
          if (data.text) {
            setText((prev) => (prev ? `${prev} ${data.text}` : data.text));
            setReflectionSource("voice");
            setShowTranscriptPreview(true);
            setCaptured(true);
            setTimeout(() => setCaptured(false), 500);
          }
          setTranscribing(false);
          return;
        }
        try {
          const data = await res.json();
          lastRequestId = typeof data.requestId === "string" ? data.requestId : lastRequestId;
          lastError = data.error || lastError;
          if (__DEV__) {
            console.warn("Transcription API error payload", data);
          }
        } catch {
          lastError = `Transcription failed with status ${res.status}.`;
        }
      } catch (err) {
        if (__DEV__) {
          console.warn("Transcription request failed", err);
        }
        lastError =
          err instanceof Error && err.name === "AbortError"
            ? "The request did not finish. Check that your phone can reach the Tranqly web server."
            : err instanceof Error
              ? err.message
              : lastError;
      }
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500));
    }
    setTranscribing(false);
    setComposerError("Transcription failed. Try the mic again or type instead.");
    setTimeout(() => setComposerError(""), 5000);
    logMobileApiError({
      requestId: lastRequestId,
      errorCode: "mobile_transcription_failed",
      errorMessage: lastError,
      featureArea: "transcription",
      statusCode: lastStatus,
      durationMs: Date.now() - startedAt,
      route: "/api/transcribe",
      metadata: {
        attempts: retries + 1,
        hasApiBaseUrl: Boolean(API_BASE_URL),
      },
    });
    Alert.alert("Transcription failed", lastError);
  }

}

export default function App() {
  return (
    <AppErrorBoundary>
      <TranqlyApp />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: "#0B0E14",
  },
  adminRoot: {
    flex: 1,
    backgroundColor: "#070B12",
  },
  adminContent: {
    padding: 20,
    paddingBottom: 44,
    gap: 18,
  },
  adminHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  adminEyebrow: {
    color: "#6BE7D8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  adminTitle: {
    color: "#F6F2EA",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 6,
  },
  adminSubtitle: {
    color: "#A7B0C5",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 620,
  },
  adminBackButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(17,24,39,0.78)",
  },
  adminBackText: {
    color: "#EDE7D9",
    fontSize: 12,
    fontWeight: "900",
  },
  adminSceneList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  adminSceneChip: {
    minWidth: 150,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(17,24,39,0.72)",
    padding: 14,
  },
  adminSceneChipActive: {
    borderColor: "#B894FF",
    backgroundColor: "rgba(167,139,250,0.14)",
  },
  adminSceneChipTitle: {
    color: "#F6F2EA",
    fontSize: 14,
    fontWeight: "900",
  },
  adminSceneChipStatus: {
    color: "#6BE7D8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginTop: 6,
    textTransform: "uppercase",
  },
  adminGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-start",
  },
  adminPanel: {
    flexGrow: 1,
    flexBasis: 360,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(13,20,33,0.9)",
    padding: 18,
    gap: 12,
  },
  adminPanelTitle: {
    color: "#F6F2EA",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  adminLabel: {
    color: "#A7B0C5",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  adminInput: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(5,10,18,0.72)",
    color: "#F6F2EA",
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: "700",
  },
  adminRuleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  adminRuleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(5,10,18,0.6)",
  },
  adminRuleChipActive: {
    borderColor: "#6BE7D8",
    backgroundColor: "rgba(107,231,216,0.12)",
  },
  adminRuleChipText: {
    color: "#D7DEEA",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  adminErrors: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    backgroundColor: "rgba(127,29,29,0.24)",
    padding: 12,
    gap: 4,
  },
  adminErrorText: {
    color: "#FECACA",
    fontSize: 12,
    fontWeight: "700",
  },
  adminActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  adminActionButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    backgroundColor: "rgba(17,24,39,0.82)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  adminActionPrimary: {
    borderColor: "#6BE7D8",
    backgroundColor: "#6BE7D8",
  },
  adminActionText: {
    color: "#EDE7D9",
    fontSize: 12,
    fontWeight: "900",
  },
  adminActionPrimaryText: {
    color: "#061015",
    fontSize: 12,
    fontWeight: "900",
  },
  adminDeviceRow: {
    gap: 8,
    paddingVertical: 2,
  },
  adminDeviceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(5,10,18,0.62)",
  },
  adminDeviceChipActive: {
    borderColor: "#B894FF",
    backgroundColor: "rgba(167,139,250,0.18)",
  },
  adminDeviceText: {
    color: "#EDE7D9",
    fontSize: 12,
    fontWeight: "900",
  },
  adminPreviewWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  adminPreviewFrame: {
    overflow: "hidden",
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.32)",
    backgroundColor: "#080D16",
  },
  adminPreviewHeader: {
    minHeight: 50,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.16)",
  },
  adminPreviewTitle: {
    color: "#F6F2EA",
    fontSize: 15,
    fontWeight: "900",
  },
  adminPreviewStatus: {
    color: "#6BE7D8",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  adminPreviewContent: {
    padding: 18,
    paddingBottom: 32,
  },
  adminPreviewHeading: {
    color: "#F6F2EA",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  adminPreviewSubcopy: {
    color: "#A7B0C5",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  fitCoachScroll: {
    flex: 1,
  },
  fitCoachShell: {
    flexGrow: 1,
    paddingTop: 6,
    paddingBottom: 104,
  },
  fitHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  fitBrandRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fitBrandLogo: {
    width: 30,
    height: 30,
  },
  fitBrand: {
    color: "#F2F4F8",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  fitBrandShort: {
    fontSize: 13,
  },
  fitStreak: {
    color: "#7E8B9D",
    fontSize: 12,
    fontWeight: "700",
  },
  fitHero: {
    marginBottom: 6,
  },
  fitEyebrow: {
    color: "#9AA3B5",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  fitEyebrowShort: {
    fontSize: 12,
  },
  fitTitle: {
    color: "#F2F4F8",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  fitTitleShort: {
    fontSize: 24,
    lineHeight: 28,
  },
  fitAccent: {
    color: "#D8C4FF",
  },
  fitTagline: {
    color: "#B894FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  fitSubline: {
    color: "#9AA3B5",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  fitDiscoveryLine: {
    color: "#D8C4FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  growthNoticeCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  growthNoticeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  fitDailyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.26)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  fitDailyCardShort: {
    paddingVertical: 8,
    marginBottom: 6,
  },
  fitKicker: {
    color: "#D8C4FF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  fitPromptBlock: {
    alignItems: "center",
    marginBottom: 6,
  },
  fitPromptText: {
    color: "#F2F4F8",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  fitDivider: {
    height: 1,
    marginVertical: 8,
    opacity: 0.75,
  },
  anotherPromptButton: {
    marginTop: 4,
    minHeight: 30,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(184,148,255,0.22)",
    backgroundColor: "rgba(184,148,255,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  anotherPromptText: {
    color: "#D8C4FF",
    fontSize: 12,
    fontWeight: "900",
  },
  promptReasonText: {
    color: "#7E8B9D",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 14,
  },
  patternObservationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  patternObservationCheck: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 1,
  },
  fitTranscriptCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94,234,212,0.25)",
    backgroundColor: "rgba(94,234,212,0.10)",
    padding: 12,
    marginBottom: 10,
  },
  fitTranscriptText: {
    color: "#D4D8E0",
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
    marginTop: 2,
  },
  fitPatternBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94,234,212,0.25)",
    backgroundColor: "rgba(94,234,212,0.10)",
    padding: 12,
    marginTop: 12,
  },
  responseFeedbackRow: {
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
    gap: 8,
  },
  responseFeedbackLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  responseFeedbackActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  responseFeedbackButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  responseFeedbackText: {
    fontSize: 12,
    fontWeight: "800",
  },
  fitCardText: {
    color: "#DDE7E5",
    fontSize: 14,
    lineHeight: 19,
  },
  fitCardTextShort: {
    fontSize: 12,
    lineHeight: 16,
  },
  fitComposer: {
    borderRadius: 22,
    backgroundColor: "#141826",
    borderWidth: 1,
    borderColor: "#242B3D",
    padding: 9,
    marginBottom: 6,
  },
  fitComposerShort: {
    padding: 8,
    marginBottom: 6,
  },
  fitMicWrap: {
    minHeight: 154,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  fitMicWrapShort: {
    minHeight: 136,
  },
  fitMicPulseWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  fitMicPulse: {
    position: "absolute",
    width: 102,
    height: 102,
    borderRadius: 51,
  },
  fitMicPulseShort: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  fitMicButton: {
    width: 95,
    height: 95,
    borderRadius: 48,
    backgroundColor: "#0B0E14",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#B894FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 10,
  },
  fitMicButtonShort: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  fitMicButtonRecording: {
    backgroundColor: "rgba(167,139,250,0.18)",
    borderColor: "#B894FF",
  },
  fitMicLoading: {
    color: "#D8C4FF",
    fontSize: 22,
    fontWeight: "900",
  },
  waveformRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  waveformBar: {
    width: 6,
    borderRadius: 999,
    backgroundColor: "#D8C4FF",
  },
  fitVoiceHint: {
    color: "#5B6478",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },
  fitVoiceHintShort: {
    fontSize: 11,
    marginTop: 8,
  },
  fitStatusCard: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 10,
  },
  fitInsightPreview: {
    width: "100%",
    minHeight: 142,
    borderRadius: 32,
    borderWidth: 1,
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 24,
    marginBottom: 10,
    overflow: "hidden",
  },
  fitInsightPreviewNarrow: {
    paddingHorizontal: 20,
  },
  fitInsightPreviewShort: {
    minHeight: 126,
    paddingTop: 14,
    paddingBottom: 8,
  },
  fitStatusText: {
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  fitStatusTextShort: {
    fontSize: 11,
  },
  fitInput: {
    minHeight: 96,
    borderRadius: 18,
    backgroundColor: "#0B0E14",
    borderWidth: 1,
    borderColor: "#263142",
    color: "#F2F4F8",
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  fitInputShort: {
    minHeight: 82,
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 9,
  },
  fitBasedCard: {
    borderRadius: 20,
    backgroundColor: "#132A2B",
    borderWidth: 1,
    borderColor: "#245257",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 6,
  },
  fitBasedCardShort: {
    paddingVertical: 8,
    marginBottom: 6,
  },
  fitShareButton: {
    borderRadius: 22,
    overflow: "hidden",
  },
  fitShareGradient: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  fitShareGradientShort: {
    minHeight: 40,
  },
  fitSubmittedCard: {
    borderRadius: 22,
    backgroundColor: "#141826",
    borderWidth: 1,
    borderColor: "#242B3D",
    padding: 11,
    marginBottom: 6,
  },
  fitSubmittedCardShort: {
    padding: 10,
    marginBottom: 6,
  },
  fitSubmittedTitle: {
    color: "#F2F4F8",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginBottom: 8,
    width: "100%",
    flexShrink: 1,
  },
  fitSubmittedTitleNarrow: {
    fontSize: 20,
    lineHeight: 24,
  },
  fitSubmittedTitleShort: {
    fontSize: 18,
    marginBottom: 6,
  },
  fitSubmittedBody: {
    color: "#D4D8E0",
    fontSize: 14,
    lineHeight: 20,
    width: "100%",
    flexShrink: 1,
  },
  fitSubmittedBodyNarrow: {
    fontSize: 13,
    lineHeight: 18,
  },
  fitSubmittedBodyShort: {
    fontSize: 12,
    lineHeight: 17,
  },
  fitSubmittedActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  fitFollowUpComposer: {
    marginTop: 22,
    gap: 8,
  },
  fitFollowUpComposerShort: {
    marginTop: 14,
    gap: 6,
  },
  fitFollowUpStack: {
    alignItems: "center",
    gap: 10,
  },
  fitFollowUpMic: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0E14",
    shadowColor: "#B894FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 10,
  },
  fitFollowUpPulse: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  fitFollowUpHint: {
    color: "#5B6478",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  voiceLimitWrap: {
    width: "64%",
    maxWidth: 220,
    minWidth: 150,
    alignSelf: "center",
    marginTop: 8,
  },
  voiceLimitTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  voiceLimitFill: {
    height: "100%",
    borderRadius: 999,
  },
  voiceLimitText: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  fitFollowUpInput: {
    width: "100%",
    minHeight: 86,
    borderRadius: 18,
    backgroundColor: "#0B0E14",
    borderWidth: 1,
    borderColor: "#263142",
    color: "#F2F4F8",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  fitFollowUpInputShort: {
    minHeight: 78,
    paddingVertical: 9,
  },
  fitFollowUpShare: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  fitSecondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0E14",
    borderWidth: 1,
    borderColor: "#263142",
  },
  fitSecondaryButtonText: {
    color: "#F2F4F8",
    fontSize: 12,
    fontWeight: "900",
  },
  fitWeeklyPreview: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.32)",
    backgroundColor: "#171430",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fitWeeklyPreviewShort: {
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  fitWeeklyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  fitWeeklyCount: {
    color: "#D8C4FF",
    fontSize: 10,
    fontWeight: "900",
  },
  fitWeeklyProgress: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 6,
  },
  fitWeeklyProgressSegment: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(11,14,20,0.85)",
  },
  fitWeeklyProgressSegmentActive: {
    backgroundColor: "#D8C4FF",
  },
  fitWeeklyProgressText: {
    color: "#F2F4F8",
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 0,
  },
  fitWeeklyButton: {
    minHeight: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D8C4FF",
    marginTop: 12,
  },
  fitWeeklyButtonText: {
    color: "#081014",
    fontSize: 14,
    fontWeight: "900",
  },
  flex: {
    flex: 1,
    backgroundColor: "#0B0E14",
  },
  shell: {
    flex: 1,
    backgroundColor: "#0B0E14",
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerShort: {
    paddingTop: 6,
    paddingBottom: 8,
  },
  brand: {
    color: "#F2F4F8",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -1,
  },
  brandShort: {
    fontSize: 18,
  },
  subtle: {
    color: "#7E8B9D",
    fontSize: 13,
  },
  inputSection: {
    paddingTop: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  inputSectionShort: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  greeting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  greetingShort: {
    marginBottom: 6,
    gap: 8,
  },
  greetingName: {
    color: "#F2F4F8",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  greetingNameShort: {
    fontSize: 15,
  },
  greetingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#151A24",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#263142",
  },
  greetingBadgeShort: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  greetingEmoji: {
    fontSize: 14,
  },
  greetingEmojiShort: {
    fontSize: 12,
  },
  greetingSub: {
    color: "#7E8B9D",
    fontSize: 12,
    fontWeight: "600",
  },
  greetingSubShort: {
    fontSize: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  inputRowShort: {
    gap: 8,
    marginBottom: 8,
  },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#151A24",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#263142",
    flexShrink: 0,
  },
  micButtonShort: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  micPressed: {
    backgroundColor: "#1E2938",
    borderColor: "#B894FF",
  },
  micDisabled: {
    opacity: 0.4,
  },
  recordingIndicator: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  recordingRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#B894FF",
    opacity: 0.4,
  },
  micIcon: {
    fontSize: 36,
  },
  micIconShort: {
    fontSize: 30,
  },
  textInputWrap: {
    flex: 1,
    minHeight: 100,
    justifyContent: "center",
  },
  textInputWrapShort: {
    minHeight: 84,
  },
  input: {
    backgroundColor: "#151A24",
    color: "#F2F4F8",
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#263142",
    minHeight: 100,
    textAlignVertical: "top",
  },
  inputShort: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 84,
    borderRadius: 20,
  },
  shareButton: {
    marginBottom: 12,
    borderRadius: 32,
    overflow: "hidden",
  },
  shareButtonShort: {
    marginBottom: 8,
  },
  disabled: {
    opacity: 1,
  },
  disabledButtonText: {
    color: "#D4D8E0",
  },
  shareGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
  },
  shareText: {
    color: "#081014",
    fontSize: 18,
    fontWeight: "800",
  },
  shareTextShort: {
    fontSize: 15,
  },
  coachShell: {
    flex: 1,
  },
  coachFeed: {
    flex: 1,
  },
  coachFeedContent: {
    paddingBottom: 100,
  },
  userBubble: {
    alignSelf: "flex-end",
    marginLeft: 32,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    backgroundColor: "rgba(167,139,250,0.25)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userBubbleShort: {
    marginLeft: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  userBubbleText: {
    color: "#F2F4F8",
    fontSize: 15,
    lineHeight: 21,
  },
  userBubbleTextShort: {
    fontSize: 13,
    lineHeight: 18,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 16,
    marginTop: 8,
  },
  typingDot: {
    color: "#B894FF",
    fontSize: 8,
  },
  emptyPrompt: {
    color: "#5B6478",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  emptyPromptShort: {
    fontSize: 12,
    lineHeight: 17,
    paddingTop: 16,
  },
  moodChip: {
    alignSelf: "flex-start",
    backgroundColor: "#151A24",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#263142",
    marginBottom: 8,
  },
  moodChipShort: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  moodChipText: {
    color: "#F2F4F8",
    fontWeight: "700",
    fontSize: 13,
  },
  moodChipTextShort: {
    fontSize: 11,
  },
  deepCard: {
    backgroundColor: "#151A24",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#263142",
    marginBottom: 12,
  },
  deepCardShort: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 10,
  },
  deepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  deepBadge: {
    color: "#B894FF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  deepPremium: {
    color: "#FBBF24",
    fontSize: 9,
    fontWeight: "800",
    backgroundColor: "#2A1F1F",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  deepHeadline: {
    color: "#F2F4F8",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    lineHeight: 24,
  },
  deepHeadlineShort: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 6,
  },
  deepBody: {
    color: "#B0B8C8",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  deepBodyShort: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  deepSuggestionBox: {
    backgroundColor: "#1E2938",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  deepSuggestionBoxShort: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  deepSuggestionText: {
    color: "#D4D8E0",
    fontSize: 13,
    lineHeight: 18,
  },
  deepSuggestionTextShort: {
    fontSize: 11,
    lineHeight: 16,
  },
  deepAffirmation: {
    color: "#E8D5B7",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 18,
  },
  deepAffirmationShort: {
    fontSize: 11,
    lineHeight: 15,
  },
  journeyContent: {
    paddingBottom: 130,
    paddingTop: 26,
  },
  journeyHeader: {
    marginBottom: 18,
  },
  monthCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#253247",
    backgroundColor: "rgba(16,23,35,0.82)",
    padding: 14,
    marginBottom: 14,
  },
  monthKicker: {
    color: "#D8C4FF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  monthTile: {
    width: "48.9%",
    minHeight: 116,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "rgba(11,14,20,0.58)",
    paddingHorizontal: 6,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  monthIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  monthLabel: {
    color: "#A9B3C3",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 4,
    textAlign: "center",
  },
  monthValue: {
    color: "#F2F4F8",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  sanctuaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#253247",
    backgroundColor: "rgba(16,23,35,0.86)",
    padding: 14,
    marginBottom: 14,
  },
  sanctuaryCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  sanctuaryKicker: {
    color: "#D8C4FF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sanctuaryTitle: {
    color: "#F2F4F8",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1.1,
    marginTop: 4,
  },
  sanctuarySubtitle: {
    color: "#A9B3C3",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  sanctuaryTopButton: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2B3850",
    backgroundColor: "rgba(11,14,20,0.54)",
    paddingHorizontal: 13,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sanctuaryTopButtonText: {
    color: "#B58BFF",
    fontSize: 14,
    fontWeight: "900",
  },
  sanctuaryScene: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 0,
    backgroundColor: "#071018",
    marginBottom: 12,
    alignSelf: "center",
  },
  sanctuaryResponsiveWrap: {
    width: "100%",
    alignItems: "center",
  },
  sanctuaryLandscape: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  sanctuaryAsset: {
    position: "absolute",
  },
  sanctuaryLayer: {
    position: "absolute",
  },
  sanctuaryLanternGlow: {
    position: "absolute",
    width: "14%",
    height: "14%",
    borderRadius: 999,
    backgroundColor: "rgba(245, 189, 109, 0.38)",
    shadowColor: "#F5BD6D",
    shadowOpacity: 0.85,
    shadowRadius: 18,
  },
  sanctuaryCloudLeft: {
    left: "2%",
    top: "23%",
    width: "18%",
    height: "18%",
    opacity: 0.72,
  },
  sanctuaryCloudRight: {
    right: "3%",
    top: "11%",
    width: "19%",
    height: "19%",
    opacity: 0.58,
  },
  sanctuaryGroundAsset: {
    left: "4%",
    right: "4%",
    bottom: "-5%",
    width: "92%",
    height: "70%",
  },
  sanctuarySeedAsset: {
    left: "42%",
    top: "50%",
    width: "18%",
    height: "25%",
  },
  sanctuaryTreeAsset: {
    left: "28%",
    top: "10%",
    width: "38%",
    height: "55%",
  },
  sanctuaryPondAsset: {
    left: "34%",
    bottom: "8%",
    width: "33%",
    height: "31%",
  },
  sanctuaryRocksAsset: {
    left: "18%",
    bottom: "5%",
    width: "26%",
    height: "28%",
  },
  sanctuaryBushAsset: {
    left: "8%",
    bottom: "12%",
    width: "28%",
    height: "31%",
  },
  sanctuaryFlowerAsset: {
    left: "2%",
    bottom: "9%",
    width: "30%",
    height: "34%",
  },
  sanctuaryCabinAsset: {
    right: "3%",
    bottom: "10%",
    width: "33%",
    height: "42%",
  },
  sanctuaryLanternAsset: {
    right: "28%",
    bottom: "13%",
    width: "16%",
    height: "24%",
  },
  sanctuaryBirdAsset: {
    right: "24%",
    top: "21%",
    width: "17%",
    height: "15%",
    opacity: 0.92,
  },
  sanctuaryButterflyAsset: {
    left: "13%",
    top: "47%",
    width: "15%",
    height: "18%",
  },
  fireflyDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#F5D56D",
    shadowColor: "#F5D56D",
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  sanctuaryProgressBox: {
    marginTop: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "rgba(11,14,20,0.58)",
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
  },
  sanctuaryProgressText: {
    color: "#A9B3C3",
    fontSize: 11,
    lineHeight: 14,
  },
  sanctuaryMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  sanctuaryMetaPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "rgba(11,14,20,0.55)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "800",
  },
  sanctuaryDays: {
    color: "#D8C4FF",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 28,
    minWidth: 48,
  },
  sanctuaryStatBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  fitSeeMoreButton: {
    alignSelf: "flex-start",
    minHeight: 30,
    justifyContent: "center",
    marginTop: 4,
  },
  sanctuaryStatCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },
  sanctuaryStatIcon: {
    fontSize: 18,
  },
  sanctuaryDivider: {
    width: 1,
    height: 48,
    backgroundColor: "#263142",
    marginHorizontal: 6,
  },
  sanctuaryUnlockBlock: {
    flex: 1.25,
    minWidth: 0,
  },
  sanctuaryUnlockName: {
    color: "#F2F4F8",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 18,
  },
  sanctuaryNext: {
    color: "#D8C4FF",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 1,
  },
  sanctuaryButton: {
    minHeight: 46,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94,234,212,0.35)",
    backgroundColor: "#0B0E14",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  sanctuaryButtonText: {
    color: "#D8C4FF",
    fontSize: 14,
    fontWeight: "900",
  },
  sanctuaryModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.74)",
    justifyContent: "flex-end",
  },
  sanctuaryModalCard: {
    maxHeight: "92%",
    backgroundColor: "#151A24",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: "#263142",
    padding: 18,
  },
  sanctuaryModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  sanctuaryModalTitle: {
    color: "#F2F4F8",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 4,
  },
  sanctuaryCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "#0B0E14",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sanctuaryCloseText: {
    color: "#A9B3C3",
    fontSize: 12,
    fontWeight: "900",
  },
  sanctuaryStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  sanctuaryStatPill: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "rgba(11,14,20,0.65)",
    padding: 12,
    alignItems: "center",
  },
  sanctuaryStatValue: {
    color: "#F2F4F8",
    fontSize: 20,
    fontWeight: "900",
  },
  sanctuaryStatLabel: {
    color: "#7E8B9D",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 2,
  },
  sanctuaryInfoCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "rgba(11,14,20,0.65)",
    padding: 14,
    marginTop: 12,
  },
  sanctuaryInfoTitle: {
    color: "#F2F4F8",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
  },
  sanctuaryInfoBody: {
    color: "#A9B3C3",
    fontSize: 13,
    lineHeight: 19,
  },
  sanctuaryInfoAccent: {
    color: "#D8C4FF",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 19,
    marginTop: 8,
  },
  sanctuaryElementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "#151A24",
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 7,
  },
  sanctuaryElementName: {
    color: "#A9B3C3",
    fontSize: 13,
    fontWeight: "800",
  },
  sanctuaryElementStatus: {
    color: "#D8C4FF",
    fontSize: 13,
    fontWeight: "900",
  },
  sanctuaryLocked: {
    color: "#5B6478",
  },
  sanctuaryReached: {
    color: "#D8C4FF",
  },
  sanctuaryPersonalCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(94,234,212,0.25)",
    backgroundColor: "rgba(94,234,212,0.10)",
    padding: 14,
    marginTop: 12,
  },
  sanctuaryPersonalTitle: {
    color: "#D8C4FF",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
  },
  journeyPremiumCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.48)",
    backgroundColor: "#171032",
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginBottom: 16,
  },
  journeyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "#151A24",
    padding: 16,
    marginBottom: 16,
  },
  premiumHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  premiumPillWrap: {
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.34)",
    backgroundColor: "rgba(11,14,20,0.35)",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  premiumCrown: {
    color: "#B58BFF",
    fontSize: 18,
    fontWeight: "900",
  },
  premiumPill: {
    color: "#B58BFF",
    fontSize: 19,
    fontWeight: "900",
  },
  journeySectionTitle: {
    color: "#F2F4F8",
    fontSize: 22,
    fontWeight: "900",
  },
  journeyCardText: {
    color: "#D4D8E0",
    fontSize: 16,
    lineHeight: 22,
  },
  journeyUpdated: {
    color: "#7E8B9D",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },
  journeyChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  journeyChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "#0B0E14",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  journeyChipText: {
    color: "#D4D8E0",
    fontSize: 11,
    fontWeight: "900",
  },
  journeyMiniChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#0B0E14",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  journeyMiniChipText: {
    color: "#A9B3C3",
    fontSize: 10,
    fontWeight: "800",
  },
  journeyChapterCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "#0B0E14",
    padding: 12,
  },
  journeyChapterKicker: {
    color: "#D8C4FF",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  journeyChapterTitle: {
    color: "#F2F4F8",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 4,
  },
  journeyMilestoneCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(94,234,212,0.32)",
    backgroundColor: "rgba(94,234,212,0.10)",
    padding: 16,
    marginBottom: 12,
  },
  journeyPrimaryButton: {
    minHeight: 44,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    backgroundColor: "#D8C4FF",
  },
  journeyPrimaryButtonText: {
    color: "#081014",
    fontSize: 14,
    fontWeight: "900",
  },
  patternGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  patternTile: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "#0B0E14",
    padding: 12,
  },
  patternText: {
    color: "#A9B3C3",
    fontSize: 13,
    lineHeight: 18,
  },
  inlinePremiumLink: {
    color: "#D8C4FF",
    fontSize: 14,
    fontWeight: "900",
  },
  milestoneRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  milestonePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "#0B0E14",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  milestoneText: {
    color: "#A9B3C3",
    fontSize: 12,
    fontWeight: "800",
  },
  askCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(94,234,212,0.25)",
    backgroundColor: "rgba(94,234,212,0.10)",
    padding: 16,
    marginBottom: 16,
  },
  askTitle: {
    color: "#D8C4FF",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
  },
  askButton: {
    minHeight: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94,234,212,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    backgroundColor: "#0B0E14",
  },
  askButtonText: {
    color: "#D8C4FF",
    fontSize: 14,
    fontWeight: "900",
  },
  journeyTitle: {
    color: "#F2F4F8",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1.6,
  },
  journeyTitleShort: {
    fontSize: 32,
  },
  journeySubtitle: {
    color: "#A9B3C3",
    fontSize: 22,
    marginTop: 2,
  },
  journeySubtitleShort: {
    fontSize: 18,
  },
  streakCard: {
    backgroundColor: "rgba(16,23,35,0.82)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#253247",
    marginBottom: 14,
  },
  streakCardShort: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  streakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  streakEmoji: {
    fontSize: 28,
  },
  streakEmojiShort: {
    fontSize: 24,
  },
  streakNumber: {
    color: "#F2F4F8",
    fontSize: 28,
    fontWeight: "900",
  },
  streakNumberShort: {
    fontSize: 17,
  },
  streakLabel: {
    color: "#A9B3C3",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 1,
  },
  streakLabelShort: {
    fontSize: 10,
  },
  streakBest: {
    color: "#A9B3C3",
    fontSize: 18,
    fontWeight: "800",
  },
  streakBestShort: {
    fontSize: 11,
  },
  streakDots: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 0,
  },
  streakDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#1E2938",
  },
  streakDotActive: {
    backgroundColor: "#D8C4FF",
  },
  chartCard: {
    backgroundColor: "rgba(16,23,35,0.82)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#253247",
    marginBottom: 14,
  },
  chartCardShort: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  chartTitle: {
    color: "#F2F4F8",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 20,
  },
  chartTitleShort: {
    fontSize: 13,
    marginBottom: 12,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 88,
  },
  chartBarsShort: {
    height: 48,
  },
  chartBarCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  chartBar: {
    width: 20,
    borderRadius: 999,
    backgroundColor: "#263142",
    overflow: "hidden",
    minHeight: 6,
  },
  chartLabel: {
    color: "#A9B3C3",
    fontSize: 13,
    fontWeight: "900",
  },
  chartLabelShort: {
    fontSize: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyStateShort: {
    paddingTop: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyIconShort: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyText: {
    color: "#7E8B9D",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 21,
  },
  emptyTextShort: {
    fontSize: 13,
    lineHeight: 18,
  },
  historyGroup: {
    marginBottom: 8,
  },
  historyDateHeader: {
    color: "#7E8B9D",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  historyDateHeaderShort: {
    fontSize: 12,
    marginBottom: 8,
  },
  coachReplyIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  coachReplyIndicatorText: {
    color: "#B894FF",
    fontSize: 13,
    fontWeight: "700",
  },
  coachReplyArrow: {
    color: "#B894FF",
    fontSize: 14,
    fontWeight: "700",
  },
  deleteInsightButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  deleteInsightButtonText: {
    color: "#FECACA",
    fontSize: 13,
    fontWeight: "800",
  },
  youContent: {
    paddingBottom: 100,
    paddingTop: 12,
  },
  youHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  youTitle: {
    color: "#F2F4F8",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -1,
  },
  youTitleShort: {
    fontSize: 22,
  },
  youSub: {
    color: "#7E8B9D",
    fontSize: 14,
    marginTop: 2,
  },
  youSubShort: {
    fontSize: 12,
  },
  youAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#151A24",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#263142",
  },
  youAvatarText: {
    fontSize: 22,
  },
  youCard: {
    backgroundColor: "#151A24",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#263142",
    marginBottom: 16,
  },
  youPremiumCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#151A24",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#263142",
    marginBottom: 16,
  },
  youPremiumCardActive: {
    borderColor: "rgba(94,234,212,0.40)",
    backgroundColor: "#171430",
  },
  youPremiumIcon: {
    color: "#B894FF",
    fontSize: 15,
    fontWeight: "900",
  },
  youCardTitle: {
    color: "#F2F4F8",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  youCardBody: {
    color: "#A9B3C3",
    fontSize: 14,
    lineHeight: 20,
  },
  youCardMuted: {
    color: "#5B6478",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  youSectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  youInputLabel: {
    color: "#F2F4F8",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 8,
  },
  youInput: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "#0B0E14",
    color: "#F2F4F8",
    paddingHorizontal: 14,
    fontSize: 15,
  },
  authCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  authStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    textTransform: "uppercase",
  },
  authForm: {
    gap: 10,
    marginTop: 14,
  },
  authEmailCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  authSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  authSummaryLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  authSummaryValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  authButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  passwordHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  passwordRuleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  authMetaActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  authMetaText: {
    fontSize: 12,
    fontWeight: "800",
  },
  supportCategoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  supportCategoryChip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  supportCategoryText: {
    fontSize: 12,
    fontWeight: "800",
  },
  supportMessageInput: {
    minHeight: 112,
    paddingTop: 14,
    paddingBottom: 14,
  },
  supportLinkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    paddingTop: 2,
  },
  notificationRow: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  notificationLabel: {
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
    paddingRight: 12,
  },
  notificationValue: {
    fontSize: 12,
    fontWeight: "900",
  },
  notificationOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  notificationOptionChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  notificationOptionText: {
    fontSize: 12,
    fontWeight: "800",
  },
  authPrimaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  authPrimaryText: {
    fontSize: 14,
    fontWeight: "900",
  },
  authSecondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  authProviderButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 18,
  },
  authSecondaryText: {
    fontSize: 14,
    fontWeight: "900",
  },
  themeSectionTitle: {
    color: "#F2F4F8",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  themeSectionBody: {
    color: "#A9B3C3",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  sanctuaryThemeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sanctuaryThemeTile: {
    width: "48%",
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#263142",
    overflow: "hidden",
    padding: 10,
    justifyContent: "space-between",
  },
  themeShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,8,14,0.32)",
  },
  themeBottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  sanctuaryThemeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(11,14,20,0.48)",
    alignItems: "center",
    justifyContent: "center",
  },
  themeCheck: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  themeCheckText: {
    color: "#0B0E14",
    fontSize: 17,
    fontWeight: "900",
  },
  themeLockBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    borderRadius: 999,
    backgroundColor: "rgba(11,14,20,0.58)",
    borderWidth: 1,
    borderColor: "#263142",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  themeLockText: {
    color: "#A9B3C3",
    fontSize: 10,
    fontWeight: "900",
  },
  themeTileCopy: {
    marginTop: 8,
  },
  sanctuaryThemeName: {
    color: "#F2F4F8",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sanctuaryThemeDesc: {
    color: "#D4D8E0",
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
    maxWidth: "92%",
  },
  sanctuaryThemeBar: {
    height: 6,
    borderRadius: 999,
    marginTop: 8,
  },
  themePreviewPanel: {
    minHeight: 310,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#263142",
    overflow: "hidden",
    marginTop: 16,
    padding: 16,
  },
  themePreviewButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.42)",
    backgroundColor: "rgba(167,139,250,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  themePreviewButtonText: {
    color: "#C4B5FD",
    fontSize: 14,
    fontWeight: "900",
  },
  themeApplyButton: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#D8C4FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  themeApplyButtonDisabled: {
    opacity: 0.45,
  },
  themeApplyButtonText: {
    color: "#0B0E14",
    fontSize: 14,
    fontWeight: "900",
  },
  themeModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
    padding: 12,
  },
  themeModalCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "#151A24",
    overflow: "hidden",
  },
  themeModalPicture: {
    height: 270,
    overflow: "hidden",
  },
  themeModalClose: {
    position: "absolute",
    right: 14,
    top: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(11,14,20,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  themeModalCloseText: {
    color: "#A9B3C3",
    fontSize: 20,
    fontWeight: "800",
  },
  themeModalCopy: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
  },
  themeModalBody: {
    padding: 14,
  },
  themePreviewShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,8,14,0.18)",
  },
  themePreviewHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  themePreviewIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: "rgba(11,14,20,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  themePreviewBadge: {
    alignSelf: "flex-start",
    color: "#C4B5FD",
    backgroundColor: "rgba(167,139,250,0.22)",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  themePreviewTitle: {
    color: "#F2F4F8",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 8,
  },
  themePreviewText: {
    color: "#D4D8E0",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  themeMockNav: {
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(11,14,20,0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 28,
  },
  themeMockNavItem: {
    alignItems: "center",
    gap: 4,
  },
  themeMockIcon: {
    color: "#A9B3C3",
    fontSize: 22,
    fontWeight: "900",
  },
  themeMockLabel: {
    color: "#A9B3C3",
    fontSize: 11,
    fontWeight: "800",
  },
  themeMockStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  themeMockCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(11,14,20,0.34)",
    padding: 12,
  },
  themeMockValue: {
    fontSize: 17,
    fontWeight: "900",
  },
  themeMockSub: {
    color: "#A9B3C3",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  themeDotRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 13,
  },
  themeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#263142",
  },
  themeLockedRail: {
    minHeight: 68,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "rgba(11,14,20,0.40)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 14,
  },
  themeLockedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(21,26,36,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  themeLockedIconText: {
    color: "#7E8B9D",
    fontSize: 20,
    fontWeight: "900",
  },
  themeLockedLock: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(11,14,20,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  themeHintBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "rgba(11,14,20,0.42)",
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  themeHintIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "rgba(21,26,36,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  themeHintText: {
    flex: 1,
    color: "#A9B3C3",
    fontSize: 13,
    lineHeight: 19,
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  themeTile: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "rgba(11,14,20,0.60)",
    padding: 12,
  },
  themeTileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  themeEmoji: {
    color: "#F2F4F8",
    fontSize: 13,
    fontWeight: "900",
  },
  themeBadge: {
    color: "#B894FF",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  themeActive: {
    color: "#D8C4FF",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  themeSwatch: {
    height: 12,
    borderRadius: 999,
    marginBottom: 8,
  },
  themeLabel: {
    color: "#F2F4F8",
    fontSize: 13,
    fontWeight: "900",
  },
  youFooter: {
    color: "#5B6478",
    fontSize: 12,
    textAlign: "center",
    paddingTop: 4,
    paddingBottom: 8,
  },
  dataControlButton: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#263142",
    backgroundColor: "#0B0E14",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  dataControlText: {
    color: "#D4D8E0",
    fontSize: 14,
    fontWeight: "900",
  },
  dangerButton: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.35)",
    backgroundColor: "rgba(248,113,113,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  dangerButtonText: {
    color: "#FCA5A5",
    fontSize: 14,
    fontWeight: "900",
  },
  youCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  youCardLabel: {
    color: "#7E8B9D",
    fontSize: 14,
    fontWeight: "600",
  },
  youCardLabelShort: {
    fontSize: 12,
  },
  youCardValue: {
    color: "#F2F4F8",
    fontSize: 16,
    fontWeight: "800",
  },
  youCardValueShort: {
    fontSize: 14,
  },
  youCardDivider: {
    height: 1,
    backgroundColor: "#263142",
    marginVertical: 4,
  },
  youSectionTitle: {
    color: "#7E8B9D",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  youSectionTitleShort: {
    fontSize: 11,
    marginBottom: 10,
  },
  youSetting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#151A24",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#263142",
    marginBottom: 8,
  },
  youSettingShort: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 6,
  },
  youSettingText: {
    color: "#F2F4F8",
    fontSize: 15,
    fontWeight: "600",
  },
  youSettingTextShort: {
    fontSize: 13,
  },
  youSettingArrow: {
    color: "#5B6478",
    fontSize: 18,
  },
  onboardingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  onboardingCard: {
    width: "100%",
    padding: 22,
    alignItems: "center",
    gap: 14,
  },
  onboardingCardShell: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
  },
  onboardingHeader: {
    alignItems: "center",
    gap: 8,
  },
  onboardingStepText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  onboardingProgressRow: {
    flexDirection: "row",
    gap: 6,
  },
  onboardingProgressSegment: {
    width: 28,
    height: 6,
    borderRadius: 999,
  },
  onboardingMiddle: {
    flex: 1,
    width: "100%",
    marginTop: 10,
  },
  onboardingMiddleContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  onboardingFooter: {
    width: "100%",
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 7,
  },
  onboardingCardScroll: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "72%",
    borderRadius: 28,
    borderWidth: 1,
  },
  onboardingLogoImage: {
    width: 70,
    height: 70,
  },
  onboardingTitle: {
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  onboardingBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  onboardingButton: {
    minHeight: 52,
    minWidth: 230,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignSelf: "center",
  },
  onboardingButtonText: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  sanctuaryArtworkFrame: {
    height: 218,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sanctuaryArtworkImage: {
    width: "100%",
    height: "100%",
  },
  sanctuaryArtworkText: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
  },
  currentSanctuaryBanner: {
    height: 190,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  currentSanctuaryImage: {
    width: "100%",
    height: "100%",
  },
  currentSanctuaryCopy: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    gap: 5,
  },
  currentSanctuaryTitle: {
    color: "#F8F5FF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  currentSanctuaryText: {
    color: "#D4D8E0",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  currentSanctuaryBadge: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  currentSanctuaryActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  themePickerCard: {
    maxHeight: "88%",
    borderRadius: 28,
    borderWidth: 1,
    padding: 14,
  },
  themePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  themePickerSection: {
    marginTop: 10,
  },
  themePickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  themePickerTile: {
    width: "48%",
    minHeight: 178,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  themePickerImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  themePickerTileCopy: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 10,
    gap: 4,
  },
  themePickerTileTitle: {
    color: "#F8F5FF",
    fontSize: 15,
    fontWeight: "900",
  },
  themePickerTileSub: {
    color: "#D4D8E0",
    fontSize: 10,
    fontWeight: "700",
  },
  themePickerActions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  themePickerSmallButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "rgba(11,14,20,0.72)",
    paddingVertical: 7,
    alignItems: "center",
  },
  themePickerSmallText: {
    fontSize: 10,
    fontWeight: "900",
  },
  themeMilestoneRow: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  themeMilestoneImage: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  themeMilestoneTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  themeMilestoneSub: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  themeMilestoneBadge: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  themeModalImage: {
    width: "100%",
    height: "100%",
  },
  themeAmbientRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 10,
  },
  themeAmbientPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "800",
  },
  themePalettePill: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "800",
  },
  sanctuaryModalArtworkFrame: {
    height: 300,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sanctuaryModalArtwork: {
    width: "100%",
    height: "100%",
  },
  tabs: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 8,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#101723",
    borderRadius: 28,
    padding: 6,
    borderWidth: 1,
    borderColor: "#263142",
  },
  tabContentTransition: {
    flex: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 22,
  },
  tabActiveLift: {
    transform: [{ translateY: -1 }],
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tabPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  tabActive: {
    backgroundColor: "#F8EFE3",
  },
  tabText: {
    color: "#A9B3C3",
    fontWeight: "800",
    fontSize: 10,
  },
  tabTextActive: {
    color: "#0B0E14",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  firstWeekSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  firstWeekSheet: {
    maxHeight: "94%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },
  firstWeekSheetHeader: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
  },
  firstWeekHeroCopy: {
    flex: 1,
    alignItems: "flex-start",
  },
  firstWeekCelebrationIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  firstWeekCelebrationLogo: {
    width: 34,
    height: 34,
  },
  firstWeekHeroTitle: {
    marginTop: 5,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  firstWeekHeroSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  firstWeekSheetScroll: {
    padding: 18,
    paddingBottom: 28,
  },
  firstWeekPurchaseFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
  },
  purchaseSuccessRoot: {
    flex: 1,
  },
  purchaseSuccessContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 34,
  },
  purchaseSuccessParticle: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  purchaseSuccessGlow: {
    alignSelf: "center",
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 26,
  },
  purchaseSuccessLogo: {
    width: 96,
    height: 96,
  },
  purchaseSuccessKicker: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.1,
  },
  purchaseSuccessTitle: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  purchaseSuccessBody: {
    alignSelf: "center",
    maxWidth: 430,
    marginTop: 12,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  purchaseSuccessList: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    marginTop: 22,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 11,
  },
  purchaseSuccessListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  purchaseSuccessListText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  purchaseSuccessReward: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 22,
    padding: 10,
    gap: 12,
  },
  purchaseSuccessRewardImage: {
    width: 78,
    height: 78,
    borderRadius: 16,
  },
  purchaseSuccessRewardCopy: {
    flex: 1,
  },
  purchaseSuccessRewardLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  purchaseSuccessRewardTitle: {
    marginTop: 3,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
  },
  purchaseSuccessRewardBody: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
  },
  purchaseSuccessReminder: {
    alignSelf: "center",
    maxWidth: 430,
    marginTop: 20,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  purchaseSuccessButton: {
    width: "100%",
    maxWidth: 460,
    minHeight: 56,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  purchaseSuccessButtonText: {
    fontSize: 16,
    fontWeight: "900",
  },
  modalCard: {
    backgroundColor: "#151A24",
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "#263142",
  },
  reminderTimePicker: {
    width: "100%",
    height: 180,
    marginTop: 8,
  },
  reminderTimePreview: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  premiumModalCard: {
    backgroundColor: "#151A24",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "#263142",
  },
  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#263142",
    marginBottom: 18,
  },
  premiumModalIcon: {
    color: "#B894FF",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  premiumLotusIcon: {
    alignSelf: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  premiumModalTitle: {
    color: "#F2F4F8",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.8,
  },
  premiumModalBody: {
    color: "#A9B3C3",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  premiumHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  weeklyDetailCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  weeklySummaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  weeklySummaryPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  weeklySummaryText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  weeklyModalTitle: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
  },
  weeklyModalBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  weeklyExperimentBox: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  weeklyRewardCard: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  weeklyRewardImage: {
    width: 74,
    height: 74,
    borderRadius: 18,
  },
  weeklyRewardCopy: {
    flex: 1,
    minWidth: 0,
  },
  firstWeekContinueTitle: {
    marginTop: 18,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
  },
  firstWeekContinueBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  firstWeekEmotionalBridge: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "900",
  },
  firstWeekValueCard: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  firstWeekSectionTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
    marginBottom: 2,
  },
  firstWeekValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  firstWeekValueText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  firstWeekFutureDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginLeft: 5,
    marginRight: 6,
  },
  firstWeekYearlyPlanCard: {
    minHeight: 102,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  firstWeekOwnershipNote: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  firstWeekSelectedPlan: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  firstWeekSelectedPlanTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  firstWeekSelectedPlanDetail: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "800",
  },
  weeklyProgressMessage: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  weeklyHistoryScroll: {
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  premiumPerkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  premiumPerkDot: {
    color: "#D8C4FF",
    fontSize: 18,
    fontWeight: "900",
  },
  premiumPerkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(184,148,255,0.10)",
  },
  premiumPerkIconText: {
    fontSize: 14,
    fontWeight: "900",
  },
  premiumPerkText: {
    color: "#F2F4F8",
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  premiumUpgradeButton: {
    borderRadius: 20,
    overflow: "hidden",
    marginTop: 8,
  },
  premiumUpgradeGradient: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  premiumUpgradeText: {
    color: "#081014",
    fontSize: 17,
    fontWeight: "900",
  },
  premiumPriceNote: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  premiumCloseButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  premiumCloseText: {
    color: "#7E8B9D",
    fontSize: 14,
    fontWeight: "800",
  },
  modalCardShort: {
    padding: 20,
    borderRadius: 24,
  },
  modalClose: {
    alignSelf: "flex-end",
    marginBottom: 8,
  },
  modalCloseText: {
    color: "#5B6478",
    fontSize: 20,
    fontWeight: "700",
  },
  kicker: {
    color: "#B894FF",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kickerShort: {
    fontSize: 10,
  },
  modalUserEntry: {
    color: "#F2F4F8",
    fontSize: 15,
    fontStyle: "italic",
    lineHeight: 21,
  },
  modalUserEntryShort: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalMessage: {
    color: "#D4D8E0",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalMessageShort: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  nextStepBox: {
    backgroundColor: "#1E2938",
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#B894FF",
  },
  nextStepBoxShort: {
    padding: 14,
    borderRadius: 14,
  },
  nextStepLabel: {
    color: "#B894FF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  nextStepLabelShort: {
    fontSize: 9,
  },
  nextStep: {
    color: "#E8D5B7",
    fontSize: 14,
    lineHeight: 20,
  },
  nextStepShort: {
    fontSize: 12,
    lineHeight: 17,
  },
  historyItem: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#151A24",
    borderWidth: 1,
    borderColor: "#263142",
    marginBottom: 10,
  },
  onboardingTimelineItem: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  onboardingTimelineTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  onboardingTimelineBody: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
  onboardingSecondaryButton: {
    minHeight: 44,
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  onboardingBillingNote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  onboardingDivider: {
    width: 84,
    height: 1,
    alignSelf: "center",
    opacity: 0.55,
  },
  onboardingNameField: {
    width: "100%",
    alignSelf: "center",
    marginTop: 8,
  },
  onboardingInputLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
  },
  onboardingInput: {
    width: "100%",
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    textAlign: "left",
  },
  onboardingTrialItem: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  onboardingTrialBody: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  onboardingTrialTitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "900",
  },
  premiumPlanGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  premiumPlanCard: {
    flex: 1,
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    justifyContent: "center",
  },
  premiumPlanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  premiumPlanName: {
    fontSize: 14,
    fontWeight: "900",
  },
  premiumPlanBadge: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  premiumPlanPrice: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: "900",
  },
  premiumPlanDetail: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
  },
  subscriptionPlanSummary: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  subscriptionPlanPrice: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: "900",
  },
  subscriptionRestoreButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  date: {
    color: "#7E8B9D",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  historyText: {
    color: "#F7F1E8",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
  },
  coachMarkOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  coachMarkOverlayMic: {
    justifyContent: "flex-start",
    paddingTop: 170,
    paddingBottom: 24,
  },
  coachMarkCard: {
    position: "absolute",
    left: 18,
    right: 18,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.26,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  coachMarkHighlight: {
    position: "absolute",
    borderWidth: 2,
    shadowOpacity: 0.8,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 15,
  },
  coachMarkHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  coachMarkHeadingCopy: {
    flex: 1,
    paddingRight: 8,
  },
  coachMarkKicker: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  coachMarkTitle: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: "900",
  },
  coachMarkTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  coachMarkCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coachMarkCloseText: {
    fontSize: 12,
    fontWeight: "900",
  },
  coachMarkBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  coachMarkProgressBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "900",
  },
  coachMarkActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  coachMarkPrimary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  coachMarkPrimaryText: {
    fontSize: 14,
    fontWeight: "900",
  },
  onboardingCompleteCard: {
    position: "absolute",
    left: 28,
    right: 28,
    top: "31%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  onboardingCompleteTitle: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  onboardingCompleteBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  onboardingCompleteButton: {
    marginTop: 18,
    minHeight: 46,
    width: "100%",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  firstWeekBanner: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: -2,
    marginBottom: 2,
  },
  firstWeekBannerStrong: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  firstWeekBannerText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
});

function dateFromReminderTime(value: string) {
  const [hours = "19", minutes = "30"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date;
}

function reminderTimeFromDate(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}
