"use client";

import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { announcementExpired } from "@/lib/notification-publication";
import { manilaDateTime } from "@/lib/scheduling-time";
import { staffRequest } from "@/lib/staff-client";
import { useSchedulingClock } from "@/lib/use-scheduling-clock";

type EditableNotice = { id: string; title: string; message: string; type: string; revision?: number; endDate?: string };

export function EditNotificationDialog({ notice, onClose }: { notice: EditableNotice; onClose: () => void }) {
  const [form, setForm] = useState({ title: notice.title, message: notice.message, type: notice.type, endDate: notice.endDate || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [changeId, setChangeId] = useState(() => crypto.randomUUID());
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const now = useSchedulingClock();
  const expired = announcementExpired(notice.endDate, now);
  const disabled = saving || expired || !!deliveryMessage;

  function update(field: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [field]: value }));
    setChangeId(crypto.randomUUID());
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (disabled) return;
    setSaving(true);
    setError("");
    try {
      const result = await staffRequest<{ deliveryError?: string }>("/api/notifications/manage", {
        id: notice.id, changeId, expectedRevision: notice.revision || 0, ...form,
      });
      if (result.deliveryError) setDeliveryMessage("Changes saved and the resident update is visible. Phone delivery is pending. Retry it from Announcements.");
      else onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Notification could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="sm:max-w-lg" showCloseButton={!saving}>
      <DialogTitle>Edit notification</DialogTitle>
      <DialogDescription>Changes create a resident update for the original audience. Phone-enabled announcements also send an updated alert.</DialogDescription>
      <form onSubmit={save} className="space-y-4">
        <label className="block">Title<Input required maxLength={100} value={form.title} disabled={disabled} onChange={event => update("title", event.target.value)} /></label>
        <label className="block">Message<textarea required maxLength={500} rows={5} className="mt-2 w-full rounded-lg border p-3" value={form.message} disabled={disabled} onChange={event => update("message", event.target.value)} /></label>
        <label className="block">Category<select value={form.type} disabled={disabled} onChange={event => update("type", event.target.value)} className="mt-2 w-full rounded-lg border p-2">
          {["general", "schedule", "alert", "event", ...(notice.type === "report" ? ["report"] : [])].map(value => <option key={value}>{value}</option>)}
        </select></label>
        <label className="block">End date (optional)<Input type="date" className="mt-2" value={form.endDate} min={manilaDateTime(now).date} disabled={disabled} onChange={event => update("endDate", event.target.value)} />
          <span className="mt-2 block text-xs text-muted-foreground">Editing closes after this date in Philippine time.</span>
        </label>
        {expired && <p role="status" className="text-sm text-amber-900">This announcement has expired and can only be viewed.</p>}
        {deliveryMessage && <p role="status" className="text-sm text-green-800">{deliveryMessage}</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{deliveryMessage || expired ? "Close" : "Cancel"}</Button>
          <Button type="submit" disabled={disabled}>{saving ? "Saving…" : "Save notification"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
