import { normalizeReportStatus, reportWorkflowStatus, type ReportRole } from "./report-workflow.ts";

export type ReportSummaryFilter = "all" | "pending" | "review" | "resolved";

// Use the same status rules for each card's count and its report list.
export function filterReportSummary<T extends { status: string; menroReviewedAt?: unknown }>(
  reports: T[], filter: ReportSummaryFilter, role: ReportRole,
): T[] {
  if (filter === "all") return reports;
  const expected = filter === "pending" ? "Pending" : filter === "resolved" ? "Resolved"
    : role === "Admin" ? "MENRO Under Review" : "UnderReview";
  return reports.filter(report => normalizeReportStatus(reportWorkflowStatus(report)) === expected);
}
