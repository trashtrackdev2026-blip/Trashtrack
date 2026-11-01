import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";
import { assertCollectionAvailable, collectionStatusUpdate } from "@/lib/schedule-policy";
import { collectionOutcomeNotice } from "@/lib/collection-outcome-notice";
import { queuePhoneNotification } from "@/lib/notification-delivery";
import { assertFutureSchedule } from "@/lib/scheduling-time";
import { normalizedEventTime } from "@/lib/event-form";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { app, db, identity } = await authenticatedStaff(request, true);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== "string" || !/^[\w-]{1,128}$/.test(body.id) || typeof body.expectedStatus !== "string") throw new StaffAccessError("Choose a saved collection schedule.", 400);
    if (typeof body.changeId !== "string" || !/^[\w-]{1,80}$/.test(body.changeId) || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0) throw new StaffAccessError("Refresh the dashboard, then reopen this collection before saving its outcome.", 400);
    const update = collectionStatusUpdate(body);
    const ref = db.collection("schedules").doc(body.id);
    const notificationId = `schedule_outcome_${body.id}_${body.changeId}`;
    const noticeRef = db.collection("notifications").doc(notificationId);
    const changeHash = createHash("sha256").update(JSON.stringify({ id: body.id, expectedStatus: body.expectedStatus, expectedRevision: body.expectedRevision, ...update })).digest("hex");
    const notified = await db.runTransaction(async tx => {
      const [actor, snap, notice] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)), tx.get(ref), tx.get(noticeRef)]);
      if (staffRole(actor.data()?.role) !== "admin" || staffAccessProblem(actor.data() || {}, identity as unknown as Record<string, unknown>)) throw new StaffAccessError("Your MENRO access changed. Sign in again.");
      if (notice.exists) {
        if (notice.data()?.changeHash !== changeHash || notice.data()?.createdBy !== identity.uid) throw new StaffAccessError("This saved outcome has different details. Reopen the collection.", 409);
        return true;
      }
      const current = snap.data();
      if (!current) throw new StaffAccessError("Collection schedule not found.", 404);
      if (current.status !== body.expectedStatus || Number(current.statusRevision || 0) !== body.expectedRevision) throw new StaffAccessError("This collection changed. Reopen it and review its current status.", 409);
      if (current.status === update.status && String(current.statusNotes || "").trim() === update.statusNotes) return false;
      if (update.status === "Active" && current.status !== "Active" && current.date) {
        assertFutureSchedule(String(current.date), normalizedEventTime(current.time));
      }
      const announcement = collectionOutcomeNotice(current, update.status, update.statusNotes);
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
      tx.update(ref, { ...update, statusRevision: body.expectedRevision + 1, updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp() });
      tx.create(db.collection("audit_logs").doc(), { action: "schedule.status", actor: identity.uid, target: body.id, from: current.status, to: update.status, at: FieldValue.serverTimestamp() });
      tx.create(noticeRef, { ...announcement, sourceId: body.id, changeHash, push: true, pushStatus: "pending", isRead: false,
        createdBy: identity.uid, createdAt: FieldValue.serverTimestamp(), timestamp: FieldValue.serverTimestamp() });
      return true;
    });
    if (notified) {
      try { await queuePhoneNotification(app, db, notificationId); }
      catch (error) {
        return Response.json({ saved: true, notified: true, queued: false, notificationId,
          deliveryError: error instanceof Error ? error.message : "Phone delivery is pending. Retry from Announcements." });
      }
    }
    return Response.json({ saved: true, notified, queued: notified, ...(notified ? { notificationId } : {}) });
  } catch (error) { return staffApiError(error); }
}
