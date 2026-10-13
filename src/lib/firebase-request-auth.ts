import "server-only";
import { PushConfigurationError } from "./firebase-admin";
import { CertificateError } from "./certificate-data";
import { authenticatedAccount, requireApprovedStaff } from "./staff-auth";
import { StaffAccessError } from "./staff-access";

export async function authenticatedResident(request: Request, adminOnly = false) {
  const account = await authenticatedAccount(request);
  const { identity, db, profile } = account;
  const role = String(profile?.role ?? "").trim().toLowerCase();
  if (adminOnly ? role !== "admin" : !["admin", "resident"].includes(role)) {
    throw new CertificateError(adminOnly ? "Only administrators can perform this action." : "A resident or administrator account is required.", 403);
  }
  if (role === "admin") requireApprovedStaff(request, account, true);
  return { db, identity, profile, role };
}

export function certificateApiError(error: unknown) {
  if (error instanceof StaffAccessError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof CertificateError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof PushConfigurationError) return Response.json({ error: "The admin server's Firebase credential must be configured." }, { status: 503 });
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code.startsWith("auth/")) return Response.json({ error: "Your session expired. Sign in again." }, { status: 401 });
  return Response.json({ error: "The request could not be completed. Check the admin server's connection and try again." }, { status: 500 });
}
