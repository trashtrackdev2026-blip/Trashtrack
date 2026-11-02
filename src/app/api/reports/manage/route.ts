import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";
import { canUpdateReport, normalizeReportStatus, reportWorkflowStatus } from "@/lib/report-workflow";
import { reportActionFields } from "@/lib/report-action";
import { assertCollectionAvailable } from "@/lib/schedule-policy";
import { communityPublication } from "@/lib/community-publication";
import { queuePhoneNotification } from "@/lib/notification-delivery";
import { assertFutureSchedule } from "@/lib/scheduling-time";
import { normalizedEventTime } from "@/lib/event-form";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { app, db, identity, profile } = await authenticatedStaff(request);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.reportId !== "string" || !/^[\w-]{1,128}$/.test(body.reportId) || typeof body.status !== "string" || typeof body.remarks !== "string" || body.remarks.length > 2000) throw new StaffAccessError("Provide a valid report, status and remarks.", 400);
    if (typeof body.changeId !== "string" || !/^[\w-]{1,80}$/.test(body.changeId) || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 || typeof body.expectedStatus !== "string") throw new StaffAccessError("Refresh the dashboard and reopen this report before updating it.", 400);
    const role = staffRole(profile.role) === "admin" ? "Admin" : "Semi-Admin";
    const ref = db.collection("reports").doc(body.reportId);
    const operation = db.collection("report_actions").doc(body.reportId + "_" + body.changeId);
    const changeHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const notificationId = await db.runTransaction(async tx => {
      const [reportSnap, actorSnap, previous] = await Promise.all([tx.get(ref), tx.get(db.collection("users").doc(identity.uid)), tx.get(operation)]);
      const report = reportSnap.data();
      if (!report) throw new StaffAccessError("This report no longer exists.", 404);
      const actor = actorSnap.data();
      if (staffAccessProblem(actor || {}, identity as unknown as Record<string, unknown>) || actor?.role !== profile.role || actor?.barangay !== profile.barangay || (role === "Semi-Admin" && report.location !== profile.barangay)) throw new StaffAccessError("Your access changed. Refresh the report and check your barangay assignment.");
      if (previous.exists) {
        if (previous.data()?.changeHash !== changeHash || previous.data()?.actor !== identity.uid) throw new StaffAccessError("This update was already saved with different details. Reopen the report.", 409);
        return String(previous.data()?.notificationId || "");
      }
      const currentStatus = reportWorkflowStatus(report);
      if (normalizeReportStatus(body.expectedStatus) !== normalizeReportStatus(currentStatus) || body.expectedRevision !== Number(report.statusRevision || 0)) throw new StaffAccessError("This report changed. Reopen it before updating.", 409);
      if (!canUpdateReport(role, profile.barangay || null, { location: report.location, status: currentStatus }, body.status, body.collectionConfirmed === true)) throw new StaffAccessError("This status change is not allowed. Review the current report stage and confirm the completed action.");
      const next = normalizeReportStatus(body.status)!;
      let action: Record<string, unknown> = reportActionFields(role, next, body);
      const actorName = typeof actor?.name === "string" ? actor.name.trim().slice(0, 120) : "";
      // Read the reservation before writing. Related reports can join the same
      // active collection when their selected barangay, date and time agree.
      let scheduleId = "";
      let scheduleNoticeId = "";
      if (action.scheduleId) {
        const selected = await tx.get(db.collection("schedules").doc(String(action.scheduleId)));
        const data = selected.data();
        if (!data || data.status !== "Active" || ![report.location, "All Barangays"].includes(data.barangay) || Number(data.statusRevision || 0) !== action.scheduleRevision) throw new StaffAccessError("The selected collection changed or is unavailable. Select its latest schedule.", 409);
        const time = normalizedEventTime(data.time);
        assertFutureSchedule(String(data.date || ""), time);
        const lock = db.collection("schedule_days").doc(data.date);
        const day = await tx.get(lock);
        scheduleId = selected.id;
        action = { ...action, actionDate: data.date, actionTime: time };
        tx.set(lock, { revision: Number(day.data()?.revision || 0) + 1 });
      } else if ("actionKind" in action && action.actionKind !== "Other" && action.actionDate && action.actionTime) {
        const dayRef = db.collection("schedule_days").doc(String(action.actionDate));
        const [day, schedules] = await Promise.all([tx.get(dayRef), tx.get(db.collection("schedules").where("date", "==", action.actionDate))]);
        const matching = schedules.docs.find(doc => { const data = doc.data(); return data.status === "Active" && data.time === action.actionTime && [report.location, "All Barangays"].includes(data.barangay); });
        if (matching) scheduleId = matching.id;
        else {
          assertCollectionAvailable({ date: String(action.actionDate), barangay: report.location }, schedules.docs.map(doc => doc.data()));
          scheduleId = "report_" + createHash("sha256").update(body.reportId + "\0" + body.changeId).digest("hex").slice(0,40);
          scheduleNoticeId = "schedule_" + scheduleId;
          const publication=communityPublication("schedule",{barangay:report.location,date:action.actionDate,time:action.actionTime,description:`${action.actionKind}: ${action.actionNotes}`.slice(0,2000)});
          tx.create(db.collection("schedules").doc(scheduleId), { ...publication.post, sourceReportId: body.reportId, createdBy: identity.uid, createdAt: FieldValue.serverTimestamp() });
          tx.create(db.collection("notifications").doc(scheduleNoticeId),{...publication.announcement,sourceId:scheduleId,push:true,pushStatus:"pending",isRead:false,createdBy:identity.uid,createdAt:FieldValue.serverTimestamp(),timestamp:FieldValue.serverTimestamp()});
        }
        tx.set(dayRef, { revision: Number(day.data()?.revision || 0) + 1 });
      }
      tx.update(ref, { ...action, ...(scheduleId ? { scheduleId } : {}), status: next === "MENRO Under Review" ? "For MENRO Review" : next, statusRevision: body.expectedRevision + 1, remarks: body.remarks.trim(), updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp(),
        ...(role === "Semi-Admin" && ["Resolved", "For MENRO Review"].includes(next) ? {verificationNotes:body.remarks.trim()} : {}),
        ...(next === "UnderReview" ? { reviewedBy: identity.uid, reviewedByName: actorName, reviewedAt: FieldValue.serverTimestamp() } : {}),
        ...(role === "Semi-Admin" && ["Resolved", "For MENRO Review"].includes(next) ? { verifiedBy: identity.uid, verifiedByName: actorName, verifiedAt: FieldValue.serverTimestamp() } : {}),
        ...(next === "For MENRO Review" ? { forwardedBy: identity.uid, forwardedByName: actorName, forwardedAt: FieldValue.serverTimestamp() } : {}),
        ...(next === "MENRO Under Review" ? { menroReviewedBy: identity.uid, menroReviewedByName: actorName, menroReviewedAt: FieldValue.serverTimestamp() } : {}),
        ...(next === "Endorsed" ? { endorsedBy: identity.uid, endorsedAt: FieldValue.serverTimestamp() } : {}),
        ...(next === "Resolved" ? { resolvedBy: identity.uid, resolvedByName: actorName, resolvedByRole: role, resolvedAt: FieldValue.serverTimestamp(), resolutionNotes: body.remarks.trim(), collectedBy: identity.uid, collectedAt: FieldValue.serverTimestamp() } : {}) });
      const audit = { action: "report.status", actor: identity.uid, actorRole:role, target: body.reportId, barangay: report.location, from: currentStatus, to: next, findings:body.remarks.trim(), ...action, ...(scheduleId ? { scheduleId } : {}), at: FieldValue.serverTimestamp() };
      tx.create(db.collection("audit_logs").doc(), audit);
      tx.create(operation, { ...audit, changeHash, notificationId:scheduleNoticeId });
      return scheduleNoticeId;
    });
    if(notificationId) {
      try {await queuePhoneNotification(app,db,notificationId);}
      catch(error){return Response.json({saved:true,queued:false,notificationId,deliveryError:error instanceof Error?error.message:"The action and schedule are saved. Retry phone delivery in Announcements."});}
    }
    return Response.json({ saved: true });
  } catch (error) { return staffApiError(error); }
}
