export type ReportRole = "Admin" | "Semi-Admin" | "Resident" | null;
export type ReportStatus = "Pending" | "UnderReview" | "For MENRO Review" | "MENRO Under Review" | "Endorsed" | "Resolved" | "Rejected";

export function normalizeReportStatus(status: string): ReportStatus | null {
  switch (status.replace(/\s/g, "").toLowerCase()) {
    case "reported":
    case "pending": return "Pending";
    case "underreview": return "UnderReview";
    case "formenroreview": return "For MENRO Review";
    case "menrounderreview": return "MENRO Under Review";
    case "endorsed": return "Endorsed";
    case "resolved": return "Resolved";
    case "rejected": return "Rejected";
    default: return null;
  }
}

// Keep the stored status compatible with existing resident app versions.
// MENRO's review timestamp distinguishes active review from a new submission.
export function reportWorkflowStatus(report: { status?: unknown; menroReviewedAt?: unknown }): string {
  const status = typeof report.status === "string" ? report.status : "Pending";
  return normalizeReportStatus(status) === "For MENRO Review" && report.menroReviewedAt != null ? "MENRO Under Review" : status;
}

// Resolution is the archive boundary, including reports saved before archive metadata existed.
// Keep the resident-facing status as Resolved so timelines and analytics retain their meaning.
export function isReportArchived(report: { status?: unknown }): boolean {
  return typeof report.status === "string" && normalizeReportStatus(report.status) === "Resolved";
}

export function nextReportStatuses(role: ReportRole, status: string): ReportStatus[] {
  const current = normalizeReportStatus(status);
  if (role === "Semi-Admin") {
    if (current === "Pending") return ["UnderReview", "Rejected"];
    if (current === "UnderReview") return ["Resolved", "For MENRO Review", "Rejected"];
  }
  if (role === "Admin") {
    if (current === "Pending" || current === "UnderReview") return ["Rejected"];
    if (current === "For MENRO Review") return ["MENRO Under Review", "Rejected"];
    if (current === "MENRO Under Review") return ["Endorsed", "Rejected"];
    if (current === "Endorsed") return ["Resolved", "Rejected"];
  }
  return [];
}

export function canUpdateReport(
  role: ReportRole, barangay: string | null, report: { location: string; status: string },
  nextStatus: string, collectionConfirmed = false,
): boolean {
  if (role === "Semi-Admin" && (!barangay || report.location !== barangay)) return false;
  const next = normalizeReportStatus(nextStatus);
  return next !== null && nextReportStatuses(role, report.status).includes(next)
    && (next !== "Resolved" || collectionConfirmed);
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  Pending: "Reported",
  UnderReview: "Under Review",
  "For MENRO Review": "Under MENRO Review",
  "MENRO Under Review": "Under MENRO Review",
  Endorsed: "In Progress",
  Resolved: "Resolved",
  Rejected: "Rejected",
};

export const REPORT_ACTION_LABELS = { ...REPORT_STATUS_LABELS, UnderReview: "Start barangay review", "For MENRO Review": "Forward major report to MENRO", "MENRO Under Review": "Start MENRO review", Endorsed: "Plan response action", Resolved: "Confirm resolution", Rejected: "Reject report" };
