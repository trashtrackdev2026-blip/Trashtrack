"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STAFF_BARANGAYS } from "@/lib/staff-access";
import { eventRequest } from "@/lib/event-client";
import { eventEditorTime, eventEditorDate } from "@/lib/event-edit";
import { assertFutureSchedule, schedulingBounds, schedulingError } from "@/lib/scheduling-time";
import { useSchedulingClock } from "@/lib/use-scheduling-clock";
import { EVENT_CATEGORIES, canonicalEventCategory } from "@/lib/event-categories";

export type EditableEvent = { id: string; title: string; barangay: string; date: string; dateISO?: string; time: string; startTime?: string; endTime?: string; location?: string; category?: string; description: string };
export function EditEventDialog({ event, onClose }: { event: EditableEvent; onClose: () => void }) {
  const now = useSchedulingClock();
  const [form, setForm] = useState(() => ({ title: event.title, barangay: event.barangay,
    dateISO: eventEditorDate(event.dateISO, event.date),
    startTime: event.startTime || eventEditorTime(event.time),
    endTime: event.endTime || eventEditorTime(event.time, 1),
    location: event.location || "", category: canonicalEventCategory(event.category) || "Other", description: event.description || "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (saving) return;
    setSaving(true); setError("");
    try { assertFutureSchedule(form.dateISO, form.startTime); await eventRequest("/api/events/manage", { action: "edit", eventId: event.id, ...form }); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Event details could not be saved."); }
    finally { setSaving(false); }
  }
  const field = (name: keyof typeof form, value: string) => setForm(current => ({ ...current, [name]: value }));
  const bounds = schedulingBounds(form.dateISO, now), dateTimeError = schedulingError(form.dateISO, form.startTime, now);
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-2xl" showCloseButton={!saving}>
    <DialogHeader><DialogTitle>Edit community event</DialogTitle><DialogDescription>Update the published event details. Registered participants and attendance are kept.</DialogDescription></DialogHeader>
    <form onSubmit={save} className="space-y-4">
      <label className="block">Event title<Input required maxLength={150} value={form.title} onChange={e => field("title", e.target.value)} /></label>
      <label className="block">Barangay<select required value={form.barangay} onChange={e => field("barangay", e.target.value)} className="mt-1 w-full rounded-lg border p-2">{[...STAFF_BARANGAYS, "All Barangays"].map(name => <option key={name}>{name}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-3"><label>Start time<Input required type="time" min={bounds.minTime} value={form.startTime} onChange={e => field("startTime", e.target.value)} /></label><label>End time<Input type="time" min={form.startTime || bounds.minTime} value={form.endTime} onChange={e => field("endTime", e.target.value)} /></label><label>Date<Input required type="date" min={bounds.minDate} value={form.dateISO} onChange={e => field("dateISO", e.target.value)} /></label></div>
      <p className="text-xs text-muted-foreground">Choose a future start in Philippine time. The end must be later on the same date.</p>
      {dateTimeError && <p role="alert" className="text-red-700">{dateTimeError}</p>}
      <label className="block">Location<Input maxLength={240} value={form.location} onChange={e => field("location", e.target.value)} /></label>
      <label className="block">Category<select aria-label="Event category" required value={form.category} onChange={e => field("category", e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border p-2">{!(EVENT_CATEGORIES as readonly string[]).includes(form.category) && <option value={form.category}>{form.category} (existing)</option>}{EVENT_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
      <label className="block">Description<textarea className="mt-1 w-full rounded-lg border p-3" rows={4} maxLength={5000} value={form.description} onChange={e => field("description", e.target.value)} /></label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save event"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
