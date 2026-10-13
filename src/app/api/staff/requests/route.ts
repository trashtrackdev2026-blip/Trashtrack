import { FieldValue } from "firebase-admin/firestore";
import { authenticatedAccount, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, requestFields, staffRole } from "@/lib/staff-access";

export async function GET(request: Request) {
  try {
    const { db, identity } = await authenticatedAccount(request);
    await requireStaffSecurity();
    const record = (await db.collection("staff_requests").doc(identity.uid).get()).data();
    return Response.json({ request: record || null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return staffApiError(error); }
}
export async function POST(request: Request) {
  try {
    const { db, identity, profile } = await authenticatedAccount(request);
    await requireStaffSecurity();
    if (!identity.email_verified || !identity.email) throw new StaffAccessError("Verify your email before requesting barangay access.");
    if (staffRole(profile.role) === "admin" || (staffRole(profile.role) === "semi-admin" && profile.accessStatus === "active")) throw new StaffAccessError("This account already has approved staff access.", 409);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new StaffAccessError("Enter the required request details.", 400);
    const details = requestFields(body);
    const ref = db.collection("staff_requests").doc(identity.uid);
    await db.runTransaction(async tx => {
      const existing = (await tx.get(ref)).data();
      if (existing?.status === "pending") throw new StaffAccessError("Your request is already awaiting MENRO review.", 409);
      if (existing?.submittedAt?.toMillis && Date.now() - existing.submittedAt.toMillis() < 60 * 60 * 1000) throw new StaffAccessError("Wait one hour before submitting another request.", 429);
      tx.set(ref, { ...details, userId: identity.uid, email: identity.email, status: "pending", submittedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection("audit_logs").doc(), { action: "staff.request", actor: identity.uid, target: identity.uid, barangay: details.barangay, at: FieldValue.serverTimestamp() });
    });
    return Response.json({ saved: true });
  } catch (error) { return staffApiError(error); }
}
