"use client";
import { REPORT_ACTIONS, REPORT_REJECTION_REASONS, type ReportActionInput } from "@/lib/report-action";
import { CollectionActionPicker } from "./CollectionActionPicker";
import type { ReportRole } from "@/lib/report-workflow";

export function ReportActionFields({ role, status, value, onChange, disabled, barangay = "" }: { role: ReportRole; status: string; value: ReportActionInput; onChange: (value: ReportActionInput) => void; disabled?: boolean; barangay?: string }) {
  const change = (key: keyof ReportActionInput, next: string | boolean) => onChange({ ...value, ...(key === "actionKind" ? {scheduleId:"",scheduleRevision:0,actionDate:"",actionTime:""} : {}), [key]: next });
  const input = "mt-2 min-h-11 w-full rounded-lg border bg-white p-3 text-sm text-slate-800";
  return <fieldset disabled={disabled} className="space-y-4">
    {status === "Rejected" && <>
      <label className="block text-sm font-semibold">Rejection reason<select aria-label="Rejection reason" className={input} value={value.rejectionReason || ""} onChange={event => change("rejectionReason", event.target.value)}><option value="">Choose a reason</option>{REPORT_REJECTION_REASONS.map(reason => <option key={reason}>{reason}</option>)}</select></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={value.verificationConfirmed === true} onChange={event => change("verificationConfirmed", event.target.checked)} />I reviewed the evidence and location and verified the rejection reason.</label>
      {value.rejectionReason === "Confirmed prank" && <p className="text-sm">This records a misuse warning and notifies the resident. MENRO can review repeated misuse in User Management.</p>}
    </>}
    {role === "Semi-Admin" && status === "Resolved" && <>
      <div className="rounded-xl border border-white/20 bg-white/5 p-3">
        <p className="text-xs font-semibold">Assessment for this action</p>
        <p className="mt-1 text-sm">Minor · Within barangay capacity</p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={value.verificationConfirmed === true} onChange={event => change("verificationConfirmed", event.target.checked)} className="mt-1" />
        I verified the report and location and confirm the concern is within barangay capacity.
      </label>
    </>}
    {status === "Endorsed" && <>
      <label className="block text-sm font-semibold">Response action<select aria-label="Response action" value={value.actionKind || ""} onChange={event => change("actionKind", event.target.value)} className={input}><option value="">Choose an action</option>{REPORT_ACTIONS.map(action => <option key={action}>{action}</option>)}</select></label>
      <label className="block text-sm font-semibold">Action details<textarea aria-label="Action details" rows={3} maxLength={2000} value={value.actionNotes || ""} onChange={event => change("actionNotes", event.target.value)} className={input} /></label>
      {value.actionKind && <CollectionActionPicker key={value.actionKind} value={value} onChange={onChange} barangay={barangay} />}
    </>}
  </fieldset>;
}
