import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";

export interface FirebaseAdminBundle {
  app: App;
  auth: Auth;
  db: Firestore;
}

let bundle: FirebaseAdminBundle | null = null;

function serviceAccount() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (encoded) {
    const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return {
      project_id: parsed.project_id?.trim(),
      client_email: parsed.client_email?.trim(),
      private_key: parsed.private_key?.replace(/\\n/g, "\n"),
    };
  }

  const projectId = (process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { project_id: projectId, client_email: clientEmail, private_key: privateKey };
}

export function getFirebaseAdmin(): FirebaseAdminBundle {
  if (bundle) return bundle;

  const account = serviceAccount();
  if (!account) {
    throw new Error(
      "Firebase Admin is not configured. Add FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in Vercel."
    );
  }
  if (!account.client_email.endsWith(".iam.gserviceaccount.com")) {
    throw new Error(
      "FIREBASE_ADMIN_CLIENT_EMAIL must be the firebase-adminsdk service-account email from the Firebase service-account JSON, not the Tranqly admin login email."
    );
  }
  if (!account.private_key.includes("BEGIN PRIVATE KEY") || !account.private_key.includes("END PRIVATE KEY")) {
    throw new Error(
      "FIREBASE_ADMIN_PRIVATE_KEY must contain the complete private_key from the same Firebase service-account JSON."
    );
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: account.project_id,
        clientEmail: account.client_email,
        privateKey: account.private_key,
      }),
      projectId: account.project_id,
    });

  bundle = { app, auth: getAuth(app), db: getFirestore(app) };
  return bundle;
}
