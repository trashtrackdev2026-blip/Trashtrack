import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";
import { canUpdateReport, normalizeReportStatus, reportWorkflowStatus } from "@/lib/report-workflow";

export async function POST(request: Request) {
  try {
    const { db, identity, profile } = await authenticatedStaff(request);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.reportId !== "string" || !/^[\w-]{1,128}$/.test(body.reportId) || typeof body.status !== "string" || typeof body.remarks !== "string" || body.remarks.length > 2000) throw new StaffAccessError("Provide a valid report, status and remarks.", 400);
    const role = staffRole(profile.role) === "admin" ? "Admin" : "Semi-Admin";
    const ref = db.collection("reports").doc(body.reportId);
    await db.runTransaction(async tx => {
      const [reportSnap, actorSnap] = await Promise.all([tx.get(ref), tx.get(db.collection("users").doc(identity.uid))]);
      const report = reportSnap.data();
      if (!report) throw new StaffAccessError("This report no longer exists.", 404);
      const actor = actorSnap.data();
      if (staffAccessProblem(actor || {}, identity as unknown as Record<string, unknown>) || actor?.role !== profile.role || actor?.barangay !== profile.barangay || !canUpdateReport(role, profile.barangay || null, { location: report.location, status: reportWorkflowStatus(report) }, body.status, body.collectionConfirmed === true)) throw new StaffAccessError("This status change is not allowed. Refresh the report and check your barangay assignment.");
      const next = normalizeReportStatus(body.status);
      const actorName = typeof actor?.name === "string" ? actor.name.trim().slice(0, 120) : "";
      tx.update(ref, { status: next === "MENRO Under Review" ? "For MENRO Review" : next, remarks: body.remarks.trim(), updatedBy: identity.uid, updatedAt: FieldValue.serverTimestamp(),
        ...(next === "UnderReview" ? { reviewedBy: identity.uid, reviewedByName: actorName, reviewedAt: FieldValue.serverTimestamp() } : {}),
        ...(next === "For MENRO Review" ? { verifiedBy: identity.uid, verifiedByName: actorName, verifiedAt: FieldValue.serverTimestamp(), forwardedBy: identity.uid, forwardedByName: actorName, forwardedAt: FieldValue.serverTimestamp() } : {}),
        ...(next === "MENRO Under Review" ? { menroReviewedBy: identity.uid, menroReviewedAt: FieldValue.serverTimestamp() } : {}),
        ...(next === "Endorsed" ? { endorsedBy: identity.uid, endorsedAt: FieldValue.serverTimestamp() } : {}),
        ...(next === "Resolved" ? { collectedBy: identity.uid, collectedAt: FieldValue.serverTimestamp() } : {}) });
      tx.create(db.collection("audit_logs").doc(), { action: "report.status", actor: identity.uid, target: body.reportId,
        barangay: report.location, from: reportWorkflowStatus(report), to: next, at: FieldValue.serverTimestamp() });
    });
    return Response.json({ saved: true });
  } catch (error) { return staffApiError(error); }
}
