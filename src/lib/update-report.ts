import { auth } from "@/lib/firebase";
import type { ReportRole } from "@/lib/report-workflow";
export async function updateReportStatus(reportId: string, _actor: { uid: string; role: ReportRole; barangay: string | null }, status: string, remarks: string, collectionConfirmed: boolean) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to update reports.");
  const response = await fetch("/api/reports/manage", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ reportId, status, remarks, collectionConfirmed }), signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The report could not be updated.");
}

