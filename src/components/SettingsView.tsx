"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { createSupportTicket, listMySupportTickets, SupportCategory } from "@/lib/adminSupport";
import { getFirebase } from "@/lib/firebase";
import { DEFAULT_NOTIFICATION_SETTINGS, formatHourLabel, QUIET_MINUTE_OPTIONS } from "@/lib/notifications";
import { getPasswordStrength, isPasswordValid, passwordRuleItems } from "@/lib/authRules";
import { useApp } from "@/lib/store";
import { THEMES, isThemeUnlocked, themeByKey, themeUnlockLabel, themesByUnlockOrder } from "@/lib/themes";

type ThemeIconName =
  | "lotus"
  | "moon"
  | "sunset"
  | "wave"
  | "tree"
  | "mountain"
  | "cloud"
  | "cactus"
  | "snowflake"
  | "aurora";

const THEME_COPY = Object.fromEntries(
  THEMES.map((theme) => [
    theme.key,
    {
      description: theme.feeling,
      preview: theme.description,
      panel: [theme.bg, theme.card, theme.ink] as [string, string, string],
      icon: theme.icon as ThemeIconName,
      artwork: theme.artwork,
      ambient: theme.ambient,
      palette: theme.palette,
    },
  ])
) as Record<
  string,
  {
    description: string;
    preview: string;
    panel: [string, string, string];
    icon: ThemeIconName;
    artwork: string;
    ambient: string[];
    palette: string[];
  }
>;

const THEMES_BY_UNLOCK = themesByUnlockOrder();

function ThemeIcon({
  type,
  color,
  className = "h-8 w-8",
}: {
  type: ThemeIconName;
  color: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      {type === "moon" && (
        <>
          <path
            d="M31 7c-8 2-14 9-14 17 0 8 6 15 14 17-3 2-6 3-10 3C11 44 4 36 4 26 4 15 12 7 23 7c3 0 6 0 8 0Z"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M34 17l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z"
            stroke={color}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </>
      )}
      {type === "sunset" && (
        <>
          <path d="M8 31h32M14 31a10 10 0 0 1 20 0" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <path d="M24 8v7M9 22l6 3M39 22l-6 3M14 13l5 5M34 13l-5 5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {type === "wave" && (
        <>
          <path d="M9 30c4-5 8-5 12 0s8 5 12 0 6-4 8-2" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <path d="M13 23c4-5 8-5 12 0s7 4 10 1" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
          <path d="M31 13c-9 1-15 7-16 16 5-6 10-8 18-6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {type === "tree" && (
        <>
          <path d="M24 6 10 26h9L7 42h34L29 26h9L24 6Z" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24 27v15" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {type === "lotus" && (
        <>
          {[0, 72, 144, 216, 288].map((rotation) => (
            <ellipse
              key={rotation}
              cx="24"
              cy="15"
              rx="6"
              ry="11"
              stroke={color}
              strokeWidth="2.7"
              transform={`rotate(${rotation} 24 24)`}
            />
          ))}
          <circle cx="24" cy="24" r="4" fill={color} />
          <path d="M24 31v10" stroke={color} strokeWidth="2.7" strokeLinecap="round" />
        </>
      )}
      {type === "mountain" && (
        <>
          <path d="M5 39 19 14l9 14 5-8 10 19H5Z" stroke={color} strokeWidth="3" strokeLinejoin="round" />
          <path d="m19 14 3 10 6 4M33 20l-3 9" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {type === "cloud" && (
        <>
          <path d="M14 34h22a8 8 0 0 0 0-16 12 12 0 0 0-23-3A9.5 9.5 0 0 0 14 34Z" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 40h25" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.72" />
        </>
      )}
      {type === "cactus" && (
        <>
          <path d="M24 41V14a7 7 0 0 1 14 0v8M24 25H13a6 6 0 0 1-6-6v-5M24 31h12a6 6 0 0 0 6-6v-5M13 41h22" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {type === "snowflake" && (
        <>
          <path d="M24 6v36M9 15l30 18M39 15 9 33" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <circle cx="24" cy="24" r="4" fill={color} />
        </>
      )}
      {type === "aurora" && (
        <>
          <path d="M8 34c7-19 12-19 16 0 5-26 11-26 17-3" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <path d="m13 9 2 5 5 2-5 2-2 5-2-5-5-2 5-2ZM34 8l1.5 3.5L39 13l-3.5 1.5L34 18l-1.5-3.5L29 13l3.5-1.5Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path d="M5 7V5.6a3 3 0 0 1 6 0V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.8" fill="currentColor" />
    </svg>
  );
}

function MockTabIcon({ type, active }: { type: "home" | "journey" | "insights" | "you"; active?: boolean }) {
  const color = active ? "rgb(var(--calm-rgb))" : "#7E8B9D";
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      {type === "home" && <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />}
      {type === "journey" && <path d="M4 19c4-1 3-6 7-7s4-5 8-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" />}
      {type === "insights" && <path d="M5 19V9m7 10V5m7 14v-7" stroke={color} strokeWidth="2.2" strokeLinecap="round" />}
      {type === "you" && (
        <>
          <circle cx="12" cy="8" r="3.5" stroke={color} strokeWidth="2" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export default function SettingsView() {
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const coachNotes = useApp((s) => s.coachNotes);
  const clearCoachNotes = useApp((s) => s.clearCoachNotes);
  const deleteAllReflections = useApp((s) => s.deleteAllReflections);
  const checkIns = useApp((s) => s.checkIns);
  const [previewThemeKey, setPreviewThemeKey] = useState(settings.theme);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const activeTheme = themeByKey(settings.theme);
  const notificationSettings = settings.notificationSettings ?? DEFAULT_NOTIFICATION_SETTINGS;
  const previewTheme = themeByKey(previewThemeKey);
  const activeCopy = THEME_COPY[activeTheme.key] ?? THEME_COPY.twilight;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketCategory, setTicketCategory] = useState<SupportCategory>("bug");
  const [tickets, setTickets] = useState<any[]>([]);
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportNotice, setSupportNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [nameDraft, setNameDraft] = useState(settings.name);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const [notificationDraft, setNotificationDraft] = useState(notificationSettings);
  const passwordRules = passwordRuleItems(authPassword);
  const passwordStrength = getPasswordStrength(authPassword);

  useEffect(() => {
    setPreviewThemeKey(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    setNameDraft(settings.name);
  }, [settings.name]);

  useEffect(() => {
    setNotificationDraft(notificationSettings);
  }, [notificationSettings]);

  function saveDisplayName(value = nameDraft) {
    updateSettings({ name: value.trim() });
  }

  function saveNotificationSettings() {
    updateSettings({ notificationSettings: notificationDraft });
    setNotificationsExpanded(false);
  }

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) return;
    return onAuthStateChanged(fb.auth, (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        void listMySupportTickets(nextUser.uid).then(setTickets);
      } else {
        setTickets([]);
      }
    });
  }, []);

  async function signInWithGoogle() {
    setAuthNotice("");
    const fb = getFirebase();
    if (!fb) {
      setAuthNotice("Firebase is not configured for this build.");
      return;
    }
    setAuthBusy(true);
    try {
      await signInWithPopup(fb.auth, fb.googleProvider);
      setAuthNotice("Signed in. Tranqly sync is on for this browser.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not sign in.";
      setAuthNotice(message.includes("popup") ? "Sign in popup was closed before finishing." : "Could not sign in with Google.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signInWithApple() {
    setAuthNotice("");
    const fb = getFirebase();
    if (!fb) {
      setAuthNotice("Firebase is not configured for this build.");
      return;
    }
    setAuthBusy(true);
    try {
      await signInWithPopup(fb.auth, fb.appleProvider);
      setAuthNotice("Signed in. Tranqly sync is on for this browser.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setAuthNotice(message.includes("popup") ? "Sign in popup was closed before finishing." : "Could not sign in with Apple.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitEmailAuth(mode: "signin" | "create") {
    const fb = getFirebase();
    const email = authEmail.trim();
    if (!fb) {
      setAuthNotice("Firebase is not configured for this build.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAuthNotice("Please enter a valid email address.");
      return;
    }
    if (mode === "create" && !isPasswordValid(authPassword)) {
      setAuthNotice("Your password needs 8 characters, one uppercase letter, one number, and one special character.");
      return;
    }
    if (mode === "signin" && !authPassword) {
      setAuthNotice("Please enter your password.");
      return;
    }
    setAuthBusy(true);
    setAuthNotice("");
    try {
      if (mode === "create") {
        await createUserWithEmailAndPassword(fb.auth, email, authPassword);
        setAuthNotice("Account created. Tranqly sync is on for this browser.");
      } else {
        await signInWithEmailAndPassword(fb.auth, email, authPassword);
        setAuthNotice("Signed in. Tranqly sync is on for this browser.");
      }
      setAuthPassword("");
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code.includes("invalid-email")) setAuthNotice("Please enter a valid email address.");
      else if (code.includes("wrong-password") || code.includes("invalid-credential") || code.includes("user-not-found")) setAuthNotice("That email or password did not match.");
      else if (code.includes("email-already-in-use")) setAuthNotice("That email is already connected to a Tranqly account.");
      else if (code.includes("network")) setAuthNotice("Tranqly could not connect right now. Please try again in a moment.");
      else setAuthNotice("Tranqly could not sign you in right now. Please try again in a moment.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendResetLink() {
    const fb = getFirebase();
    const email = authEmail.trim();
    if (!fb) {
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
      await sendPasswordResetEmail(fb.auth, email);
      setAuthNotice("Password reset email sent.");
    } catch {
      setAuthNotice("Tranqly could not send a reset email right now. Please try again in a moment.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOutUser() {
    setAuthNotice("");
    const fb = getFirebase();
    if (!fb) return;
    setAuthBusy(true);
    try {
      await signOut(fb.auth);
      setAuthNotice("Signed out. This browser will keep its local data.");
    } catch {
      setAuthNotice("Could not sign out. Try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitTicket() {
    setSupportNotice("");
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      setSupportNotice("Add a subject and message before submitting.");
      return;
    }
    setSupportBusy(true);
    try {
      await createSupportTicket(user, {
        subject: ticketSubject,
        message: ticketMessage,
        category: ticketCategory,
      });
      setTicketSubject("");
      setTicketMessage("");
      setSupportNotice("Support ticket submitted. Reflection content was not attached.");
      if (user) setTickets(await listMySupportTickets(user.uid));
    } catch (error) {
      setSupportNotice(error instanceof Error ? error.message : "Could not submit ticket.");
    } finally {
      setSupportBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <header className="px-1">
        <h1 className="text-3xl font-bold tracking-tight">You</h1>
      </header>

      <section className="rounded-xl2 border border-edge bg-card p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-dim">Preferences</h2>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Your name</span>
          <div className="flex gap-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => saveDisplayName()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                  saveDisplayName();
                }
              }}
              placeholder="What should Tranqly call you?"
              className="min-h-[48px] min-w-0 flex-1 rounded-2xl border border-edge bg-ink px-4 text-fg placeholder-faint outline-none focus:border-calm/60"
            />
            <button
              type="button"
              onClick={() => {
                setNameDraft("");
                updateSettings({ name: "" });
              }}
              className="min-h-[48px] rounded-2xl border border-edge bg-ink px-4 text-sm font-bold text-dim"
            >
              Clear
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            This is private and only used to personalize your Tranqly experience.
          </p>
        </label>
      </section>

      <section className="rounded-xl2 border border-edge bg-card p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-dim">Account</h2>
            <p className="mt-2 text-sm leading-relaxed text-faint">
              {user
                ? `Signed in as ${user.email || "your Tranqly account"}.`
                : "Sign in to sync your reflections across devices and keep your sanctuary backed up."}
            </p>
          </div>
          <span className="rounded-full border border-edge bg-ink px-3 py-1 text-[10px] font-black uppercase tracking-wide text-dim">
            {user ? "Synced" : "Local"}
          </span>
        </div>
        {user ? (
          <div className="mt-3 rounded-2xl border border-edge bg-ink/55 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-calm">Signed in as</p>
            <p className="mt-1 text-sm font-semibold text-fg">{user.email || "Tranqly account"}</p>
            <p className="mt-2 text-sm leading-relaxed text-dim">
              Your reflections are backed up and ready across devices.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAuthNotice("Your Tranqly account is already connected on this browser.")}
                className="min-h-[46px] rounded-2xl border border-edge bg-card px-4 text-sm font-bold text-dim"
              >
                Manage account
              </button>
              <button
                type="button"
                onClick={signOutUser}
                disabled={authBusy}
                className="min-h-[46px] rounded-2xl bg-gradient-to-r from-calm to-sea px-4 text-sm font-black text-ink disabled:border disabled:border-edge disabled:bg-ink disabled:from-ink disabled:to-ink disabled:text-faint"
              >
                {authBusy ? "Working..." : "Sign out"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid gap-2">
              <button
                type="button"
                onClick={signInWithApple}
                disabled={authBusy}
                className="min-h-[48px] rounded-2xl border border-edge bg-ink px-4 text-sm font-black text-fg disabled:opacity-60"
              >
                {authBusy ? "Working..." : "Continue with Apple"}
              </button>
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={authBusy}
                className="min-h-[48px] rounded-2xl border border-edge bg-ink px-4 text-sm font-black text-fg disabled:opacity-60"
              >
                {authBusy ? "Working..." : "Continue with Google"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEmailAuth((value) => !value);
                  setAuthNotice("");
                }}
                className="min-h-[48px] rounded-2xl bg-gradient-to-r from-calm to-sea px-4 text-sm font-black text-ink"
              >
                Continue with Email
              </button>
            </div>
            {showEmailAuth ? (
              <div className="rounded-2xl border border-edge bg-ink/55 p-4">
                <div className="grid gap-3">
                  <input
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="Email"
                    className="min-h-[46px] w-full rounded-2xl border border-edge bg-card px-4 text-sm text-fg placeholder-faint outline-none focus:border-calm/60"
                  />
                  <input
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    type="password"
                    placeholder="Password"
                    className="min-h-[46px] w-full rounded-2xl border border-edge bg-card px-4 text-sm text-fg placeholder-faint outline-none focus:border-calm/60"
                  />
                  <div className="rounded-2xl border border-edge bg-card/80 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-faint">Password</p>
                      <span className="text-xs font-bold text-dim">{passwordStrength}</span>
                    </div>
                    <div className="grid gap-1.5">
                      {passwordRules.map((rule) => (
                        <p key={rule.key} className={`text-xs font-semibold ${rule.met ? "text-calm" : "text-faint"}`}>
                          {rule.met ? "✓" : "○"} {rule.label}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => submitEmailAuth("signin")}
                      disabled={authBusy}
                      className="min-h-[46px] rounded-2xl bg-gradient-to-r from-calm to-sea px-4 text-sm font-black text-ink disabled:opacity-60"
                    >
                      {authBusy ? "Working..." : "Sign in"}
                    </button>
                    <button
                      type="button"
                      onClick={() => submitEmailAuth("create")}
                      disabled={authBusy || !isPasswordValid(authPassword)}
                      className="min-h-[46px] rounded-2xl border border-edge bg-card px-4 text-sm font-black text-fg disabled:text-faint disabled:opacity-60"
                    >
                      Create account
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={sendResetLink} className="text-xs font-bold text-calm">
                      Forgot password
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmailAuth(false)}
                      className="text-xs font-bold text-faint"
                    >
                      Back to sign-in options
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
        {authNotice ? <p className="mt-2 text-sm font-semibold text-dim">{authNotice}</p> : null}
      </section>

      <section className="rounded-xl2 border border-edge bg-card p-4 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-dim">Notifications</h2>
            <p className="mt-2 text-sm leading-relaxed text-faint">
              Notification delivery is currently mobile-only. Your preferences sync here so they are ready on iPhone.
            </p>
          </div>
          <span className="rounded-full border border-edge bg-ink px-3 py-1 text-[10px] font-black uppercase tracking-wide text-dim">
            {notificationSettings.permissionStatus}
          </span>
        </div>
        {!notificationsExpanded ? (
          <div className="mt-3 rounded-2xl border border-edge bg-ink p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-black text-fg">Daily reflection reminder</p>
                  <p className="text-sm text-faint">
                    {notificationSettings.dailyReminderEnabled
                      ? `${formatHourLabel(notificationSettings.dailyReminderTime)} • ${QUIET_MINUTE_OPTIONS.find((option) => option.key === notificationSettings.quietMinuteOption)?.label ?? "Custom"}`
                      : "Off"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-dim">
                  <span className="rounded-full border border-edge px-2.5 py-1">
                    Weekly insights {notificationSettings.weeklyInsightEnabled ? "On" : "Off"}
                  </span>
                  <span className="rounded-full border border-edge px-2.5 py-1">
                    Sanctuary unlocks {notificationSettings.sanctuaryUnlockEnabled ? "On" : "Off"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotificationsExpanded(true)}
                className="min-h-[42px] rounded-full border border-edge bg-card px-4 text-sm font-black text-fg"
              >
                Edit
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            <button
              type="button"
              onClick={() =>
                setNotificationDraft((current) => ({
                  ...current,
                  dailyReminderEnabled: !current.dailyReminderEnabled,
                }))
              }
              className="min-h-[46px] rounded-2xl border border-edge bg-ink px-4 text-left text-sm font-bold text-fg"
            >
              Daily reflection reminder
              <span className="ml-2 text-faint">
                {notificationDraft.dailyReminderEnabled ? "On" : "Off"}
              </span>
            </button>
            <div className="flex flex-wrap gap-2">
              {QUIET_MINUTE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() =>
                    setNotificationDraft((current) => ({
                      ...current,
                      quietMinuteOption: option.key,
                      dailyReminderTime:
                        option.key === "custom" ? current.dailyReminderTime : option.suggestedTime,
                    }))
                  }
                  className={`rounded-full border px-3 py-2 text-xs font-black ${
                    notificationDraft.quietMinuteOption === option.key
                      ? "border-calm bg-calm/10 text-calm"
                      : "border-edge bg-ink text-faint"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-edge bg-ink px-4 py-3 text-sm font-bold text-fg">
              Reminder time
              <span className="ml-2 text-faint">{formatHourLabel(notificationDraft.dailyReminderTime)}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setNotificationDraft((current) => ({
                  ...current,
                  weeklyInsightEnabled: !current.weeklyInsightEnabled,
                }))
              }
              className="min-h-[46px] rounded-2xl border border-edge bg-ink px-4 text-left text-sm font-bold text-fg"
            >
              Weekly insights
              <span className="ml-2 text-faint">
                {notificationDraft.weeklyInsightEnabled ? `Sunday ${formatHourLabel(notificationDraft.weeklyInsightTime)}` : "Off"}
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                setNotificationDraft((current) => ({
                  ...current,
                  sanctuaryUnlockEnabled: !current.sanctuaryUnlockEnabled,
                }))
              }
              className="min-h-[46px] rounded-2xl border border-edge bg-ink px-4 text-left text-sm font-bold text-fg"
            >
              Sanctuary unlocks
              <span className="ml-2 text-faint">
                {notificationDraft.sanctuaryUnlockEnabled ? "On" : "Off"}
              </span>
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setNotificationDraft(notificationSettings);
                  setNotificationsExpanded(false);
                }}
                className="min-h-[46px] flex-1 rounded-2xl border border-edge bg-ink px-4 text-sm font-black text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNotificationSettings}
                className="min-h-[46px] flex-1 rounded-2xl bg-gradient-to-r from-calm to-sea px-4 text-sm font-black text-ink"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-edge bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-calm">Your Sanctuary</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">{activeTheme.label}</h2>
          </div>
          <span className="rounded-full border border-calm/35 bg-calm/15 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-calm">
            Selected
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setPreviewThemeKey(activeTheme.key);
            setPreviewOpen(true);
          }}
          className="relative block h-[180px] w-full overflow-hidden rounded-[1.45rem] border border-edge text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeTheme.artwork} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/52 to-transparent" />
          <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink/90 to-transparent" />
          <span className="relative z-10 flex h-full flex-col justify-between p-4">
            <span className="grid h-12 w-12 place-items-center rounded-full border bg-ink/70" style={{ borderColor: activeTheme.calm }}>
              <ThemeIcon type={activeCopy.icon} color={activeTheme.calm} className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-xl font-black tracking-tight">{activeTheme.label}</span>
              <span className="mt-1 block max-w-[18rem] text-sm font-semibold leading-relaxed text-dim">
                {activeTheme.description}
              </span>
            </span>
          </span>
        </button>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setThemePickerOpen(true)}
            className="min-h-[48px] rounded-2xl border border-edge bg-ink px-4 text-sm font-black text-fg"
          >
            Change Theme
          </button>
          <button
            type="button"
            onClick={() => {
              setPreviewThemeKey(activeTheme.key);
              setPreviewOpen(true);
            }}
            className="min-h-[48px] rounded-2xl bg-gradient-to-r from-calm to-sea px-4 text-sm font-black text-ink"
          >
            Explore Sanctuary
          </button>
        </div>
      </section>

      <section className="rounded-xl2 border border-edge bg-card p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-dim">Privacy</h2>
        <p className="text-sm leading-relaxed text-faint">
          Your reflections are private to your account. Tranqly uses your past
          check-ins only to personalize your insights.
        </p>
      </section>

      <section className="rounded-xl2 border border-edge bg-card p-4 shadow-card">
        <div className="mb-3">
          <h2 className="text-2xl font-black tracking-tight">Support</h2>
          <p className="mt-1 text-sm leading-relaxed text-dim">
            Send account, billing, recording, or app issues to support. Tranqly attaches safe device metadata only, never reflection text.
          </p>
        </div>
        <div className="grid gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-faint">Category</span>
            <select
              value={ticketCategory}
              onChange={(event) => setTicketCategory(event.target.value as SupportCategory)}
              className="min-h-[46px] w-full rounded-2xl border border-edge bg-ink px-4 text-sm font-semibold text-fg outline-none focus:border-calm/60"
            >
              {["login", "billing", "recording", "insights", "account", "bug", "feedback", "other"].map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-faint">Subject</span>
            <input
              value={ticketSubject}
              onChange={(event) => setTicketSubject(event.target.value)}
              placeholder="What do you need help with?"
              className="min-h-[46px] w-full rounded-2xl border border-edge bg-ink px-4 text-sm text-fg placeholder-faint outline-none focus:border-calm/60"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-faint">Message</span>
            <textarea
              value={ticketMessage}
              onChange={(event) => setTicketMessage(event.target.value)}
              placeholder="Describe the issue. Do not include private reflection text unless you choose to type it here."
              rows={4}
              className="min-h-[110px] w-full resize-none rounded-2xl border border-edge bg-ink p-4 text-sm text-fg placeholder-faint outline-none focus:border-calm/60"
            />
          </label>
          <button
            onClick={submitTicket}
            disabled={supportBusy || !user}
            className="min-h-[48px] rounded-2xl bg-button px-4 text-sm font-black text-fg disabled:border disabled:border-edge disabled:bg-ink disabled:text-faint"
          >
            {!user ? "Sign in to submit ticket" : supportBusy ? "Submitting..." : "Submit support ticket"}
          </button>
          {supportNotice ? <p className="text-sm font-semibold text-dim">{supportNotice}</p> : null}
        </div>
        {tickets.length ? (
          <div className="mt-4 rounded-2xl border border-edge bg-ink/50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-calm">Previous tickets</p>
            <div className="mt-2 flex flex-col gap-2">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-xl border border-edge bg-card px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black">{ticket.subject}</p>
                    <span className="rounded-full bg-ink px-2 py-1 text-[10px] font-black text-dim">{ticket.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-faint">{ticket.category}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl2 border border-edge bg-card p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-dim">Data controls</h2>
        <div className="flex flex-col gap-2">
          <button
            onClick={clearCoachNotes}
            className="min-h-[44px] rounded-2xl border border-edge bg-ink px-4 text-sm font-semibold text-dim"
          >
            Reset memory profile
          </button>
          <button
            onClick={() =>
              updateSettings({
                onboarded: true,
                onboardingCoachCompleted: false,
                onboardingCoachStep: "mic",
                onboardingSkippedAt: null,
                onboardingCompletedAt: null,
              })
            }
            className="min-h-[44px] rounded-2xl border border-edge bg-ink px-4 text-sm font-semibold text-dim"
          >
            Replay onboarding walkthrough
          </button>
          <button
            onClick={() => {
              if (confirm("Delete all reflections and reset Tranqly memory?")) {
                deleteAllReflections();
              }
            }}
            className="min-h-[44px] rounded-2xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-semibold text-red-200"
          >
            Delete all reflections
          </button>
        </div>
      </section>

      <section className="rounded-xl2 border border-edge bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-dim">
              What Tranqly remembers
            </h2>
            <p className="text-xs text-faint">
              Short notes are saved from your conversations so replies can feel
              more personal over time.
            </p>
          </div>
          {coachNotes.length > 0 && (
            <button
              onClick={clearCoachNotes}
              className="text-xs font-semibold text-faint"
            >
              Clear
            </button>
          )}
        </div>
        {coachNotes.length === 0 ? (
          <p className="text-sm text-faint">
            Tranqly has not learned anything durable yet. The more you check
            in, the more personal it gets.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {coachNotes.map((note) => (
              <span
                key={note}
                className="rounded-full border border-edge bg-ink px-3 py-1.5 text-xs text-dim"
              >
                {note}
              </span>
            ))}
          </div>
        )}
      </section>

      <p className="pb-2 pt-1 text-center text-xs text-faint">
        Tranqly, your reflections live on your device
      </p>

      <AnimatePresence>
        {themePickerOpen ? (
          <>
            <motion.button
              aria-label="Close theme picker"
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setThemePickerOpen(false)}
            />
            <motion.div
              className="fixed inset-x-3 bottom-3 top-8 z-50 mx-auto flex max-w-2xl flex-col overflow-hidden rounded-[28px] border border-edge bg-card shadow-card"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-edge p-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-calm">Sanctuary</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">Choose Sanctuary</h2>
                  <p className="mt-1 text-sm text-dim">Themes unlock as you keep checking in.</p>
                </div>
                <button
                  onClick={() => setThemePickerOpen(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-edge bg-ink text-xl text-dim"
                >
                  x
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pb-8">
                {[
                  ["Current", THEMES_BY_UNLOCK.filter((theme) => theme.key === settings.theme)],
                  [
                    "Available",
                    THEMES_BY_UNLOCK.filter(
                      (theme) =>
                        theme.key !== settings.theme &&
                        isThemeUnlocked(theme, checkIns.length, settings.premium)
                    ),
                  ],
                  [
                    "Locked",
                    THEMES_BY_UNLOCK.filter(
                      (theme) =>
                        theme.key !== settings.theme &&
                        !isThemeUnlocked(theme, checkIns.length, settings.premium)
                    ),
                  ],
                ].map(([sectionTitle, sectionThemes]) =>
                  (sectionThemes as typeof THEMES).length ? (
                    <section key={sectionTitle as string} className="mb-5 last:mb-0">
                      <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-calm">
                        {sectionTitle as string}
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(sectionThemes as typeof THEMES).map((theme) => {
                          const meta = THEME_COPY[theme.key] ?? THEME_COPY.twilight;
                          const current = theme.key === settings.theme;
                          const unlocked = current || isThemeUnlocked(theme, checkIns.length, settings.premium);
                          return (
                            <article
                              key={theme.key}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setPreviewThemeKey(theme.key);
                                setPreviewOpen(true);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  setPreviewThemeKey(theme.key);
                                  setPreviewOpen(true);
                                }
                              }}
                              className={`overflow-hidden rounded-[1.35rem] border bg-ink/55 ${
                                current ? "border-calm" : "border-edge"
                              } cursor-pointer transition hover:border-calm/45`}
                            >
                              <div className="relative h-28 overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={theme.artwork}
                                  alt=""
                                  className={`h-full w-full object-cover ${unlocked ? "" : "opacity-50 blur-[1px]"}`}
                                />
                                <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
                                <span className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-full border bg-ink/70" style={{ borderColor: theme.calm }}>
                                  <ThemeIcon type={meta.icon} color={theme.calm} className="h-6 w-6" />
                                </span>
                                <span className="absolute right-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-fg">
                                  {current ? "Current" : unlocked ? "Unlocked" : "Locked"}
                                </span>
                              </div>
                              <div className="p-3">
                                <h4 className="font-black">{theme.label}</h4>
                                <p className="mt-1 min-h-[2.5rem] text-xs font-semibold leading-relaxed text-dim">
                                  {unlocked ? theme.feeling : themeUnlockLabel(theme)}
                                </p>
                                <div className="mt-3 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setPreviewThemeKey(theme.key);
                                      setPreviewOpen(true);
                                    }}
                                    className="min-h-[38px] flex-1 rounded-xl border border-edge bg-card px-3 text-xs font-black text-dim"
                                  >
                                    Preview
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!unlocked || current}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateSettings({ theme: theme.key });
                                      setThemePickerOpen(false);
                                    }}
                                    className="min-h-[38px] flex-1 rounded-xl bg-gradient-to-r from-calm to-sea px-3 text-xs font-black text-ink disabled:border disabled:border-edge disabled:bg-none disabled:bg-card disabled:text-faint"
                                  >
                                    {current ? "Selected" : unlocked ? "Select" : "Locked"}
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : null
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {previewOpen ? (
          <>
            <motion.button
              aria-label="Close theme preview"
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewOpen(false)}
            />
            <motion.div
              className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg overflow-hidden rounded-[28px] border border-edge bg-card shadow-card"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
            >
              <div
                className="relative overflow-hidden p-3"
                style={
                  {
                    "--calm-rgb": previewTheme.calmRgb,
                    "--sea-rgb": previewTheme.seaRgb,
                  } as Record<string, string>
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewTheme.artwork} alt="" className="aspect-[1.25] w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-ink/72" />
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-ink/70 text-xl text-dim"
                >
                  ×
                </button>
                <div className="absolute bottom-4 left-4 right-4">
                  <span className="rounded-full bg-calm/20 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-calm">
                    Preview
                  </span>
                  <h3 className="mt-3 text-3xl font-black">{previewTheme.label}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-dim">{previewTheme.description}</p>
                </div>
              </div>
              <div className="p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {previewTheme.ambient.map((effect) => (
                    <span key={effect} className="rounded-full border border-edge bg-ink px-3 py-1 text-[11px] font-bold text-dim">
                      {effect}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-ink/40 p-3">
                  {[
                    ["home", "Home"],
                    ["journey", "Journey"],
                    ["insights", "Insights"],
                    ["you", "You"],
                  ].map(([type, label], index) => (
                    <div key={label} className="flex flex-col items-center gap-1 text-center">
                      <MockTabIcon type={type as "home" | "journey" | "insights" | "you"} active={index === 0} />
                      <span className={`text-[11px] font-bold ${index === 0 ? "text-calm" : "text-dim"}`}>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {previewTheme.palette.map((color) => (
                    <span key={color} className="rounded-full border border-edge bg-ink px-3 py-1 text-[11px] font-bold text-dim">
                      {color}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={
                    settings.theme === previewTheme.key ||
                    !isThemeUnlocked(previewTheme, checkIns.length, settings.premium)
                  }
                  onClick={() => {
                    updateSettings({ theme: previewTheme.key });
                    setPreviewOpen(false);
                    setThemePickerOpen(false);
                  }}
                  className="mt-4 min-h-[48px] w-full rounded-2xl bg-gradient-to-r from-calm to-sea px-4 text-sm font-black text-ink disabled:border disabled:border-edge disabled:bg-none disabled:bg-ink disabled:text-faint"
                >
                  {settings.theme === previewTheme.key
                    ? "Theme selected"
                    : isThemeUnlocked(previewTheme, checkIns.length, settings.premium)
                      ? "Select Theme"
                      : themeUnlockLabel(previewTheme)}
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
