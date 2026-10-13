import "server-only";
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { parseFirebaseAdminCredential } from "./firebase-admin-credentials";

export class PushConfigurationError extends Error {}

export function getFirebaseAdminApp() {
  const existing = getApps().find(app => app.name === "trashtrack-push");
  if (existing) return existing;
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!path && !inline) {
    throw new PushConfigurationError("Server access is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON on Vercel, or GOOGLE_APPLICATION_CREDENTIALS to a local service-account file, and restart the server.");
  }
  try {
    const credentials = parseFirebaseAdminCredential(inline || readFileSync(path!, "utf8"), process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    return initializeApp({ credential: cert(credentials), projectId: credentials.projectId }, "trashtrack-push");
  } catch {
    throw new PushConfigurationError("The Firebase Admin credential could not be loaded for this project. Check the server-only service-account JSON and Firebase project settings.");
  }
}
