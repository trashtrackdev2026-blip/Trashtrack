import "server-only";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getSecurityRules } from "firebase-admin/security-rules";
import { getFirebaseAdminApp } from "./firebase-admin";
import { StaffAccessError, staffAccessProblem, staffRole } from "./staff-access";

export async function authenticatedAccount(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new StaffAccessError("Sign in to continue.", 401);
  const app = getFirebaseAdminApp();
  const identity = await getAuth(app).verifyIdToken(token, true);
  const db = getFirestore(app);
  const profile = (await db.collection("users").doc(identity.uid).get()).data() || {};
  if (["suspended", "disabled"].includes(String(profile.accessStatus))) throw new StaffAccessError("This account is suspended. Contact MENRO.");
  return { app, db, identity, profile };
}

export async function authenticatedStaff(request: Request, masterOnly = false, recent = false) {
  const account = await authenticatedAccount(request);
  return requireApprovedStaff(request, account, masterOnly, recent);
}

export function requireApprovedStaff(request: Request, account: Awaited<ReturnType<typeof authenticatedAccount>>, masterOnly = false, recent = false) {
  const problem = staffAccessProblem(account.profile, account.identity as unknown as Record<string, unknown>);
  if (problem) throw new StaffAccessError(problem);
  if (masterOnly && staffRole(account.profile.role) !== "admin") throw new StaffAccessError("Only the MENRO Master Admin can perform this action.");
  if (recent && Date.now() / 1000 - account.identity.auth_time > 5 * 60) throw new StaffAccessError("Sign in again before changing staff access.", 401);
  if (process.env.NODE_ENV === "production") {
    const tls = new URL(request.url).protocol === "https:" || (process.env.TRUST_TLS_PROXY === "true" && request.headers.get("x-forwarded-proto") === "https");
    if (!tls) throw new StaffAccessError("Staff access requires the secure HTTPS admin address.", 503);
  }
  return account;
}

export async function requireStaffSecurity() {
  const expected = process.env.STAFF_SECURITY_RULESET;
  if (!expected || (await getSecurityRules(getFirebaseAdminApp()).getFirestoreRuleset()).name !== expected) {
    throw new StaffAccessError("Staff access setup is not active yet. Contact MENRO.", 503);
  }
}

export function staffApiError(error: unknown) {
  if (error instanceof StaffAccessError) return Response.json({ error: error.message }, { status: error.status });
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code.startsWith("auth/")) return Response.json({ error: "Your session could not be verified. Sign in again." }, { status: 401 });
  return Response.json({ error: "The request could not be completed. Check the server connection." }, { status: 500 });
}
