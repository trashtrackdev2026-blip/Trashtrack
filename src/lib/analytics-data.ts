import { normalizeReportStatus } from "./report-workflow.ts";
import { collectionStatus, COLLECTION_STATUSES } from "./schedule-policy.ts";
import { REPORT_CATEGORIES, reportCategory } from "./report-categories.ts";
import { reportDate } from "./menro-reports.ts";
import { manilaDateTime } from "./scheduling-time.ts";

type RecordData = Record<string, unknown>;
export type AnalyticsPoint = { name: string; value: number };
export const CALAWIT_SERVICE_NOTE = "Calawit relocation service note: Makina is the service location identified for relocated Calawit residents. Confirm current arrangements with MENRO. Waste report counts describe recorded concerns and do not indicate volcanic risk or residential safety.";

export function analyticsReportDate(data: RecordData): Date | null {
  const timestamp = data.createdAt as { toDate?: () => Date } | undefined;
  if (typeof timestamp?.toDate === "function") {
    const date = timestamp.toDate();
    if (Number.isFinite(date.getTime())) return date;
  }
  if (typeof data.timestamp === "number") {
    const date = new Date(data.timestamp);
    if (Number.isFinite(date.getTime())) return date;
  }
  return reportDate(String(data.date || data.timestamp || ""));
}

const monthKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).format(date).replace(/\D/g, "");

export function summarizeAnalytics(reports: RecordData[], events: RecordData[], resources: number, schedules: RecordData[], now = new Date(), trendMonths = 6) {
  const resolved = reports.filter(report => normalizeReportStatus(String(report.status)) === "Resolved");
  const resolvedReports = resolved.length;
  const rejectedReports = reports.filter(report => normalizeReportStatus(String(report.status)) === "Rejected").length;
  // Pending here means every unresolved concern, at every review/collection stage.
  const stats = { totalReports: reports.length, resolvedReports, rejectedReports, pendingReports: reports.length - resolvedReports - rejectedReports,
    totalEvents: events.length, totalResources: resources, eventParticipants: events.reduce((sum, event) => sum + (Number(event.participants) || 0), 0) };
  const [year, month] = manilaDateTime(now.getTime()).date.split("-").map(Number);
  const months = Array.from({ length: trendMonths }, (_, index) => new Date(Date.UTC(year, month - trendMonths + index, 1, 4)));
  const trendData = months.map(month => ({ name: month.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "Asia/Manila" }),
    value: reports.filter(report => { const date = analyticsReportDate(report);return date && date <= now && monthKey(date) === monthKey(month); }).length }));
  const categoryNames = REPORT_CATEGORIES;
  const colors = ["#c58d4d", "#c05248", "#68916b", "#8c7fa4"];
  const categoryData = categoryNames.map((name, index) => ({ name, color: colors[index], value: 0 }));
  for (const report of reports) {
    const category = reportCategory(report.type || report.category);
    categoryData.find(item => item.name === category)!.value++;
  }
  const eventData = ["Clean-Up Drives", "Tree Planting", "Seminars", "Other events"].map(name => ({ name, value: 0 }));
  for (const event of events) {
    const text = `${event.category || ""} ${event.title || ""}`.toLowerCase();
    eventData[text.includes("clean") ? 0 : text.includes("tree") ? 1 : text.includes("seminar") ? 2 : 3].value++;
  }
  const collectionData = COLLECTION_STATUSES.map(name => ({ name, value: 0 }));
  let historicalCollections = 0;
  for (const schedule of schedules) {
    const row = collectionData.find(item => item.name === collectionStatus(schedule.status));
    if (row) row.value++; else historicalCollections++;
  }
  const resolutionData = [
    { name: "Barangay", value: resolved.filter(report => report.resolvedByRole === "Semi-Admin").length },
    { name: "MENRO", value: resolved.filter(report => report.resolvedByRole === "Admin").length },
  ];
  return { stats, trendData, categoryData, eventData, collectionData, resolutionData,
    totalCollections: schedules.length, historicalCollections, undatedReports: reports.filter(report => !analyticsReportDate(report)).length };
}
