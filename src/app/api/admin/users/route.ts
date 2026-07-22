import { NextRequest, NextResponse } from "next/server";
import type { UserRecord } from "firebase-admin/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isoValue(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toISOString();
  }
  return null;
}

function authProviders(user: UserRecord) {
  return user.providerData.map((provider) => provider.providerId).filter(Boolean).join(",") || "password";
}

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function profileTimestamp(profile: Record<string, any>) {
  const value = isoValue(profile.lastActiveAt) || isoValue(profile.lastLoginAt) || isoValue(profile.updatedAt) || isoValue(profile.createdAt);
  return value ? new Date(value).getTime() : 0;
}

export async function GET(request: NextRequest) {
  try {
    // Keep Firebase Admin out of module initialization so a bad production
    // credential returns a useful JSON error instead of crashing the route.
    const { getFirebaseAdmin } = await import("@/lib/firebaseAdmin");
    const admin = getFirebaseAdmin();
    const authorization = request.headers.get("authorization") ?? "";
    const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!idToken) return NextResponse.json({ error: "Admin authentication required." }, { status: 401 });

    const decoded = await admin.auth.verifyIdToken(idToken);
    const adminRecord = await admin.db.collection("admins").doc(decoded.uid).get();
    if (!adminRecord.exists || adminRecord.data()?.active === false) {
      return NextResponse.json({ error: "This account does not have active admin access." }, { status: 403 });
    }

    const authUsers: UserRecord[] = [];
    let pageToken: string | undefined;
    do {
      const page = await admin.auth.listUsers(1000, pageToken);
      authUsers.push(...page.users);
      pageToken = page.pageToken;
    } while (pageToken && authUsers.length < 10_000);

    const profileSnapshot = await admin.db.collection("users").get();
    const profiles = new Map(profileSnapshot.docs.map((item) => [item.id, item.data()]));
    const authIds = new Set(authUsers.map((user) => user.uid));
    const authEmails = new Set(authUsers.map((user) => normalizedEmail(user.email)).filter(Boolean));
    const profilesByEmail = new Map<string, Array<{ id: string; profile: Record<string, any> }>>();
    for (const [id, profile] of profiles) {
      const email = normalizedEmail(profile.email);
      if (!email) continue;
      const matches = profilesByEmail.get(email) ?? [];
      matches.push({ id, profile });
      profilesByEmail.set(email, matches);
    }
    const linkedProfileIds = new Set<string>();

    const users = authUsers.map((user) => {
      const exactProfile = profiles.get(user.uid);
      const emailMatches = profilesByEmail.get(normalizedEmail(user.email)) ?? [];
      const legacyMatch = emailMatches.sort((a, b) => profileTimestamp(b.profile) - profileTimestamp(a.profile))[0];
      const profile = exactProfile ?? legacyMatch?.profile ?? {};
      if (exactProfile) linkedProfileIds.add(user.uid);
      else if (legacyMatch) linkedProfileIds.add(legacyMatch.id);
      const createdAt = user.metadata.creationTime || isoValue(profile.createdAt);
      const lastLoginAt = user.metadata.lastSignInTime || isoValue(profile.lastLoginAt);
      const lastSessionAt = user.metadata.lastRefreshTime || lastLoginAt;
      return {
        ...profile,
        id: user.uid,
        uid: user.uid,
        email: user.email ?? profile.email ?? null,
        displayName: profile.displayName ?? user.displayName ?? null,
        authProvider: authProviders(user),
        authStatus: user.disabled ? "disabled" : "active",
        emailVerified: user.emailVerified,
        createdAt,
        lastLoginAt,
        lastSessionAt,
        lastActiveAt: isoValue(profile.lastActiveAt) ?? lastSessionAt,
        plan: profile.plan ?? "free",
        subscriptionStatus: profile.subscriptionStatus ?? "free",
        platformLastUsed: profile.platformLastUsed ?? "not_opened",
        selectedTheme: profile.selectedTheme ?? null,
        streakCount: Number(profile.streakCount ?? 0),
        reflectionCount: Number(profile.reflectionCount ?? 0),
      };
    });

    for (const [uid, profile] of profiles) {
      // Legacy mobile profiles can predate sign-in and use a local document ID.
      // Their email metadata is folded into the corresponding Auth row above.
      if (authIds.has(uid) || linkedProfileIds.has(uid) || authEmails.has(normalizedEmail(profile.email))) continue;
      users.push({
        ...profile,
        id: uid,
        uid,
        email: profile.email ?? null,
        displayName: profile.displayName ?? null,
        authProvider: profile.authProvider ?? "unknown",
        authStatus: "firestore_only",
        emailVerified: false,
        createdAt: isoValue(profile.createdAt),
        lastLoginAt: isoValue(profile.lastLoginAt),
        lastSessionAt: null,
        lastActiveAt: isoValue(profile.lastActiveAt),
        plan: profile.plan ?? "free",
        subscriptionStatus: profile.subscriptionStatus ?? "free",
        platformLastUsed: profile.platformLastUsed ?? "unknown",
        selectedTheme: profile.selectedTheme ?? null,
        streakCount: Number(profile.streakCount ?? 0),
        reflectionCount: Number(profile.reflectionCount ?? 0),
      });
    }

    users.sort((a, b) => {
      const aTime = new Date(a.lastActiveAt || a.lastLoginAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.lastActiveAt || b.lastLoginAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({ users, authUserCount: authUsers.length, generatedAt: new Date().toISOString() });
  } catch (error) {
    const originalMessage = error instanceof Error ? error.message : "Could not load Firebase users.";
    const message =
      originalMessage.includes("DECODER routines") ||
      originalMessage.includes("Invalid PEM") ||
      originalMessage.includes("private key")
        ? "Firebase Admin credentials are invalid. In Vercel, use the service-account client_email and the complete private_key from the same Firebase service-account JSON."
        : originalMessage;
    const status = message.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
