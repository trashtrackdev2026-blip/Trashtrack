"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { STAFF_BARANGAYS } from "@/lib/staff-access";
import { staffRequest } from "@/lib/staff-client";
import { schedulingBounds, schedulingError } from "@/lib/scheduling-time";
import { normalizedEventTime } from "@/lib/event-form";
import { useSchedulingClock } from "@/lib/use-scheduling-clock";
import type { CollectionSchedule } from "@/lib/collection-calendar";

export function EditCollectionDialog({ schedule, followup, onClose, onSaved }: { schedule: CollectionSchedule; followup: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const [date, setDate] = useState(followup ? "" : schedule.date || "");
  const [time, setTime] = useState(normalizedEventTime(schedule.time));
  const [barangay, setBarangay] = useState(schedule.barangay);
  const [description, setDescription] = useState(schedule.description || schedule.notes || "");
  const [intent, setIntent] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = useSchedulingClock();
  const bounds = schedulingBounds(date, now);
  const dateError = date && time ? schedulingError(date, time, now) : "";
  const edit = (change: () => void) => { change(); setIntent(crypto.randomUUID()); setError(""); };
  const weekday = date ? new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Manila" }).format(new Date(date + "T12:00:00+08:00")) : "Choose a date";
  const field = "mt-2 min-h-11 w-full rounded-xl border border-[#dce2d5] bg-[#fffef8] px-3 py-2 text-[#183b30] focus:outline-green-800";
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy || dateError) return;
    setBusy(true); setError("");
    try {
      const result = await staffRequest<{ changed: boolean; deliveryPending: boolean }>("/api/schedules/change", { action: followup ? "followup" : "edit", id: schedule.id, changeId: intent, expectedStatus: schedule.status, expectedRevision: schedule.statusRevision || 0, date, time, barangay, description });
      onSaved(!result.changed ? "No collection details changed." : result.deliveryPending ? "Collection saved and resident update added. Phone delivery is pending in Announcements." : followup ? "Follow-up collection posted. The original outcome is kept in history." : "Collection updated. Linked report actions and resident schedules now use the new details.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The collection could not be saved."); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="tt-themed-dialog max-h-[90dvh] overflow-y-auto sm:max-w-lg" showCloseButton={!busy}>
    <DialogHeader><span className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-[#e6eddf] text-[#174c39]"><CalendarDays /></span><DialogTitle>{followup ? "A new collection day." : "Adjust the collection."}</DialogTitle><DialogDescription>{followup ? "Post a future follow-up and keep the original collection's outcome." : "Correct the details below. Residents and linked report actions will receive the change."}</DialogDescription></DialogHeader>
    <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm font-medium">Barangay<select className={field} value={barangay} onChange={e => edit(() => setBarangay(e.target.value))}><option>All Barangays</option>{STAFF_BARANGAYS.map(name => <option key={name}>{name}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Collection date<input required type="date" min={bounds.minDate} value={date} className={field} onChange={e => edit(() => setDate(e.target.value))} /><small className="mt-1 block text-[#64736b]">{weekday}</small></label><label className="text-sm font-medium">Start time<input required type="time" min={bounds.minTime} value={time} className={field} onChange={e => edit(() => setTime(e.target.value))} /><small className="mt-1 block text-[#64736b]">Philippine time · AM/PM</small></label></div>
      <label className="block text-sm font-medium">Collection notes<textarea rows={3} maxLength={2000} value={description} className={field} onChange={e => edit(() => setDescription(e.target.value))} /></label>
    </fieldset>{(error || dateError) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error || dateError}</p>}
    <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !date || !time || !!dateError}>{busy ? "Saving…" : followup ? "Post follow-up" : "Save changes"}</Button></DialogFooter></form>
  </DialogContent></Dialog>;
}
