"use client";

import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

export interface FirebaseBundle {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  googleProvider: GoogleAuthProvider;
  appleProvider: OAuthProvider;
}

let bundle: FirebaseBundle | null | undefined;

/**
 * Lazily initialize Firebase from NEXT_PUBLIC_ env vars.
 * Returns null when unconfigured, and the app then runs in local-only mode
 * (everything persists to localStorage; sign-in UI shows a setup hint).
 */
export function getFirebase(): FirebaseBundle | null {
  if (bundle !== undefined) return bundle;

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!config.apiKey || !config.projectId) {
    bundle = null;
    return bundle;
  }

  const app = getApps()[0] ?? initializeApp(config);
  bundle = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    googleProvider: new GoogleAuthProvider(),
    appleProvider: new OAuthProvider("apple.com"),
  };
  return bundle;
}

export const firebaseConfigured = () => getFirebase() !== null;
