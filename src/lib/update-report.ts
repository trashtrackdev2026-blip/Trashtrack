import { auth } from "@/lib/firebase";
import type { ReportRole } from "@/lib/report-workflow";
import { readApiResponse } from "./api-response";
import type { ReportActionInput } from "./report-action";
const changes = new Map<string, string>();
export type ReportUpdateInput = ReportActionInput & { expectedStatus: string; expectedRevision: number };
export async function updateReportStatus(reportId: string, actor: { uid: string; role: ReportRole; barangay: string | null }, status: string, remarks: string, collectionConfirmed: boolean, details: ReportUpdateInput) {
  if (auth.currentUser?.uid !== actor.uid) throw new Error("The signed-in account changed. Reopen the report.");
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to update reports.");
  const body = { reportId, status, remarks, collectionConfirmed, ...details };
  const key = actor.uid + JSON.stringify(body);
  if (!changes.has(key)) { if (changes.size > 100) changes.clear(); changes.set(key, crypto.randomUUID()); }
  const response = await fetch("/api/reports/manage", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, changeId: changes.get(key) }), signal: AbortSignal.timeout(30000) });
  return readApiResponse<{saved:boolean;deliveryError?:string}>(response, "The report could not be updated.");
}

