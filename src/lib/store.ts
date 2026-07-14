"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  CheckIn,
  CoachReply,
  DeepInsight,
  Mood,
  SanctuarySceneConfig,
  SanctuarySceneVersion,
  Settings,
  todayKey,
} from "./types";
import { hasTranqlyAccess, normalizeComplimentaryAccess } from "./access";
import { DEFAULT_NOTIFICATION_SETTINGS } from "./notifications";
import {
  buildDemoCheckIns,
  buildDemoCoachNotes,
  buildDemoDeepInsight,
  buildDemoMoods,
  buildFirstWeekTrialDemo,
  isDemoCheckIn,
  isDemoNote,
} from "./demoData";
import {
  DEFAULT_SANCTUARY_SCENES,
  duplicateScene,
  nextSceneVersion,
  validateSceneForPublish,
} from "./sanctuaryScenes";

const FREE_COACH_PER_DAY = 5;
const STORE_KEY = "tranqly-v1";
const LEGACY_STORE_KEY = "dailyai-coach-v1";

if (typeof window !== "undefined") {
  const existing = window.localStorage.getItem(STORE_KEY);
  const legacy = window.localStorage.getItem(LEGACY_STORE_KEY);
  if (!existing && legacy) {
    window.localStorage.setItem(STORE_KEY, legacy);
  }
}

export interface AppState {
  checkIns: CheckIn[];
  moods: Record<string, Mood>; // dateKey -> mood
  settings: Settings;
  lastDeepInsight: DeepInsight | null;
  weeklyInsights: DeepInsight[];
  coachUsage: { dateKey: string; count: number };
  coachNotes: string[]; // what the coach has learned about the user
  sanctuaryScenes: SanctuarySceneConfig[];
  sanctuarySceneVersions: SanctuarySceneVersion[];
  updatedAt: string;
  hydrated: boolean;

  addCheckIn: (
    text: string,
    meta?: { source?: "voice" | "typed"; prompt?: string; promptType?: string; promptWhy?: string }
  ) => CheckIn;
  addCoachNote: (note: string) => void;
  clearCoachNotes: () => void;
  removeCoachNote: (note: string) => void;
  attachReply: (id: string, reply: CoachReply) => void;
  deleteCheckIn: (id: string) => void;
  deleteAllReflections: () => void;
  addDemoData: () => void;
  addFirstWeekTrialDemo: () => void;
  removeDemoData: () => void;
  setMood: (mood: Mood) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setDeepInsight: (insight: DeepInsight) => void;
  canUseCoach: () => boolean;
  coachRemaining: () => number;
  recordCoachUse: () => void;
  setPremium: (premium: boolean) => void;
  saveSceneDraft: (scene: SanctuarySceneConfig) => void;
  publishScene: (sceneId: string, publishedBy?: string) => string[];
  setSceneStatus: (sceneId: string, status: SanctuarySceneConfig["status"]) => void;
  duplicateScene: (sceneId: string) => void;
  deleteScene: (sceneId: string) => void;
  rollbackScene: (sceneId: string, versionNumber: number) => void;
  mergeRemote: (remote: RemoteSnapshot) => void;
  snapshot: () => RemoteSnapshot;
  setHydrated: () => void;
}

export interface RemoteSnapshot {
  checkIns: CheckIn[];
  moods: Record<string, Mood>;
  settings: Settings;
  coachNotes?: string[];
  weeklyInsights?: DeepInsight[];
  updatedAt: string;
}

const MAX_COACH_NOTES = 20;

function weeklyInsightKey(insight: DeepInsight) {
  const date = new Date(insight.weekStart ?? insight.createdAt);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return insight.weekStart ?? date.toISOString().slice(0, 10);
}

function dedupeWeeklyInsights(insights: DeepInsight[]) {
  const byWeek = new Map<string, DeepInsight>();
  for (const insight of [...insights].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = weeklyInsightKey(insight);
    if (!byWeek.has(key)) byWeek.set(key, insight);
  }
  return [...byWeek.values()].slice(0, 52);
}

const defaultSettings: Settings = {
  name: "",
  premium: false,
  soundOn: true,
  theme: "twilight",
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  onboarded: false,
  onboardingCoachCompleted: false,
  onboardingCoachStep: null,
  onboardingSkippedAt: null,
  onboardingCompletedAt: null,
  reflectionCoachMarkSeen: false,
  journeyCoachMarkSeen: false,
  sanctuaryCoachMarkSeen: false,
  onboardingStatus: "not_started",
  currentOnboardingStep: "firstWeek",
  onboardingVersion: 2,
  complimentaryAccess: null,
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      checkIns: [],
      moods: {},
      settings: defaultSettings,
      lastDeepInsight: null,
      weeklyInsights: [],
      coachUsage: { dateKey: todayKey(), count: 0 },
      coachNotes: [],
      sanctuaryScenes: DEFAULT_SANCTUARY_SCENES,
      sanctuarySceneVersions: [],
      updatedAt: new Date(0).toISOString(),
      hydrated: false,

      addCoachNote: (note) => {
        const clean = note.trim();
        if (!clean) return;
        set((s) => {
          if (s.coachNotes.includes(clean)) return s;
          return {
            coachNotes: [clean, ...s.coachNotes].slice(0, MAX_COACH_NOTES),
            updatedAt: new Date().toISOString(),
          };
        });
      },

      clearCoachNotes: () =>
        set({ coachNotes: [], updatedAt: new Date().toISOString() }),
      removeCoachNote: (note) => set((s) => ({ coachNotes: s.coachNotes.filter((item) => item !== note), updatedAt: new Date().toISOString() })),

      addCheckIn: (text, meta) => {
        const entry: CheckIn = {
          id: crypto.randomUUID(),
          text: text.trim(),
          createdAt: new Date().toISOString(),
          dateKey: todayKey(),
          source: meta?.source ?? "typed",
          prompt: meta?.prompt,
          promptType: meta?.promptType,
          promptWhy: meta?.promptWhy,
        };
        set((s) => ({
          checkIns: [entry, ...s.checkIns],
          updatedAt: new Date().toISOString(),
        }));
        return entry;
      },

      attachReply: (id, reply) =>
        set((s) => ({
          checkIns: s.checkIns.map((c) =>
            c.id === id ? { ...c, reply } : c
          ),
          updatedAt: new Date().toISOString(),
        })),

      deleteCheckIn: (id) =>
        set((s) => ({
          checkIns: s.checkIns.filter((c) => c.id !== id),
          updatedAt: new Date().toISOString(),
        })),

      deleteAllReflections: () =>
        set({
          checkIns: [],
          coachNotes: [],
          lastDeepInsight: null,
          weeklyInsights: [],
          moods: {},
          updatedAt: new Date().toISOString(),
        }),

      addDemoData: () =>
        set((s) => {
          const demoCheckIns = buildDemoCheckIns();
          const existingReal = s.checkIns.filter((entry) => !isDemoCheckIn(entry));
          const demoMoods = buildDemoMoods();
          const demoNotes = buildDemoCoachNotes();
          return {
            checkIns: [...demoCheckIns, ...existingReal].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            ),
            moods: { ...demoMoods, ...s.moods },
            coachNotes: [
              ...demoNotes,
              ...s.coachNotes.filter((note) => !isDemoNote(note)),
            ].slice(0, MAX_COACH_NOTES),
            lastDeepInsight: buildDemoDeepInsight(),
            weeklyInsights: [buildDemoDeepInsight(), ...s.weeklyInsights.filter((insight) => !insight.isDemo)],
            updatedAt: new Date().toISOString(),
          };
        }),

      addFirstWeekTrialDemo: () =>
        set((s) => {
          const demo = buildFirstWeekTrialDemo();
          const existingReal = s.checkIns.filter((entry) => !isDemoCheckIn(entry));
          const demoNotes = buildDemoCoachNotes();
          return {
            checkIns: [...demo.checkIns, ...existingReal].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            ),
            moods: { ...demo.moods, ...s.moods },
            coachNotes: [
              ...demoNotes,
              ...s.coachNotes.filter((note) => !isDemoNote(note)),
            ].slice(0, MAX_COACH_NOTES),
            lastDeepInsight: demo.deepInsight,
            weeklyInsights: [demo.deepInsight, ...s.weeklyInsights.filter((insight) => !insight.isDemo)],
            settings: {
              ...s.settings,
              premium: false,
              complimentaryAccess: demo.complimentaryAccess,
            },
            updatedAt: new Date().toISOString(),
          };
        }),

      removeDemoData: () =>
        set((s) => {
          const demoDateKeys = new Set([
            ...buildDemoCheckIns(),
            ...buildFirstWeekTrialDemo().checkIns,
          ].map((entry) => entry.dateKey));
          const remainingCheckIns = s.checkIns.filter((entry) => !isDemoCheckIn(entry));
          const remainingDateKeys = new Set(remainingCheckIns.map((entry) => entry.dateKey));
          const remainingMoods = { ...s.moods };
          for (const dateKey of demoDateKeys) {
            if (!remainingDateKeys.has(dateKey)) delete remainingMoods[dateKey];
          }
          return {
            checkIns: remainingCheckIns,
            moods: remainingMoods,
            coachNotes: s.coachNotes.filter((note) => !isDemoNote(note)),
            lastDeepInsight: s.lastDeepInsight?.isDemo ? null : s.lastDeepInsight,
            weeklyInsights: s.weeklyInsights.filter((insight) => !insight.isDemo),
            settings: s.settings.complimentaryAccess?.isDemo
              ? { ...s.settings, complimentaryAccess: null }
              : s.settings,
            updatedAt: new Date().toISOString(),
          };
        }),

      setMood: (mood) =>
        set((s) => ({
          moods: { ...s.moods, [todayKey()]: mood },
          updatedAt: new Date().toISOString(),
        })),

      updateSettings: (patch) =>
        set((s) => ({
          settings: { ...s.settings, ...patch },
          updatedAt: new Date().toISOString(),
        })),

      setDeepInsight: (insight) => set((s) => ({
        lastDeepInsight: insight,
        weeklyInsights: dedupeWeeklyInsights([insight, ...s.weeklyInsights]),
      })),

      canUseCoach: () => {
        const state = get();
        if (hasTranqlyAccess(state.settings.premium, state.settings.complimentaryAccess)) return true;
        const usage =
          state.coachUsage.dateKey === todayKey()
            ? state.coachUsage
            : { dateKey: todayKey(), count: 0 };
        return usage.count < FREE_COACH_PER_DAY;
      },

      coachRemaining: () => {
        const state = get();
        if (hasTranqlyAccess(state.settings.premium, state.settings.complimentaryAccess)) return Infinity;
        const usage =
          state.coachUsage.dateKey === todayKey()
            ? state.coachUsage
            : { dateKey: todayKey(), count: 0 };
        return Math.max(0, FREE_COACH_PER_DAY - usage.count);
      },

      recordCoachUse: () =>
        set((s) => ({
          coachUsage:
            s.coachUsage.dateKey === todayKey()
              ? { ...s.coachUsage, count: s.coachUsage.count + 1 }
              : { dateKey: todayKey(), count: 1 },
        })),

      setPremium: (premium) =>
        set((s) => ({
          settings: { ...s.settings, premium },
          updatedAt: new Date().toISOString(),
        })),

      saveSceneDraft: (scene) =>
        set((s) => {
          const now = new Date().toISOString();
          const next = { ...scene, status: scene.status || "draft", updatedAt: now };
          const exists = s.sanctuaryScenes.some((item) => item.id === scene.id);
          return {
            sanctuaryScenes: exists
              ? s.sanctuaryScenes.map((item) => (item.id === scene.id ? next : item))
              : [...s.sanctuaryScenes, next],
            updatedAt: now,
          };
        }),

      publishScene: (sceneId, publishedBy = "local-admin") => {
        const state = get();
        const scene = state.sanctuaryScenes.find((item) => item.id === sceneId);
        if (!scene) return ["Scene not found."];
        const errors = validateSceneForPublish(scene, state.sanctuaryScenes);
        if (errors.length) return errors;
        const now = new Date().toISOString();
        const publishedScene: SanctuarySceneConfig = {
          ...scene,
          status: "live",
          publishedAt: scene.publishedAt ?? now,
          updatedAt: now,
        };
        const version: SanctuarySceneVersion = {
          sceneId,
          versionNumber: nextSceneVersion(sceneId, state.sanctuarySceneVersions),
          config: publishedScene,
          publishedAt: now,
          publishedBy,
        };
        set((s) => ({
          sanctuaryScenes: s.sanctuaryScenes.map((item) =>
            item.id === sceneId ? publishedScene : item
          ),
          sanctuarySceneVersions: [...s.sanctuarySceneVersions, version],
          updatedAt: now,
        }));
        return [];
      },

      setSceneStatus: (sceneId, status) =>
        set((s) => ({
          sanctuaryScenes: s.sanctuaryScenes.map((item) =>
            item.id === sceneId
              ? { ...item, status, updatedAt: new Date().toISOString() }
              : item
          ),
          updatedAt: new Date().toISOString(),
        })),

      duplicateScene: (sceneId) =>
        set((s) => {
          const scene = s.sanctuaryScenes.find((item) => item.id === sceneId);
          if (!scene) return s;
          return {
            sanctuaryScenes: [...s.sanctuaryScenes, duplicateScene(scene)],
            updatedAt: new Date().toISOString(),
          };
        }),

      deleteScene: (sceneId) =>
        set((s) => ({
          sanctuaryScenes: s.sanctuaryScenes.filter((item) => item.id !== sceneId),
          sanctuarySceneVersions: s.sanctuarySceneVersions.filter(
            (version) => version.sceneId !== sceneId
          ),
          settings:
            s.settings.activeSceneId === sceneId
              ? { ...s.settings, activeSceneId: undefined }
              : s.settings,
          updatedAt: new Date().toISOString(),
        })),

      rollbackScene: (sceneId, versionNumber) =>
        set((s) => {
          const version = s.sanctuarySceneVersions.find(
            (item) => item.sceneId === sceneId && item.versionNumber === versionNumber
          );
          if (!version) return s;
          const now = new Date().toISOString();
          return {
            sanctuaryScenes: s.sanctuaryScenes.map((item) =>
              item.id === sceneId
                ? { ...version.config, status: "live", updatedAt: now }
                : item
            ),
            updatedAt: now,
          };
        }),

      mergeRemote: (remote) => {
        const local = get();
        const byId = new Map<string, CheckIn>();
        for (const c of [...remote.checkIns, ...local.checkIns]) {
          const existing = byId.get(c.id);
          // Prefer the copy that has a coach reply attached
          byId.set(c.id, existing?.reply && !c.reply ? existing : c);
        }
        const checkIns = [...byId.values()].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        );
        const remoteNewer = remote.updatedAt > local.updatedAt;
        const coachNotes = [
          ...new Set([...(remote.coachNotes ?? []), ...local.coachNotes]),
        ].slice(0, MAX_COACH_NOTES);
        const weeklyInsights = dedupeWeeklyInsights([...(remote.weeklyInsights ?? []), ...local.weeklyInsights]);
        set({
          checkIns,
          coachNotes,
          weeklyInsights,
          lastDeepInsight: weeklyInsights[0] ?? local.lastDeepInsight,
          moods: remoteNewer
            ? { ...local.moods, ...remote.moods }
            : { ...remote.moods, ...local.moods },
          settings: remoteNewer
            ? {
                ...local.settings,
                ...remote.settings,
                complimentaryAccess: normalizeComplimentaryAccess(remote.settings.complimentaryAccess ?? local.settings.complimentaryAccess),
                notificationSettings: {
                  ...DEFAULT_NOTIFICATION_SETTINGS,
                  ...local.settings.notificationSettings,
                  ...remote.settings.notificationSettings,
                },
              }
            : {
                ...remote.settings,
                ...local.settings,
                complimentaryAccess: normalizeComplimentaryAccess(local.settings.complimentaryAccess ?? remote.settings.complimentaryAccess),
                notificationSettings: {
                  ...DEFAULT_NOTIFICATION_SETTINGS,
                  ...remote.settings.notificationSettings,
                  ...local.settings.notificationSettings,
                },
              },
          updatedAt: new Date().toISOString(),
        });
      },

      snapshot: () => {
        const { checkIns, moods, settings, coachNotes, weeklyInsights, updatedAt } = get();
        return { checkIns, moods, settings, coachNotes, weeklyInsights, updatedAt };
      },

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: STORE_KEY,
      partialize: (s) => ({
        checkIns: s.checkIns,
        moods: s.moods,
        settings: s.settings,
        lastDeepInsight: s.lastDeepInsight,
        weeklyInsights: s.weeklyInsights,
        coachUsage: s.coachUsage,
        coachNotes: s.coachNotes,
        sanctuaryScenes: s.sanctuaryScenes,
        sanctuarySceneVersions: s.sanctuarySceneVersions,
        updatedAt: s.updatedAt,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          // Older persisted snapshots may predate new settings fields
          settings:
            {
              ...current.settings,
              ...(p.settings ?? {}),
              complimentaryAccess: normalizeComplimentaryAccess(p.settings?.complimentaryAccess ?? current.settings.complimentaryAccess),
              notificationSettings: {
                ...DEFAULT_NOTIFICATION_SETTINGS,
                ...current.settings.notificationSettings,
                ...(p.settings?.notificationSettings ?? {}),
              },
            },
          sanctuaryScenes:
            p.sanctuaryScenes && p.sanctuaryScenes.length
              ? p.sanctuaryScenes
              : current.sanctuaryScenes,
          sanctuarySceneVersions: p.sanctuarySceneVersions ?? current.sanctuarySceneVersions,
          weeklyInsights: p.weeklyInsights?.length
            ? dedupeWeeklyInsights(p.weeklyInsights)
            : p.lastDeepInsight
              ? [p.lastDeepInsight]
              : current.weeklyInsights,
        };
      },
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    }
  )
);
