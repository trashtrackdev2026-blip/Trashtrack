import { analyticsReportDate } from "./analytics-data.ts";
import { reportDate } from "./menro-reports.ts";
import { normalizeReportStatus, REPORT_STATUS_LABELS } from "./report-workflow.ts";

type Data = Record<string,unknown>;
export type AnalyticsRecordRow = {reference:string;date:string;barangay:string;type:string;status:string};
export function analyticsMonthRange(month:string) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0,4))<1900) throw new Error("Choose a valid report month and year.");
  const start=new Date(`${month}-01T00:00:00+08:00`);
  const [year,number]=month.split("-").map(Number);
  const end=new Date(Date.UTC(year,number,1)-8*60*60*1000);
  return {start,end};
}
export function analyticsMonthLabel(month:string) {
  return month ? analyticsMonthRange(month).start.toLocaleDateString("en-US",{timeZone:"Asia/Manila",month:"long",year:"numeric"}) : "All recorded dates";
}
export function filterAnalyticsMonth<T extends Data>(records:T[],month:string,kind:"report"|"event"|"schedule"|"resource"="report"):T[] {
  if(!month)return records;
  const {start,end}=analyticsMonthRange(month);
  return records.filter(item=>{
    const date=kind==="event" ? reportDate(String(item.dateISO || item.date || "")) : kind==="schedule" ? reportDate(String(item.date || "")) : analyticsReportDate(item);
    return date!==null && date>=start && date<end;
  });
}
export function analyticsRecordRows(reports:Data[]):AnalyticsRecordRow[] {
  return [...reports].sort((a,b)=>(analyticsReportDate(a)?.getTime() ?? 0)-(analyticsReportDate(b)?.getTime() ?? 0)).map(item=>{
    const date=analyticsReportDate(item),status=normalizeReportStatus(String(item.status || ""));
    return {reference:String(item.id || "Unrecorded"),date:date?.toLocaleString("en-PH",{timeZone:"Asia/Manila",year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:true}) || "Date not recorded",
      barangay:String(item.location || item.barangay || "Unassigned"),type:String(item.type || item.category || "Other"),status:status?REPORT_STATUS_LABELS[status]:String(item.status || "Unknown")};
  });
}
