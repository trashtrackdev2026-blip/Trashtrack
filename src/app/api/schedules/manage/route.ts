import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";
import { assertCollectionAvailable, collectionStatusUpdate } from "@/lib/schedule-policy";

export async function POST(request: Request) {
  try {
    const { db, identity } = await authenticatedStaff(request, true);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== "string" || !/^[\w-]{1,128}$/.test(body.id) || typeof body.expectedStatus !== "string") throw new StaffAccessError("Choose a saved collection schedule.", 400);
    const update = collectionStatusUpdate(body);
    const ref = db.collection("schedules").doc(body.id);
    await db.runTransaction(async tx => {
      const [actor, snap] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)), tx.get(ref)]);
      if (staffRole(actor.data()?.role) !== "admin" || staffAccessProblem(actor.data() || {}, identity as unknown as Record<string, unknown>)) throw new StaffAccessError("Your MENRO access changed. Sign in again.");
      const current = snap.data();
      if (!current) throw new StaffAccessError("Collection schedule not found.", 404);
      if (current.status !== body.expectedStatus) throw new StaffAccessError("This collection changed. Reopen it and review its current status.", 409);
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(current.date))) {
        const lock = db.collection("schedule_days").doc(current.date);
        const [day, schedules] = await Promise.all([tx.get(lock), tx.get(db.collection("schedules").where("date", "==", current.date))]);
        // Closing or documenting an old duplicate must remain possible. Only
        // reactivating a released date acquires a new reservation.
        if (["Failed", "Inactive"].includes(current.status) && !["Failed", "Inactive"].includes(update.status)) {
          assertCollectionAvailable({ date: current.date, barangay: current.barangay }, schedules.docs.filter(doc => doc.id !== body.id).map(doc => doc.data()));
        }
        tx.set(lock, { revision: Number(day.data()?.revision || 0) + 1 });
      }
      tx.update(ref, { ...update, updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection("audit_logs").doc(), { action: "schedule.status", actor: identity.uid, target: body.id, from: current.status, to: update.status, at: FieldValue.serverTimestamp() });
    });
    return Response.json({ saved: true });
  } catch (error) { return staffApiError(error); }
}
