export type MobileSupportCategory =
  | "login"
  | "billing"
  | "recording"
  | "insights"
  | "account"
  | "bug"
  | "feedback"
  | "other";

type FirestorePrimitive = string | number | boolean | null | undefined;

interface FirestoreRestConfig {
  projectId: string;
  idToken: string;
}

interface MobileProfileInput {
  uid: string;
  email: string;
  displayName: string | null;
  onboardingCompleted: boolean;
  onboardingCoachStep: "mic" | "journey" | "sanctuary" | null;
  onboardingSkippedAt: string | null;
  onboardingCompletedAt: string | null;
  authProvider: "apple.com" | "google.com" | "password";
  lastLoginAt: string;
  subscriptionStatus: "active" | "trial" | "free";
  plan: "premium" | "free";
  appVersion: string;
  osVersion: string;
  selectedTheme: string;
  streakCount: number;
  reflectionCount: number;
  lastReflectionAt: string | null;
}

interface MobileTicketInput {
  uid: string;
  email: string;
  subject: string;
  message: string;
  category: MobileSupportCategory;
  appVersion: string;
  osVersion: string;
}

function encodeValue(value: FirestorePrimitive) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value)
    ? { integerValue: String(value) }
    : { doubleValue: value };
  return { stringValue: value };
}

function encodeFields(values: Record<string, FirestorePrimitive>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      if (typeof value === "string" && key.endsWith("At") && !Number.isNaN(Date.parse(value))) {
        return [key, { timestampValue: new Date(value).toISOString() }];
      }
      return [key, encodeValue(value)];
    })
  );
}

function documentsUrl(projectId: string, path: string) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`;
}

async function firestoreRequest(url: string, idToken: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error?.message || `Firestore request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json().catch(() => null);
}

export async function syncMobileUserProfile(
  config: FirestoreRestConfig,
  profile: MobileProfileInput
) {
  const now = new Date().toISOString();
  const values: Record<string, FirestorePrimitive> = {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    onboardingCompleted: profile.onboardingCompleted,
    onboardingCoachStep: profile.onboardingCoachStep,
    onboardingSkippedAt: profile.onboardingSkippedAt,
    onboardingCompletedAt: profile.onboardingCompletedAt,
    authProvider: profile.authProvider,
    lastLoginAt: profile.lastLoginAt,
    lastActiveAt: now,
    subscriptionStatus: profile.subscriptionStatus,
    plan: profile.plan,
    platformLastUsed: "ios",
    appVersion: profile.appVersion,
    osVersion: profile.osVersion,
    browserName: "native",
    browserVersion: "native",
    selectedTheme: profile.selectedTheme,
    streakCount: profile.streakCount,
    reflectionCount: profile.reflectionCount,
    lastReflectionAt: profile.lastReflectionAt,
    lastErrorAt: null,
    lastErrorCode: null,
    supportAccessEnabled: false,
    updatedAt: now,
  };
  const updateMask = Object.keys(values)
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join("&");

  await firestoreRequest(
    `${documentsUrl(config.projectId, `users/${encodeURIComponent(profile.uid)}`)}?${updateMask}`,
    config.idToken,
    {
      method: "PATCH",
      body: JSON.stringify({ fields: encodeFields(values) }),
    }
  );
}

export async function createMobileSupportTicket(
  config: FirestoreRestConfig,
  input: MobileTicketInput
) {
  const ticketId = `ios-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const ticketFields = {
    ticketId,
    uid: input.uid,
    email: input.email,
    subject: input.subject.trim(),
    message: input.message.trim(),
    category: input.category,
    platform: "ios",
    appVersion: input.appVersion,
    deviceModel: "iPhone",
    osVersion: input.osVersion,
    browserName: "native",
    browserVersion: "native",
    status: "open",
    priority: "normal",
    createdAt: now,
    updatedAt: now,
    lastUserReplyAt: now,
    lastAdminReplyAt: null,
  } satisfies Record<string, FirestorePrimitive>;

  await firestoreRequest(
    `${documentsUrl(config.projectId, "supportTickets")}?documentId=${encodeURIComponent(ticketId)}`,
    config.idToken,
    {
      method: "POST",
      body: JSON.stringify({ fields: encodeFields(ticketFields) }),
    }
  );

  await firestoreRequest(
    documentsUrl(config.projectId, `supportTickets/${encodeURIComponent(ticketId)}/messages`),
    config.idToken,
    {
      method: "POST",
      body: JSON.stringify({
        fields: encodeFields({
          senderType: "user",
          senderUid: input.uid,
          message: input.message.trim(),
          createdAt: now,
        }),
      }),
    }
  );

  return ticketId;
}
