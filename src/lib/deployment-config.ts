import { parseFirebaseAdminCredential } from "./firebase-admin-credentials.ts";

export const PUBLIC_DEPLOYMENT_VARIABLES = [
  "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET",
] as const;

export const PRIVATE_DEPLOYMENT_VARIABLES = [
  "FIREBASE_SERVICE_ACCOUNT_JSON", "GEMINI_API_KEY", "STAFF_SECURITY_RULESET", "CERTIFICATE_SECURITY_RULESET", "TRUST_TLS_PROXY",
] as const;

export function checkDeploymentEnvironment(env: Record<string, string | undefined>, vercel = false) {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const name of [...PUBLIC_DEPLOYMENT_VARIABLES, "GEMINI_API_KEY", "STAFF_SECURITY_RULESET", "CERTIFICATE_SECURITY_RULESET"]) {
    if (!env[name]?.trim()) errors.push(`Set ${name}.`);
  }
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  for (const name of ["STAFF_SECURITY_RULESET", "CERTIFICATE_SECURITY_RULESET"]) {
    if (env[name]?.trim() && !uuid.test(env[name]!.trim())) errors.push(`${name} must be the active Firestore ruleset UUID.`);
  }
  if (env.STAFF_SECURITY_RULESET && env.CERTIFICATE_SECURITY_RULESET && env.STAFF_SECURITY_RULESET !== env.CERTIFICATE_SECURITY_RULESET) {
    errors.push("Staff and certificates must pin the same active Firestore ruleset.");
  }
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    try { parseFirebaseAdminCredential(env.FIREBASE_SERVICE_ACCOUNT_JSON.trim(), env.NEXT_PUBLIC_FIREBASE_PROJECT_ID); }
    catch (error) { errors.push(error instanceof Error ? error.message : "Invalid Firebase Admin credential."); }
  } else if (vercel || !env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    errors.push("Set FIREBASE_SERVICE_ACCOUNT_JSON to the service-account JSON. Vercel cannot read a file on your PC.");
  } else warnings.push("Local service-account file detected; npm run prepare:vercel converts it for Vercel.");
  if (vercel && env.GOOGLE_APPLICATION_CREDENTIALS) errors.push("Remove GOOGLE_APPLICATION_CREDENTIALS from Vercel; use the inline credential only.");
  if (vercel && env.TRUST_TLS_PROXY !== "true") errors.push("Set TRUST_TLS_PROXY=true for Vercel's managed HTTPS proxy.");
  for (const name of Object.keys(env)) {
    if (name.startsWith("NEXT_PUBLIC_") && /GEMINI|PRIVATE_KEY|SERVICE_ACCOUNT|APPLICATION_CREDENTIALS/.test(name)) {
      errors.push(`Remove ${name}; server secrets must not use NEXT_PUBLIC_.`);
    }
  }
  return { errors, warnings };
}
