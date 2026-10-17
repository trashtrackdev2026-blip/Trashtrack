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
    const { db, identity } = await authenticatedAccount(request);
    await requireStaffSecurity();
    // Registration queues a request before email verification. Only MENRO's
    // approval endpoint can activate access, after checking Firebase Auth.
    if (!identity.email) throw new StaffAccessError("Use an email account to request barangay access.", 400);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new StaffAccessError("Enter the required request details.", 400);
    const details = requestFields(body);
    const ref = db.collection("staff_requests").doc(identity.uid);
    const profileRef = db.collection("users").doc(identity.uid);
    await db.runTransaction(async tx => {
      const [requestSnap, profileSnap] = await Promise.all([tx.get(ref), tx.get(profileRef)]);
      const existing = requestSnap.data();
      const profile = profileSnap.data();
      if (staffRole(profile?.role) === "admin" || (staffRole(profile?.role) === "semi-admin" && profile?.accessStatus === "active")) throw new StaffAccessError("This account already has approved staff access.", 409);
      if (["suspended", "disabled", "activating"].includes(String(profile?.accessStatus))) throw new StaffAccessError("Contact MENRO about this account's staff access.", 409);
      if (existing?.status === "pending") {
        // A retry after a lost response must not create a second request or
        // overwrite the details that MENRO is already reviewing.
        if (Object.entries(details).every(([key, value]) => existing[key] === value)) return;
        throw new StaffAccessError("Your request is already awaiting MENRO review.", 409);
      }
      if (existing?.submittedAt?.toMillis && Date.now() - existing.submittedAt.toMillis() < 60 * 60 * 1000) throw new StaffAccessError("Wait one hour before submitting another request.", 429);
      if (!profile) tx.set(profileRef, { name: details.name, email: identity.email, contact: details.contact, barangay: details.barangay, points: 0, role: "Resident", createdAt: FieldValue.serverTimestamp() });
      tx.set(ref, { ...details, userId: identity.uid, email: identity.email, status: "pending", submittedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection("audit_logs").doc(), { action: "staff.request", actor: identity.uid, target: identity.uid, barangay: details.barangay, at: FieldValue.serverTimestamp() });
    });
    return Response.json({ saved: true });
  } catch (error) { return staffApiError(error); }
}
