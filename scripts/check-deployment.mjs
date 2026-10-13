import { existsSync } from "node:fs";
import { checkDeploymentEnvironment } from "../src/lib/deployment-config.ts";
import { loadDeploymentEnvironment, readDeploymentCredential } from "./deployment-env.mjs";

const env = loadDeploymentEnvironment();
const vercel = process.argv.includes("--vercel") || env.VERCEL === "1";
const result = checkDeploymentEnvironment(env, vercel);
try { readDeploymentCredential(env); } catch (error) { result.errors.push(error.message); }
for (const asset of ["appreciation-v1.png", "GreatVibes-Regular.ttf", "GreatVibes-OFL.txt"]) {
  if (!existsSync(`assets/certificates/${asset}`)) result.errors.push(`Missing certificate asset: ${asset}.`);
}
for (const warning of result.warnings) console.warn(`Notice: ${warning}`);
for (const error of new Set(result.errors)) console.error(`Configuration: ${error}`);
if (result.errors.length) process.exitCode = 1;
else console.log(`Deployment configuration passed (${vercel ? "Vercel" : "local"}); no secret values printed.`);

if (!result.errors.length && process.argv.includes("--verify-services")) {
  const { initializeApp, cert, deleteApp } = await import("firebase-admin/app");
  const { getSecurityRules } = await import("firebase-admin/security-rules");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { credential } = readDeploymentCredential(env);
  const app = initializeApp({ credential: cert(credential), projectId: credential.projectId }, "trashtrack-deployment-check");
  try {
    const rules = await getSecurityRules(app).getFirestoreRuleset();
    if (rules.name !== env.STAFF_SECURITY_RULESET || rules.name !== env.CERTIFICATE_SECURITY_RULESET) {
      throw new Error("The configured ruleset pins do not match the currently deployed Firestore policy.");
    }
    await getAuth(app).projectConfigManager().getProjectConfig();
    // Read one record to check Firestore connectivity; do not emit user data.
    await getFirestore(app).collection("users").limit(1).get();
    console.log("Read-only Firebase check passed: Auth, Firestore and the active ruleset pins.");
  } catch {
    console.error("Firebase readiness check failed. Verify credential permissions, internet access and the active ruleset pins.");
    process.exitCode = 1;
  } finally { await deleteApp(app); }
}
