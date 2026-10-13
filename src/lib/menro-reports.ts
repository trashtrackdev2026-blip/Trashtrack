import { normalizeReportStatus } from "./report-workflow.ts";

export type MenroStage = "ready" | "submitted" | "review" | "collection" | "resolved";
export type MenroReport = { id: string; type: string; description: string; location: string; status: string; date: string; reporterName: string; reviewedByName?: string; verifiedByName?: string; forwardedByName?: string };
export type MenroFilters = { stage: MenroStage; search: string; status: string; barangay: string; days: number; assignedBarangay?: string | null; now?: Date };

export const MENRO_STAGES: { id: MenroStage; label: string; description: string }[] = [
  { id: "ready", label: "For MENRO Review", description: "Verify and send reports" },
  { id: "submitted", label: "Submitted to MENRO", description: "Waiting for MENRO review" },
  { id: "review", label: "Under MENRO Review", description: "Being reviewed by MENRO" },
  { id: "collection", label: "For Collection", description: "Scheduled by MENRO" },
  { id: "resolved", label: "Resolved", description: "Collection confirmed" },
];

export function menroStage(status: string): MenroStage | null {
  switch (normalizeReportStatus(status)) {
    case "UnderReview": return "ready";
    case "For MENRO Review": return "submitted";
    case "MENRO Under Review": return "review";
    case "Endorsed": return "collection";
    case "Resolved": return "resolved";
    default: return null;
  }
}

export function menroStatusLabel(status: string) {
  return MENRO_STAGES.find(stage => stage.id === menroStage(status))?.label || "Pending verification";
}

// Legacy report dates are phone-local "YYYY-MM-DD HH:mm" strings in Balete.
// Interpret those as Manila time rather than the browser's local time zone.
export function reportDate(value: string): Date | null {
  const raw = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + "T00:00:00+08:00"
    : /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw) ? raw.replace(" ", "T") + "+08:00" : raw;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function filterMenroReports<T extends MenroReport>(reports: T[], filters: MenroFilters): T[] {
  const term = filters.search.trim().toLowerCase();
  const now = filters.now || new Date();
  const cutoff = filters.days > 0 ? now.getTime() - filters.days * 86400000 : null;
  return reports.filter(report => {
    if (filters.assignedBarangay && report.location !== filters.assignedBarangay) return false;
    if (menroStage(report.status) !== filters.stage) return false;
    if (filters.status !== "all" && menroStage(report.status) !== filters.status) return false;
    if (filters.barangay !== "all" && report.location !== filters.barangay) return false;
    if (term && ![report.id, report.type, report.description, report.location, report.reporterName,
      report.reviewedByName, report.verifiedByName, report.forwardedByName].some(value => value?.toLowerCase().includes(term))) return false;
    if (cutoff !== null) {
      const date = reportDate(report.date)?.getTime();
      if (date === undefined || date < cutoff || date > now.getTime()) return false;
    }
    return true;
  });
}
