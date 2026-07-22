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
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
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
