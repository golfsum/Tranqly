"use client";

import { User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { DEFAULT_NOTIFICATION_SETTINGS } from "./notifications";
import { RemoteSnapshot } from "./store";
import { CheckIn, Settings } from "./types";
import { isThemeUnlocked, themesByUnlockOrder } from "./themes";

export type PlatformName = "ios" | "web";
export type SupportCategory =
  | "login"
  | "billing"
  | "recording"
  | "insights"
  | "account"
  | "bug"
  | "feedback"
  | "other";

export interface SafeUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  onboardingCompleted: boolean;
  onboardingCoachStep: "mic" | "journey" | "sanctuary" | null;
  onboardingSkippedAt: string | null;
  onboardingCompletedAt: string | null;
  authProvider: string;
  createdAt: unknown;
  lastLoginAt: unknown;
  lastActiveAt: unknown;
  subscriptionStatus: string;
  plan: string;
  platformLastUsed: PlatformName;
  appVersion: string;
  osVersion: string;
  browserName: string;
  browserVersion: string;
  selectedTheme: string;
  streakCount: number;
  reflectionCount: number;
  lastReflectionAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  supportAccessEnabled: false;
  updatedAt: unknown;
}

export interface SafeReflectionMetadata {
  id: string;
  createdAt: string;
  inputType: "voice" | "text";
  durationSeconds?: number;
  transcriptStatus: "not_needed" | "pending" | "complete" | "failed";
  insightStatus: "pending" | "complete" | "failed";
  wordCount: number;
  errorCode?: string;
  errorMessage?: string;
  processingTimeMs?: number;
}

export interface SupportTicketInput {
  subject: string;
  message: string;
  category: SupportCategory;
}

const WAITLIST_COLLECTION = "waitlistSignups";
export const WAITLIST_MAX_SPOTS = 25;
export const WAITLIST_SUPPORT_EMAIL = "support@tranqly.com";

function browserInfo() {
  if (typeof navigator === "undefined") {
    return { browserName: "unknown", browserVersion: "unknown", osVersion: "unknown" };
  }
  const ua = navigator.userAgent;
  const browserName = ua.includes("Edg/")
    ? "Edge"
    : ua.includes("Chrome/")
      ? "Chrome"
      : ua.includes("Safari/")
        ? "Safari"
        : ua.includes("Firefox/")
          ? "Firefox"
          : "unknown";
  const browserVersion =
    ua.match(/(Chrome|Firefox|Version|Edg)\/([\d.]+)/)?.[2] ?? "unknown";
  const osVersion =
    ua.match(/Windows NT [\d.]+|Mac OS X [\d_]+|iPhone OS [\d_]+|Android [\d.]+/)?.[0] ??
    "unknown";
  return { browserName, browserVersion, osVersion };
}

function authProvider(user: User) {
  return user.providerData.map((provider) => provider.providerId).join(",") || "password";
}

export function safeReflectionMetadata(entry: CheckIn): SafeReflectionMetadata {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    inputType: entry.source === "voice" ? "voice" : "text",
    transcriptStatus: entry.source === "voice" ? "complete" : "not_needed",
    insightStatus: entry.reply ? "complete" : "pending",
    wordCount: entry.text.trim().split(/\s+/).filter(Boolean).length,
  };
}

export function buildSafeUserProfile({
  user,
  snapshot,
  settings,
  streakCount,
}: {
  user: User;
  snapshot: RemoteSnapshot;
  settings: Settings;
  streakCount: number;
}): SafeUserProfile {
  const { browserName, browserVersion, osVersion } = browserInfo();
  const lastReflection = snapshot.checkIns[0]?.createdAt ?? null;
  const displayName = settings.name.trim() || null;
  return {
    uid: user.uid,
    email: user.email,
    displayName,
    onboardingCompleted: Boolean(settings.onboarded && settings.onboardingCoachCompleted),
    onboardingCoachStep: settings.onboardingCoachStep ?? null,
    onboardingSkippedAt: settings.onboardingSkippedAt ?? null,
    onboardingCompletedAt: settings.onboardingCompletedAt ?? null,
    authProvider: authProvider(user),
    createdAt: user.metadata.creationTime ?? serverTimestamp(),
    lastLoginAt: user.metadata.lastSignInTime ?? serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    subscriptionStatus: settings.premium ? "active" : "free",
    plan: settings.premium ? "premium" : "free",
    platformLastUsed: "web",
    appVersion: "web-local",
    osVersion,
    browserName,
    browserVersion,
    selectedTheme: settings.theme,
    streakCount,
    reflectionCount: snapshot.checkIns.length,
    lastReflectionAt: lastReflection,
    lastErrorAt: null,
    lastErrorCode: null,
    supportAccessEnabled: false,
    updatedAt: serverTimestamp(),
  };
}

export async function writeSafeUserProfile(profile: SafeUserProfile) {
  const fb = getFirebase();
  if (!fb) return;
  const ref = doc(fb.db, "users", profile.uid);
  const existing = await getDoc(ref);
  const payload: Partial<SafeUserProfile> = {
    ...profile,
    displayName: profile.displayName?.trim() || null,
    updatedAt: serverTimestamp(),
  };
  if (existing.exists() && existing.data().createdAt) {
    delete payload.createdAt;
  }
  await setDoc(ref, payload, { merge: true });
}

export async function writePrivateSnapshot(uid: string, snapshot: RemoteSnapshot) {
  const fb = getFirebase();
  if (!fb) return;
  await setDoc(doc(fb.db, "users", uid, "private", "appState"), snapshot, { merge: true });
  await setDoc(
    doc(fb.db, "users", uid, "metadata", "reflections"),
    {
      updatedAt: serverTimestamp(),
      items: snapshot.checkIns.slice(0, 50).map(safeReflectionMetadata),
    },
    { merge: true }
  );
}

export async function writeNotificationSettings(uid: string, settings: Settings) {
  const fb = getFirebase();
  if (!fb) return;
  await setDoc(
    doc(fb.db, "users", uid, "notificationSettings", "preferences"),
    {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(settings.notificationSettings ?? {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function writeSanctuaryUnlockMetadata(uid: string, settings: Settings, reflectionCount: number) {
  const fb = getFirebase();
  if (!fb) return;
  const themes = themesByUnlockOrder().filter((theme) => isThemeUnlocked(theme, reflectionCount, settings.premium));
  await Promise.all(
    themes.map((theme) =>
      setDoc(
        doc(fb.db, "users", uid, "sanctuaryUnlocks", theme.key),
        {
          themeId: theme.key,
          unlockedAt: serverTimestamp(),
          notificationSentAt: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

export async function createSupportTicket(user: User | null, input: SupportTicketInput) {
  const fb = getFirebase();
  if (!fb || !user) throw new Error("Sign in before contacting support.");
  const { browserName, browserVersion, osVersion } = browserInfo();
  const ticket = {
    uid: user.uid,
    email: user.email,
    subject: input.subject.trim(),
    message: input.message.trim(),
    category: input.category,
    platform: "web",
    appVersion: "web-local",
    deviceModel: "browser",
    osVersion,
    browserName,
    browserVersion,
    status: "open",
    priority: "normal",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastUserReplyAt: serverTimestamp(),
    lastAdminReplyAt: null,
  };
  const ref = await addDoc(collection(fb.db, "supportTickets"), ticket);
  await setDoc(doc(fb.db, "supportTickets", ref.id), { ticketId: ref.id }, { merge: true });
  await addDoc(collection(fb.db, "supportTickets", ref.id, "messages"), {
    senderType: "user",
    senderUid: user.uid,
    message: input.message.trim(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listMySupportTickets(uid: string) {
  const fb = getFirebase();
  if (!fb) return [];
  const snap = await getDocs(
    query(collection(fb.db, "supportTickets"), where("uid", "==", uid), orderBy("updatedAt", "desc"), limit(10))
  );
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listAdminSupportTickets() {
  const fb = getFirebase();
  if (!fb) return [];
  const snap = await getDocs(query(collection(fb.db, "supportTickets"), orderBy("updatedAt", "desc"), limit(50)));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listAdminUsers() {
  const fb = getFirebase();
  if (!fb) return [];
  const snap = await getDocs(query(collection(fb.db, "users"), orderBy("lastActiveAt", "desc"), limit(100)));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listAdminErrors() {
  const fb = getFirebase();
  if (!fb) return [];
  const snap = await getDocs(query(collection(fb.db, "adminErrors"), orderBy("createdAt", "desc"), limit(100)));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listAdminAiUsage() {
  const fb = getFirebase();
  if (!fb) return { periods: [], users: [], logs: [] };
  const [periods, users, logs] = await Promise.all([
    getDocs(query(collection(fb.db, "adminAiUsage"), orderBy("updatedAt", "desc"), limit(20))),
    getDocs(query(collection(fb.db, "adminAiUserUsage"), orderBy("totalCalls", "desc"), limit(20))),
    getDocs(query(collection(fb.db, "aiUsageLogs"), orderBy("createdAt", "desc"), limit(100))),
  ]);
  return {
    periods: periods.docs.map((item) => ({ id: item.id, ...item.data() })),
    users: users.docs.map((item) => ({ id: item.id, ...item.data() })),
    logs: logs.docs.map((item) => ({ id: item.id, ...item.data() })),
  };
}

export async function listWaitlistSignups() {
  const fb = getFirebase();
  if (!fb) return [];
  const snap = await getDocs(query(collection(fb.db, WAITLIST_COLLECTION), orderBy("createdAt", "asc"), limit(50)));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listAdminWaitlistSignups() {
  const fb = getFirebase();
  if (!fb) return [];
  const snap = await getDocs(query(collection(fb.db, WAITLIST_COLLECTION), orderBy("createdAt", "desc"), limit(50)));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function createWaitlistSignup(email: string) {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase not configured for waitlist signups.");
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Enter your email first.");
  const docId = encodeURIComponent(normalizedEmail);
  const ref = doc(fb.db, WAITLIST_COLLECTION, docId);
  const existing = await getDoc(ref);
  const all = await getDocs(query(collection(fb.db, WAITLIST_COLLECTION), orderBy("createdAt", "asc"), limit(50)));
  const currentCount = all.size;
  if (!existing.exists() && currentCount >= WAITLIST_MAX_SPOTS) {
    throw new Error("All 25 early access spots are filled.");
  }
  if (existing.exists()) {
    return { count: currentCount, alreadyJoined: true };
  }
  await setDoc(ref, {
    email: normalizedEmail,
    recipientEmail: WAITLIST_SUPPORT_EMAIL,
    source: "coming_soon",
    status: "new",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { count: currentCount + 1, alreadyJoined: false };
}
