export type ReportRole = "Admin" | "Semi-Admin" | "Resident" | null;
export type ReportStatus = "Pending" | "UnderReview" | "For MENRO Review" | "MENRO Under Review" | "Endorsed" | "Resolved";

export function normalizeReportStatus(status: string): ReportStatus | null {
  switch (status.replace(/\s/g, "").toLowerCase()) {
    case "reported":
    case "pending": return "Pending";
    case "underreview": return "UnderReview";
    case "formenroreview": return "For MENRO Review";
    case "menrounderreview": return "MENRO Under Review";
    case "endorsed": return "Endorsed";
    case "resolved": return "Resolved";
    default: return null;
  }
}

// Keep the stored status compatible with existing resident app versions.
// MENRO's review timestamp distinguishes active review from a new submission.
export function reportWorkflowStatus(report: { status?: unknown; menroReviewedAt?: unknown }): string {
  const status = typeof report.status === "string" ? report.status : "Pending";
  return normalizeReportStatus(status) === "For MENRO Review" && report.menroReviewedAt != null ? "MENRO Under Review" : status;
}

export function nextReportStatuses(role: ReportRole, status: string): ReportStatus[] {
  const current = normalizeReportStatus(status);
  if (role === "Semi-Admin") {
    if (current === "Pending") return ["UnderReview"];
    if (current === "UnderReview") return ["For MENRO Review"];
  }
  if (role === "Admin") {
    if (current === "For MENRO Review") return ["MENRO Under Review", "Endorsed"];
    if (current === "MENRO Under Review") return ["Endorsed"];
    if (current === "Endorsed") return ["Resolved"];
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
};

export const REPORT_ACTION_LABELS = { ...REPORT_STATUS_LABELS, UnderReview: "Start barangay review", "For MENRO Review": "Forward to MENRO", "MENRO Under Review": "Start MENRO review", Endorsed: "Schedule for collection", Resolved: "Resolve after collection" };
