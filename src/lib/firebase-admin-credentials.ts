export interface FirebaseAdminCredential {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/** Errors deliberately omit JSON, keys, file names and parser messages. */
export function parseFirebaseAdminCredential(raw: string, expectedProject: string | undefined): FirebaseAdminCredential {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Provide a Firebase Admin service account, not Android or Web app configuration.");
  const credential = value as Record<string, unknown>;
  if (credential.type !== "service_account" || typeof credential.project_id !== "string" ||
      typeof credential.client_email !== "string" || !credential.client_email.endsWith(".iam.gserviceaccount.com") ||
      typeof credential.private_key !== "string" || !credential.private_key.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("Provide a valid Firebase Admin service-account JSON with its private key.");
  }
  if (!expectedProject || credential.project_id !== expectedProject.trim()) throw new Error("The Firebase Admin credential must match NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
  return {
    projectId: credential.project_id,
    clientEmail: credential.client_email,
    privateKey: credential.private_key.replace(/\\n/g, "\n"),
  };
}
