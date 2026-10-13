import nextEnv from "@next/env";
import { readFileSync } from "node:fs";
import { createPrivateKey } from "node:crypto";
import { parseFirebaseAdminCredential } from "../src/lib/firebase-admin-credentials.ts";

export function loadDeploymentEnvironment() {
  // Do not print config values when loading or validating the local env file.
  nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  return process.env;
}

export function readDeploymentCredential(env) {
  let raw = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    if (!env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) throw new Error("Configure a Firebase Admin service-account credential.");
    try { raw = readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS.trim(), "utf8"); }
    catch { throw new Error("The local Firebase Admin credential file cannot be read."); }
  }
  const credential = parseFirebaseAdminCredential(raw, env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  try {
    const key = createPrivateKey(credential.privateKey);
    if (key.asymmetricKeyType !== "rsa") throw new Error();
  } catch { throw new Error("The Firebase Admin private key is invalid. Use the original downloaded service-account JSON."); }
  return { raw: JSON.stringify(JSON.parse(raw)), credential };
}
