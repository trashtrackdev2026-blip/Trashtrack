"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeWithDeadline } from "@/lib/live-data";
import { schedulingBounds, schedulingError } from "@/lib/scheduling-time";
import { useSchedulingClock } from "@/lib/use-scheduling-clock";
import { normalizedEventTime } from "@/lib/event-form";
import { collectionTimeLabel } from "@/lib/collection-calendar";
import type { ReportActionInput } from "@/lib/report-action";

type Posted = { id: string; barangay: string; date: string; time: string; statusRevision: number };
export function CollectionActionPicker({ value, onChange, barangay }: { value: ReportActionInput; onChange: (value: ReportActionInput) => void; barangay: string }) {
  const [mode, setMode] = useState<"posted" | "new">("posted");
  const [posted, setPosted] = useState<Posted[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const now = useSchedulingClock();
  useEffect(() => subscribeWithDeadline(collection(db, "schedules"), snapshot => {
    setPosted(snapshot.docs.filter(doc => doc.data().status === "Active").map(doc => {const data = doc.data();return { id: doc.id, barangay: data.barangay, date: data.date || "", time: normalizedEventTime(data.time), statusRevision: Number(data.statusRevision || 0) };}));setLoading(false);setError("");
  }, () => {setError("Posted collections could not be loaded.");setLoading(false);}), [attempt]);
  const eligible = posted.filter(schedule => [barangay, "All Barangays"].includes(schedule.barangay) && !schedulingError(schedule.date, schedule.time, now)).sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
  const bounds = schedulingBounds(value.actionDate || "", now);
  const input = "mt-2 min-h-11 w-full rounded-lg border bg-white p-3 text-sm text-slate-800";
  return <div className="space-y-3">
    {value.actionKind !== "Other" && <><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" name="collection-source" checked={mode === "posted"} onChange={() => {setMode("posted");onChange({...value,scheduleId:"",scheduleRevision:0,actionDate:"",actionTime:""});}} /> Posted collection</label><label className="flex items-center gap-2"><input type="radio" name="collection-source" checked={mode === "new"} onChange={() => {setMode("new");onChange({...value,scheduleId:"",scheduleRevision:0});}} /> New collection</label></div>
    {mode === "posted" && <label className="block text-sm">Collection for {barangay}<select aria-label="Posted collection" className={input} value={value.scheduleId || ""} disabled={loading} onChange={event => {const selected = eligible.find(item => item.id === event.target.value);onChange({...value,scheduleId:selected?.id || "",scheduleRevision:selected?.statusRevision || 0,actionDate:selected?.date || "",actionTime:selected?.time || ""});}}><option value="">{loading ? "Loading posted collections…" : "Choose a collection"}</option>{eligible.map(schedule => <option key={schedule.id} value={schedule.id}>{schedule.date} · {collectionTimeLabel(schedule.time)} · {schedule.barangay}</option>)}</select>{!loading && !eligible.length && !error && <span className="mt-2 block text-xs">No future collection covers this barangay. Choose New collection to post one.</span>}{value.scheduleId && !eligible.some(item => item.id === value.scheduleId && item.statusRevision === value.scheduleRevision) && <span role="alert" className="mt-2 block text-sm">This collection changed. Select its latest details before saving.</span>}</label>}
    {error && <p role="alert" className="text-sm">{error} <button type="button" className="underline" onClick={() => {setLoading(true);setAttempt(n => n+1);}}>Retry</button></p>}</>}
    {(mode === "new" || value.actionKind === "Other") && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Action date{value.actionKind === "Other" ? " (optional)" : ""}<input aria-label="Action date" type="date" min={bounds.minDate} value={value.actionDate || ""} onChange={event => onChange({...value,actionDate:event.target.value})} className={input} /></label><label className="text-sm">Start time<input aria-label="Action start time" type="time" min={bounds.minTime} value={value.actionTime || ""} onChange={event => onChange({...value,actionTime:event.target.value})} className={input} /></label></div>}
    {value.actionDate && value.actionTime && schedulingError(value.actionDate, value.actionTime, now) && <p role="alert" className="text-sm">{schedulingError(value.actionDate,value.actionTime,now)}</p>}
    <p className="text-xs leading-relaxed">Dates use Philippine time. Posted collections stay linked if MENRO reschedules them. <Link href="/schedules" target="_blank" className="underline">Manage collections</Link></p>
  </div>;
}
