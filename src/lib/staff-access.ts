export const STAFF_BARANGAYS = [
  "Alangilan", "Calawit", "Looc", "Magapi", "Makina", "Malabanan", "Paligawan",
  "Palsara", "Poblacion", "Sala", "Sampalocan", "Solis", "San Sebastian",
] as const;
export const STAFF_SESSION_SECONDS = 8 * 60 * 60;
export const STAFF_IDLE_MS = 15 * 60 * 1000;
export type StaffRole = "admin" | "semi-admin";

export class StaffAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) { super(message); this.status = status; }
}
export function staffRole(value: unknown): StaffRole | null {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  return role === "admin" || role === "semi-admin" ? role : null;
}
export function validStaffBarangay(value: unknown): value is string {
  return typeof value === "string" && (STAFF_BARANGAYS as readonly string[]).includes(value);
}
// Only the authenticated MENRO management endpoint uses these fields. Public
// registration continues to use requestFields and cannot choose a staff role.
export function staffAssignmentFields(body: Record<string, unknown>) {
  const role = staffRole(body.role === undefined ? "Semi-Admin" : body.role);
  if (!role) throw new StaffAccessError("Choose Admin or Semi-Admin access.", 400);
  if (body.identityConfirmed !== true) throw new StaffAccessError("Confirm the official's identity and authority for this access.", 400);
  if (role === "semi-admin" && !validStaffBarangay(body.barangay)) throw new StaffAccessError("Assign one of Balete's 13 barangays for Semi-Admin access.", 400);
  return { role: role === "admin" ? "Admin" as const : "Semi-Admin" as const, barangay: role === "admin" ? "" : body.barangay as string };
}
export function staffAccessProblem(profile: Record<string, unknown>, claims: Record<string, unknown>, now = Date.now() / 1000) {
  const role = staffRole(profile.role);
  if (!role || profile.accessStatus !== "active") return "This staff account needs MENRO approval or has been suspended.";
  if (claims.staffRole !== role || (role === "semi-admin" && claims.staffBarangay !== profile.barangay)) return "Refresh your sign-in to load the approved account permissions.";
  if (claims.email_verified !== true) return "Verify your email address before using staff access.";
  if (role === "semi-admin" && !validStaffBarangay(profile.barangay)) return "MENRO must assign this account to one of Balete's 13 barangays.";
  const authTime = typeof claims.auth_time === "number" ? claims.auth_time : 0;
  if (typeof profile.staffValidAfter === "number" && authTime <= profile.staffValidAfter) return "Your access changed. Sign in again.";
  if (!authTime || authTime > now + 60 || now - authTime > STAFF_SESSION_SECONDS) return "Your staff session expired. Sign in again.";
  const firebase = claims.firebase as Record<string, unknown> | undefined;
  if (profile.mfaRequired === true && firebase?.sign_in_second_factor !== "totp") return "Sign in with your authenticator code to use MENRO access.";
  return null;
}
export function requestFields(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const position = typeof body.position === "string" ? body.position.trim() : "";
  const contact = typeof body.contact === "string" ? body.contact.trim() : "";
  if (!name || name.length > 120 || !position || position.length > 120 || !contact || contact.length > 40 || !validStaffBarangay(body.barangay)) {
    throw new StaffAccessError("Enter your name, official position, contact number and a valid Balete barangay.", 400);
  }
  return { name, position, contact, barangay: body.barangay };
}
