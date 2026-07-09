"use client";

import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebase } from "./firebase";
import { RemoteSnapshot, useApp } from "./store";
import {
  buildSafeUserProfile,
  writeNotificationSettings,
  writePrivateSnapshot,
  writeSanctuaryUnlockMetadata,
  writeSafeUserProfile,
} from "./adminSupport";
import { currentStreak } from "./streak";

/**
 * Cloud sync hook. When signed in:
 *  - pulls users/{uid}/private/appState once and merges with local state
 *  - pushes the full snapshot (debounced) whenever local state changes
 *
 * Privacy boundary:
 *  - users/{uid} is safe admin metadata only
 *  - users/{uid}/private/appState contains private reflection content
 */
export function useSync() {
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) return;
    return onAuthStateChanged(fb.auth, setUser);
  }, []);

  // Initial pull + merge on sign-in
  useEffect(() => {
    const fb = getFirebase();
    if (!fb || !user) return;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const ref = doc(fb.db, "users", user.uid, "private", "appState");
        const snap = await getDoc(ref);
        if (!cancelled && snap.exists()) {
          useApp.getState().mergeRemote(snap.data() as RemoteSnapshot);
        }
        const state = useApp.getState();
        const snapshot = state.snapshot();
        await writePrivateSnapshot(user.uid, snapshot);
        await writeSafeUserProfile(
          buildSafeUserProfile({
            user,
            snapshot,
            settings: state.settings,
            streakCount: currentStreak(state.checkIns),
          })
        );
        await writeNotificationSettings(user.uid, state.settings);
        await writeSanctuaryUnlockMetadata(user.uid, state.settings, state.checkIns.length);
      } catch (err) {
        console.warn("Sync pull failed:", err);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Debounced push on any change
  useEffect(() => {
    const fb = getFirebase();
    if (!fb || !user) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastPushed = useApp.getState().updatedAt;

    const unsub = useApp.subscribe((state) => {
      if (state.updatedAt === lastPushed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        lastPushed = state.updatedAt;
        try {
          const snapshot = state.snapshot();
          await writePrivateSnapshot(user.uid, snapshot);
          await writeSafeUserProfile(
            buildSafeUserProfile({
              user,
              snapshot,
              settings: state.settings,
              streakCount: currentStreak(state.checkIns),
            })
          );
          await writeNotificationSettings(user.uid, state.settings);
          await writeSanctuaryUnlockMetadata(user.uid, state.settings, state.checkIns.length);
        } catch (err) {
          console.warn("Sync push failed:", err);
        }
      }, 1500);
    });

    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  return { user, syncing };
}
