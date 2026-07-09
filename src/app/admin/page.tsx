"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import AdminTroubleshooting from "@/components/AdminTroubleshooting";
import SceneAdmin, { SceneLayoutPreview } from "@/components/SceneAdmin";
import { getFirebase } from "@/lib/firebase";
import { sortScenes } from "@/lib/sanctuaryScenes";
import { useApp } from "@/lib/store";
import type { SanctuarySceneConfig } from "@/lib/types";

type AdminSection = "troubleshooting" | "publishing";

const DEVICE_PREVIEWS = [
  { label: "iPhone SE", width: 375, height: 667 },
  { label: "iPhone 15", width: 393, height: 852 },
  { label: "Pro Max", width: 430, height: 932 },
  { label: "iPad", width: 768, height: 1024 },
  { label: "Desktop", width: 1024, height: 720 },
];

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email?: string | null) {
  return Boolean(email && ADMIN_EMAILS.includes(email.toLowerCase()));
}

export default function AdminDashboard() {
  const scenes = useApp((s) => s.sanctuaryScenes);
  const firstScene = useMemo(() => sortScenes(scenes)[0], [scenes]);
  const [section, setSection] = useState<AdminSection>("troubleshooting");
  const [previewScene, setPreviewScene] = useState<SanctuarySceneConfig | null>(
    firstScene ?? null
  );
  const [device, setDevice] = useState(DEVICE_PREVIEWS[1]);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const sectionCopy =
    section === "troubleshooting"
      ? {
          title: "Admin Troubleshooting",
          body: "Review safe user metadata, support tickets, and errors without exposing reflection content.",
        }
      : {
          title: "Live Publishing",
          body: "Draft, preview, publish, archive, duplicate, delete, and roll back sanctuary scenes outside the user app.",
        };

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setAuthReady(true);
      return;
    }

    return onAuthStateChanged(fb.auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fb = getFirebase();
    const email = authEmail.trim().toLowerCase();

    if (!fb) {
      setAuthNotice("Firebase is not configured for this deployment.");
      return;
    }
    if (!ADMIN_EMAILS.length) {
      setAuthNotice("Set NEXT_PUBLIC_ADMIN_EMAILS in Vercel before using admin login.");
      return;
    }
    if (!isAdminEmail(email)) {
      setAuthNotice("That email is not allowed to access Tranqly Admin.");
      return;
    }
    if (!authPassword || authPassword.length < 6) {
      setAuthNotice("Enter your admin password.");
      return;
    }

    setAuthBusy(true);
    setAuthNotice("");
    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(fb.auth, email, authPassword);
      } else {
        await signInWithEmailAndPassword(fb.auth, email, authPassword);
      }
      setAuthPassword("");
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code.includes("email-already-in-use")) setAuthNotice("That admin account already exists. Sign in instead.");
      else if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) setAuthNotice("That email or password did not match.");
      else if (code.includes("weak-password")) setAuthNotice("Use a stronger password.");
      else setAuthNotice("Could not sign in. Check Firebase Email/Password auth is enabled.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function resetPassword() {
    const fb = getFirebase();
    const email = authEmail.trim().toLowerCase();
    if (!fb) {
      setAuthNotice("Firebase is not configured for this deployment.");
      return;
    }
    if (!isAdminEmail(email)) {
      setAuthNotice("Enter your allowed admin email first.");
      return;
    }
    setAuthBusy(true);
    try {
      await sendPasswordResetEmail(fb.auth, email);
      setAuthNotice("Password reset email sent.");
    } catch {
      setAuthNotice("Could not send reset email. Check Firebase Email/Password auth is enabled.");
    } finally {
      setAuthBusy(false);
    }
  }

  if (!authReady) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink px-4 text-fg">
        <p className="text-sm font-black text-dim">Loading Tranqly Admin...</p>
      </main>
    );
  }

  if (!user || !isAdminEmail(user.email)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink px-4 py-8 text-fg">
        <section className="w-full max-w-md rounded-[32px] border border-edge bg-card p-6 shadow-card">
          <div className="mb-6 flex items-center gap-3">
            <img src="/tranqly_logo.png" alt="" className="h-10 w-10 object-contain" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-calm">Tranqly Admin</p>
              <h1 className="text-2xl font-black tracking-tight">{authMode === "signup" ? "Create admin account" : "Admin login"}</h1>
            </div>
          </div>

          {!ADMIN_EMAILS.length ? (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-relaxed text-amber-100">
              Set <span className="font-black">NEXT_PUBLIC_ADMIN_EMAILS</span> in Vercel to your admin email address, then redeploy.
            </div>
          ) : null}

          <form onSubmit={submitAuth} className="mt-5 flex flex-col gap-3">
            <label className="text-xs font-black uppercase tracking-wide text-faint">Admin email</label>
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder={ADMIN_EMAILS[0] || "you@tranqly.app"}
              className="min-h-[48px] rounded-2xl border border-edge bg-ink px-4 text-sm font-semibold outline-none focus:border-calm"
            />
            <label className="text-xs font-black uppercase tracking-wide text-faint">Password</label>
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Your admin password"
              className="min-h-[48px] rounded-2xl border border-edge bg-ink px-4 text-sm font-semibold outline-none focus:border-calm"
            />
            <button
              type="submit"
              disabled={authBusy}
              className="mt-2 min-h-[48px] rounded-2xl bg-calm px-4 text-sm font-black text-ink disabled:opacity-50"
            >
              {authBusy ? "Please wait..." : authMode === "signup" ? "Create admin account" : "Sign in"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
              className="font-bold text-calm"
            >
              {authMode === "signin" ? "First time? Create account" : "Already have one? Sign in"}
            </button>
            <button type="button" onClick={resetPassword} className="font-bold text-dim">
              Reset password
            </button>
          </div>

          {authNotice ? <p className="mt-4 rounded-2xl border border-edge bg-ink p-3 text-sm text-dim">{authNotice}</p> : null}
          {user && !isAdminEmail(user.email) ? (
            <button
              type="button"
              onClick={() => {
                const fb = getFirebase();
                if (fb) void signOut(fb.auth);
              }}
              className="mt-4 text-sm font-bold text-faint"
            >
              Sign out {user.email}
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-ink px-4 py-5 text-fg">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-3 rounded-[28px] border border-edge bg-card p-5 shadow-card md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-calm">
              Tranqly Admin
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">
              {sectionCopy.title}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-dim">
              {sectionCopy.body}
            </p>
          </div>
          <a
            href="/"
            className="flex min-h-[44px] items-center justify-center rounded-2xl border border-edge bg-ink px-4 text-sm font-black text-dim"
          >
            Back to app
          </a>
          <button
            type="button"
            onClick={() => {
              const fb = getFirebase();
              if (fb) void signOut(fb.auth);
            }}
            className="flex min-h-[44px] items-center justify-center rounded-2xl border border-edge bg-ink px-4 text-sm font-black text-dim"
          >
            Sign out
          </button>
        </header>

        <nav className="grid gap-2 rounded-[24px] border border-edge bg-card p-2 shadow-card sm:grid-cols-2">
          {[
            {
              key: "troubleshooting" as const,
              title: "Admin Troubleshooting",
              body: "Users, errors, support tickets",
            },
            {
              key: "publishing" as const,
              title: "Live Publishing",
              body: "Sanctuary scenes and previews",
            },
          ].map((item) => {
            const active = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`rounded-[20px] border px-4 py-3 text-left transition ${
                  active
                    ? "border-calm bg-calm/12 text-fg"
                    : "border-transparent bg-ink/35 text-dim hover:border-edge"
                }`}
              >
                <p className="text-sm font-black">{item.title}</p>
                <p className="mt-1 text-xs font-semibold text-faint">{item.body}</p>
              </button>
            );
          })}
        </nav>

        <div>
          {section === "troubleshooting" ? <AdminTroubleshooting /> : null}
          {section === "publishing" ? (
            <>
              <SceneAdmin onPreviewScene={setPreviewScene} />

          <aside className="mt-5 hidden rounded-xl2 border border-edge bg-card p-4 shadow-card xl:sticky xl:top-5 xl:self-start">
            <div className="mb-4 flex flex-col gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sea">
                  Responsive Preview
                </p>
                <h2 className="text-2xl font-black tracking-tight">
                  {previewScene?.name ?? "Select a scene"}
                </h2>
                <p className="mt-1 text-sm text-dim">
                  Preview how the scene card behaves across phones, tablets, and desktop.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {DEVICE_PREVIEWS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setDevice(item)}
                    className={`rounded-full border px-3 py-2 text-xs font-black ${
                      item.label === device.label
                        ? "border-calm bg-calm/15 text-calm"
                        : "border-edge bg-ink text-dim"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-auto rounded-[28px] border border-edge bg-ink p-4">
              <div
                className="mx-auto overflow-hidden rounded-[30px] border border-edge bg-[#0B0E14] shadow-card"
                style={{
                  width: Math.min(device.width, 620),
                  maxWidth: "100%",
                }}
              >
                <div className="border-b border-edge px-4 py-3">
                  <p className="text-xs font-black text-faint">
                    {device.label} · {device.width} x {device.height}
                  </p>
                </div>
                <div
                  className="overflow-y-auto p-4"
                  style={{
                    height: Math.min(device.height, 720),
                  }}
                >
                  <section className="rounded-[28px] border border-edge bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-calm">
                          Preview
                        </p>
                        <h3 className="text-2xl font-black">
                          {previewScene?.name ?? "Sanctuary"}
                        </h3>
                      </div>
                      <span className="rounded-full bg-ink px-3 py-1 text-[10px] font-black uppercase text-dim">
                        {previewScene?.status ?? "draft"}
                      </span>
                    </div>
                    <SceneLayoutPreview scene={previewScene} />
                    <div className="mt-4 rounded-2xl border border-edge bg-ink p-3">
                      <p className="text-sm font-black">Unlock rule</p>
                      <p className="mt-1 text-sm leading-relaxed text-dim">
                        {previewScene?.unlockRequirementType ?? "manual"} · Max {previewScene?.maxCheckIns ?? 90} check-ins
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </aside>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
