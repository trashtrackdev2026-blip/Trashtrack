import { collectionChangeMessage } from "@/lib/collection-outcome-notice";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";
import { assertCollectionAvailable, assertCollectionEditable, collectionStatus } from "@/lib/schedule-policy";
import { communityPublication } from "@/lib/community-publication";
import { assertFutureSchedule } from "@/lib/scheduling-time";
import { normalizeReportStatus } from "@/lib/report-workflow";
import { queuePhoneNotification } from "@/lib/notification-delivery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { app, db, identity } = await authenticatedStaff(request, true);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || !["edit", "followup", "delete"].includes(body.action) || !/^[\w-]{1,128}$/.test(body.id || "")
      || !/^[\w-]{1,80}$/.test(body.changeId || "") || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 || typeof body.expectedStatus !== "string") throw new StaffAccessError("Reopen a collection before changing it.", 400);
    const fields = body.action === "delete" ? null : communityPublication("schedule", body).post;
    if (fields && "time" in fields) assertFutureSchedule(fields.date, fields.time);
    if (typeof body.description === "string" && body.description.length > 2000) throw new StaffAccessError("Use collection notes up to 2,000 characters.", 400);
    const ref = db.collection("schedules").doc(body.id);
    const operation = db.collection("collection_actions").doc(body.id + "_" + body.changeId);
    const changeHash = createHash("sha256").update(JSON.stringify({ action: body.action, id: body.id, expectedRevision: body.expectedRevision, expectedStatus: body.expectedStatus, fields })).digest("hex");
    const result = await db.runTransaction(async tx => {
      const [actor, saved, prior] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)), tx.get(ref), tx.get(operation)]);
      if (staffRole(actor.data()?.role) !== "admin" || staffAccessProblem(actor.data() || {}, identity as unknown as Record<string, unknown>)) throw new StaffAccessError("Your MENRO access changed. Sign in again.");
      if (prior.exists) {
        const data = prior.data()!;
        if (data.actor !== identity.uid || data.changeHash !== changeHash) throw new StaffAccessError("This request was already saved with different details. Reopen the collection.", 409);
        return { noticeIds: data.noticeIds as string[], scheduleId: String(data.scheduleId || ""), changed: true };
      }
      const current = saved.data();
      if (!current) throw new StaffAccessError("This collection no longer exists.", 404);
      assertCollectionEditable(current);
      if (current.status !== body.expectedStatus || Number(current.statusRevision || 0) !== body.expectedRevision) throw new StaffAccessError("This collection changed. Reopen it to review the latest details.", 409);
      if (body.action === "followup" && !["Failed", "Unfinished", "Inactive"].includes(collectionStatus(current.status) || "")) throw new StaffAccessError("Use a follow-up for a failed or unfinished collection.", 409);
      const [linked, ...days] = await Promise.all([
        tx.get(db.collection("reports").where("scheduleId", "==", body.id)),
        ...[...new Set([current.date, fields?.date].filter(value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort().map(async date => {
          const lock = db.collection("schedule_days").doc(date);
          const [day, schedules] = await Promise.all([tx.get(lock), tx.get(db.collection("schedules").where("date", "==", date))]);
          return { date, lock, revision: Number(day.data()?.revision || 0), schedules };
        }),
      ]);
      if (body.action === "delete" && !linked.empty && linked.docs.length) throw new StaffAccessError("This collection is linked to a report. Plan a follow-up or reassign its report action before removing it.", 409);
      const openReports = linked.docs.filter(doc => normalizeReportStatus(String(doc.data().status)) !== "Resolved");
      if (openReports.length > 200) throw new StaffAccessError("This collection has too many linked actions for one update. Contact the project owner before changing it.", 409);
      if (fields && linked.docs.some(doc => ![doc.data().location, "All Barangays"].includes(fields.barangay))) throw new StaffAccessError("The selected barangay does not cover a linked report. Keep its barangay or choose All Barangays.", 409);
      const same = fields && ["date", "day", "time", "barangay", "description"].every(key => String(current[key] || "") === String(fields[key as keyof typeof fields] || ""));
      if (body.action === "edit" && same) return { noticeIds: [] as string[], scheduleId: body.id as string, changed: false };
      if (fields) {
        const targetDay = days.find(day => day.date === fields.date)!;
        assertCollectionAvailable({ date: fields.date, barangay: fields.barangay }, targetDay.schedules.docs.filter(doc => body.action === "followup" || doc.id !== body.id).map(doc => doc.data()));
      }
      const scheduleId = body.action === "followup" ? "followup_" + createHash("sha256").update(body.id + "\0" + body.changeId).digest("hex").slice(0, 40) : body.id;
      const revision = body.expectedRevision + 1;
      const after = fields ? { ...fields, status: body.action === "followup" ? "Active" : current.status } : null;
      const noticeIds: string[] = [];
      const recipients = [...new Set([String(current.barangay), ...(fields ? [fields.barangay] : [])])];
      for (const [index, audience] of recipients.entries()) {
        const noticeId = "schedule_change_" + body.id + "_" + body.changeId + "_" + index;
        noticeIds.push(noticeId);
        const title = body.action === "delete" ? "Collection cancelled" : body.action === "followup" ? "Follow-up collection" : "Collection schedule updated";
        const message = collectionChangeMessage(body.action, current, fields);
        tx.create(db.collection("notifications").doc(noticeId), { title, message, outcomeNotes:String(current.statusNotes || "").trim(), outcomeStatus:String(current.status || ""), type: "schedule", recipients: audience, sourceId: scheduleId, changeHash, push: true, pushStatus: "pending", isRead: false, createdBy: identity.uid, createdAt: FieldValue.serverTimestamp(), timestamp: FieldValue.serverTimestamp() });
      }
      for (const day of days) tx.set(day.lock, { revision: day.revision + 1 });
      if (body.action === "delete") tx.delete(ref);
      else if (body.action === "followup") {
        tx.create(db.collection("schedules").doc(scheduleId), { ...fields, followsScheduleId: body.id, statusRevision: 0, createdBy: identity.uid, createdAt: FieldValue.serverTimestamp() });
        tx.update(ref, { followupScheduleId: scheduleId, statusRevision: revision, updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp() });
      } else {
        const details = { date: fields!.date, day: fields!.day, time: fields!.time, barangay: fields!.barangay, description: fields!.description };
        tx.update(ref, { ...details, statusRevision: revision, updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp() });
      }
      if (fields) for (const report of openReports) {
        const old = report.data();
        tx.update(report.ref, { scheduleId, actionDate: fields.date, actionTime: fields.time, originalActionDate: old.originalActionDate || old.actionDate || current.date || "", originalActionTime: old.originalActionTime || old.actionTime || current.time || "", scheduleRevision: body.action === "followup" ? 0 : revision, statusRevision: Number(old.statusRevision || 0) + 1, rescheduledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: identity.uid });
      }
      const audit = { action: "schedule." + body.action, target: body.id, actor: identity.uid, scheduleId, before: { date: current.date || "", time: current.time || "", barangay: current.barangay, status: current.status, description: current.description || "" }, after, linkedReports: openReports.map(report => report.id), at: FieldValue.serverTimestamp() };
      tx.create(db.collection("audit_logs").doc(), audit);
      tx.create(operation, { ...audit, changeHash, noticeIds });
      return { noticeIds, scheduleId, changed: true };
    });
    const deliveries = await Promise.allSettled(result.noticeIds.map(id => queuePhoneNotification(app, db, id)));
    return Response.json({ saved: true, ...result, deliveryPending: deliveries.some(delivery => delivery.status === "rejected") });
  } catch (error) { return staffApiError(error); }
}
