import { normalizeReportStatus } from "./report-workflow.ts";
import { collectionStatus } from "./schedule-policy.ts";
import { reportDate } from "./menro-reports.ts";

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

export function summarizeAnalytics(reports: RecordData[], events: RecordData[], resources: number, schedules: RecordData[], now = new Date()) {
  const resolvedReports = reports.filter(report => normalizeReportStatus(String(report.status)) === "Resolved").length;
  // Pending here means every unresolved concern, at every review/collection stage.
  const stats = { totalReports: reports.length, resolvedReports, pendingReports: reports.length - resolvedReports,
    totalEvents: events.length, totalResources: resources, eventParticipants: events.reduce((sum, event) => sum + (Number(event.participants) || 0), 0) };
  const manila = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const months = Array.from({ length: 6 }, (_, index) => new Date(Date.UTC(manila.getFullYear(), manila.getMonth() - 5 + index, 1, 4)));
  const trendData = months.map(month => ({ name: month.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "Asia/Manila" }),
    value: reports.filter(report => { const date = analyticsReportDate(report);return date && date <= now && monthKey(date) === monthKey(month); }).length }));
  const categoryNames = ["Illegal Dumping", "Uncollected Waste", "Blocked Drainage", "Mixed Waste", "Others"];
  const colors = ["#c05248", "#c58d4d", "#5e96ac", "#68916b", "#8c7fa4"];
  const categoryData = categoryNames.map((name, index) => ({ name, color: colors[index], value: 0 }));
  for (const report of reports) {
    const type = String(report.type || report.category || "").toLowerCase();
    const index = categoryNames.findIndex(name => type.includes(name.toLowerCase()));
    categoryData[index < 0 ? 4 : index].value++;
  }
  const percentages = categoryData.map(item => ({ ...item, value: reports.length ? Math.round(item.value / reports.length * 100) : 0 }));
  const eventData = ["Clean-Up Drives", "Tree Planting", "Seminars", "Other events"].map(name => ({ name, value: 0 }));
  for (const event of events) {
    const text = `${event.category || ""} ${event.title || ""}`.toLowerCase();
    eventData[text.includes("clean") ? 0 : text.includes("tree") ? 1 : text.includes("seminar") ? 2 : 3].value++;
  }
  const collectionData = ["Active", "Completed", "Unfinished", "Failed", "Inactive", "Unknown"].map(name => ({ name, value: 0 }));
  for (const schedule of schedules) collectionData.find(item => item.name === (collectionStatus(schedule.status) || "Unknown"))!.value++;
  return { stats, trendData, categoryData: percentages, eventData, collectionData,
    totalCollections: schedules.length, undatedReports: reports.filter(report => !analyticsReportDate(report)).length };
}
