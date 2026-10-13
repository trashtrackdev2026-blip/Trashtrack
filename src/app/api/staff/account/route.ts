import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedAccount, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";

export async function GET(request: Request) {
  try {
    const { app, profile, identity } = await authenticatedAccount(request);
    // Only the authenticator setup screen needs the project configuration.
    // Normal sign-in still verifies the account and all required MFA claims.
    let totpEnabled: boolean | undefined;
    if (new URL(request.url).searchParams.get("setup") === "1") {
      const config = await getAuth(app).projectConfigManager().getProjectConfig();
      totpEnabled = config.multiFactorConfig?.state === "ENABLED" && config.multiFactorConfig.providerConfigs?.some(p => p.state === "ENABLED" && p.totpProviderConfig !== undefined) === true;
    }
    return Response.json({ profile, problem: staffAccessProblem(profile, identity as unknown as Record<string, unknown>), totpEnabled },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return staffApiError(error); }
}

export async function POST(request: Request) {
  try {
    const { app, db, identity, profile } = await authenticatedAccount(request);
    await requireStaffSecurity();
    if (!staffRole(profile.role) || profile.accessStatus !== "active" || !identity.email_verified || Date.now() / 1000 - identity.auth_time > 300) throw new StaffAccessError("Sign in again with your approved staff account before setting up an authenticator.", 401);
    const user = await getAuth(app).getUser(identity.uid);
    if (!user.multiFactor?.enrolledFactors.some(factor => factor.factorId === "totp")) throw new StaffAccessError("Complete authenticator enrollment first.", 409);
    await db.runTransaction(async tx => {
      const ref = db.collection("users").doc(identity.uid);
      const current = (await tx.get(ref)).data();
      if (current?.accessStatus !== "active" || current?.role !== profile.role) throw new StaffAccessError("Your access changed during enrollment.");
      tx.update(ref, { mfaRequired: true, staffValidAfter: Math.floor(Date.now() / 1000) });
      tx.create(db.collection("audit_logs").doc(), { action: "staff.authenticator", actor: identity.uid, target: identity.uid, at: FieldValue.serverTimestamp() });
    });
    await getAuth(app).revokeRefreshTokens(identity.uid);
    return Response.json({ saved: true });
  } catch (error) { return staffApiError(error); }
}
