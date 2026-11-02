import { collectionTimeLabel } from "./collection-calendar.ts";
import type {ReportStatus} from "./report-workflow.ts";

export const REPORT_PROGRESS_LABELS:Record<ReportStatus,string>={Pending:"Report submitted",UnderReview:"Barangay review started","For MENRO Review":"Forwarded to MENRO","MENRO Under Review":"MENRO review started",Endorsed:"Response action planned",Resolved:"Report resolved"};
export function reportProgressEntry(reportId:string,recipientId:string,status:ReportStatus,role:string,remarks:string,action:Record<string,unknown>,revision:number) {
  const actionNotes=String(action.actionNotes || "").trim();
  const date=String(action.actionDate || ""),time=String(action.actionTime || "");
  const details=[action.actionKind ? `${action.actionKind}: ${actionNotes}` : "",date ? `${date}${time?" at "+collectionTimeLabel(time):""}` : "",remarks.trim()].filter(Boolean).join("\n");
  const title=REPORT_PROGRESS_LABELS[status];
  const prefix=`Report REF-${reportId.slice(0,8).toUpperCase()}: ${title}.`;
  const fullMessage=prefix+(details?"\n"+details:"");
  return {recipientId,reportId,status,title,message:fullMessage.length>500?fullMessage.slice(0,499)+"…":fullMessage,fullMessage,actorRole:role,
    actionKind:String(action.actionKind || ""),actionNotes,actionDate:date,actionTime:time,remarks:remarks.trim(),revision,atMillis:Date.now(),type:"report"};
}
export function privateReportPush(id:string,notice:Record<string,unknown>,token:string) {
  if(!notice.recipientId || !notice.reportId || !notice.title || !notice.message)throw new Error("Invalid private report notification.");
  // Data-only messages are checked against the signed-in account before Android displays them.
  // Never send personal report details through a municipal/barangay topic.
  return {token,data:{notificationId:id,recipientId:String(notice.recipientId),reportId:String(notice.reportId),title:String(notice.title).slice(0,100),message:String(notice.message).slice(0,500),type:"report",openNotifications:"true"},android:{priority:"high" as const,ttl:7*86400000}};
}
