"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eventDate } from "@/lib/certificate-data";
import { eventRequest } from "@/lib/event-client";

type CertificateEvent = {
  id: string; title: string; date: string; dateISO?: string;
  certificateEnabled?: boolean; certificateSignatory?: string;
  certificatePosition?: string; certificateOrganizer?: string;
};

export function EventCertificateSettings({ event, onPreview }: {
  event: CertificateEvent; onPreview: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(() => {
    let dateISO = "";
    try { dateISO = eventDate({ dateISO: event.dateISO, date: event.date }).iso; } catch { dateISO = ""; }
    return {
      certificateEnabled: event.certificateEnabled !== false,
      certificateSignatory: event.certificateSignatory || "",
      certificatePosition: event.certificatePosition || "Lead Trainer",
      certificateOrganizer: event.certificateOrganizer || "Municipal Environment and Natural Resources Office (MENRO)",
      dateISO,
    };
  });
  const [saving, setSaving] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try { await eventRequest("/api/events/manage", { action: "certificateSettings", eventId: event.id, ...form }); setSaved(true); }
    catch (error) { setError(error instanceof Error ? error.message : "Certificate settings could not be saved."); }
    finally { setSaving(false); }
  }
  return <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
    <h5 className="font-bold text-sm text-slate-800">Certificate details</h5>
    <label className="flex items-center gap-2 text-xs font-semibold">
      <input type="checkbox" checked={form.certificateEnabled} onChange={e => setForm({ ...form, certificateEnabled: e.target.checked })} />
      Enable certificates for confirmed attendees
    </label>
    <label className="block text-xs">Event date
      <Input type="date" value={form.dateISO} onChange={e => setForm({ ...form, dateISO: e.target.value })} className="mt-1" />
    </label>
    <label className="block text-xs">Signatory name
      <Input value={form.certificateSignatory} maxLength={100} onChange={e => setForm({ ...form, certificateSignatory: e.target.value })} className="mt-1" placeholder="Organizer's full name" />
    </label>
    <label className="block text-xs">Signatory position
      <Input value={form.certificatePosition} maxLength={100} onChange={e => setForm({ ...form, certificatePosition: e.target.value })} className="mt-1" />
    </label>
    <label className="block text-xs">Organizing office
      <Input value={form.certificateOrganizer} maxLength={160} onChange={e => setForm({ ...form, certificateOrganizer: e.target.value })} className="mt-1" />
    </label>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save details"}</Button>
      <Button size="sm" variant="outline" disabled={!form.certificateEnabled} onClick={() => onPreview({ title: event.title, ...form })}>Preview certificate</Button>
    </div>
    <p className="text-[11px] text-slate-600">The certificate uses the event date. Existing issued certificates keep their original details.</p>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {saved && <p role="status" className="text-xs text-green-800">Certificate details saved.</p>}
  </div>;
}
