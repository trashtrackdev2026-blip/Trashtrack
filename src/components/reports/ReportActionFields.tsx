"use client";
import { REPORT_ACTIONS, type ReportActionInput } from "@/lib/report-action";
import { schedulingBounds, schedulingError } from "@/lib/scheduling-time";
import { useSchedulingClock } from "@/lib/use-scheduling-clock";
import type { ReportRole } from "@/lib/report-workflow";

export function ReportActionFields({ role, status, value, onChange, disabled }: { role: ReportRole; status: string; value: ReportActionInput; onChange: (value: ReportActionInput) => void; disabled?: boolean }) {
  const now = useSchedulingClock();
  const bounds = schedulingBounds(value.actionDate || "", now);
  const change = (key: keyof ReportActionInput, next: string | boolean) => onChange({ ...value, [key]: next });
  const input = "mt-2 min-h-11 w-full rounded-lg border bg-white p-3 text-sm text-slate-800";
  return <fieldset disabled={disabled} className="space-y-4">
    {role === "Semi-Admin" && ["Resolved", "For MENRO Review"].includes(status) && <>
      <label className="block text-sm font-semibold">Assessment<select aria-label="Report severity" className={input} value={value.severity || ""} onChange={event => change("severity", event.target.value)}><option value="">Choose severity</option><option value="Minor">Minor - within barangay capacity</option><option value="Major">Major - MENRO assistance needed</option></select></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={value.verificationConfirmed === true} onChange={event => change("verificationConfirmed", event.target.checked)} className="mt-1" />I verified the report, its location and the selected severity.</label>
    </>}
    {status === "Endorsed" && <>
      <label className="block text-sm font-semibold">Response action<select aria-label="Response action" value={value.actionKind || ""} onChange={event => change("actionKind", event.target.value)} className={input}><option value="">Choose an action</option>{REPORT_ACTIONS.map(action => <option key={action}>{action}</option>)}</select></label>
      <label className="block text-sm font-semibold">Action details<textarea aria-label="Action details" rows={3} maxLength={2000} value={value.actionNotes || ""} onChange={event => change("actionNotes", event.target.value)} className={input} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Action date{value.actionKind === "Other" ? " (optional)" : ""}<input aria-label="Action date" type="date" min={bounds.minDate} value={value.actionDate || ""} onChange={event => change("actionDate", event.target.value)} className={input} /></label><label className="text-sm">Start time<input aria-label="Action start time" type="time" min={bounds.minTime} value={value.actionTime || ""} onChange={event => change("actionTime", event.target.value)} className={input} /></label></div>
      {value.actionDate && value.actionTime && schedulingError(value.actionDate, value.actionTime, now) && <p role="alert" className="text-sm text-red-700">{schedulingError(value.actionDate, value.actionTime, now)}</p>}
      <p className="text-xs">Dates and times use Philippine time. For collection work, use the posted time when joining an existing collection.</p>
    </>}
  </fieldset>;
}
