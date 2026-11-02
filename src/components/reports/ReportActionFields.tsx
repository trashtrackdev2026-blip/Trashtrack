"use client";
import { REPORT_ACTIONS, type ReportActionInput } from "@/lib/report-action";
import { CollectionActionPicker } from "./CollectionActionPicker";
import type { ReportRole } from "@/lib/report-workflow";

export function ReportActionFields({ role, status, value, onChange, disabled, barangay = "" }: { role: ReportRole; status: string; value: ReportActionInput; onChange: (value: ReportActionInput) => void; disabled?: boolean; barangay?: string }) {
  const change = (key: keyof ReportActionInput, next: string | boolean) => onChange({ ...value, ...(key === "actionKind" ? {scheduleId:"",scheduleRevision:0,actionDate:"",actionTime:""} : {}), [key]: next });
  const input = "mt-2 min-h-11 w-full rounded-lg border bg-white p-3 text-sm text-slate-800";
  return <fieldset disabled={disabled} className="space-y-4">
    {role === "Semi-Admin" && ["Resolved", "For MENRO Review"].includes(status) && <>
      <label className="block text-sm font-semibold">Assessment<select aria-label="Report severity" className={input} value={value.severity || ""} onChange={event => change("severity", event.target.value)}><option value="">Choose severity</option><option value="Minor">Minor - within barangay capacity</option><option value="Major">Major - MENRO assistance needed</option></select></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={value.verificationConfirmed === true} onChange={event => change("verificationConfirmed", event.target.checked)} className="mt-1" />I verified the report, its location and the selected severity.</label>
    </>}
    {status === "Endorsed" && <>
      <label className="block text-sm font-semibold">Response action<select aria-label="Response action" value={value.actionKind || ""} onChange={event => change("actionKind", event.target.value)} className={input}><option value="">Choose an action</option>{REPORT_ACTIONS.map(action => <option key={action}>{action}</option>)}</select></label>
      <label className="block text-sm font-semibold">Action details<textarea aria-label="Action details" rows={3} maxLength={2000} value={value.actionNotes || ""} onChange={event => change("actionNotes", event.target.value)} className={input} /></label>
      {value.actionKind && <CollectionActionPicker key={value.actionKind} value={value} onChange={onChange} barangay={barangay} />}
    </>}
  </fieldset>;
}
