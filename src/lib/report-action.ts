import { StaffAccessError } from "./staff-access.ts";
import { assertFutureSchedule } from "./scheduling-time.ts";
import type { ReportRole, ReportStatus } from "./report-workflow.ts";

export const REPORT_ACTIONS = ["Collection", "Cleanup", "Recollection", "Other"] as const;
export type ReportActionInput = { verificationConfirmed?: boolean; severity?: string; actionKind?: string; actionNotes?: string; actionDate?: string; actionTime?: string };
export function reportActionFields(role: ReportRole, next: ReportStatus, body: Record<string, unknown>, now = Date.now()) {
  if (role === "Semi-Admin" && ["Resolved", "For MENRO Review"].includes(next)) {
    if (body.verificationConfirmed !== true) throw new StaffAccessError("Verify the report, location and severity before choosing its resolution path.", 400);
    const severity = next === "Resolved" ? "Minor" : "Major";
    if (body.severity !== severity) throw new StaffAccessError(next === "Resolved" ? "Only a minor report within barangay capacity can be resolved locally." : "Assess the report as major before forwarding it to MENRO.", 400);
    if (typeof body.remarks !== "string" || !body.remarks.trim()) throw new StaffAccessError("Describe the verified findings and action taken or reason for forwarding.", 400);
    return { severity };
  }
  if (next === "Endorsed") {
    const actionKind = REPORT_ACTIONS.find(value => value === body.actionKind);
    const actionNotes = typeof body.actionNotes === "string" ? body.actionNotes.trim() : "";
    if (!actionKind || !actionNotes || actionNotes.length > 2000) throw new StaffAccessError("Choose a response action and describe the planned work (up to 2,000 characters).", 400);
    const actionDate = typeof body.actionDate === "string" ? body.actionDate : "";
    const actionTime = typeof body.actionTime === "string" ? body.actionTime : "";
    if (actionKind !== "Other" || actionDate || actionTime) assertFutureSchedule(actionDate, actionTime, now);
    return { actionKind, actionNotes, actionDate, actionTime };
  }
  return {};
}
