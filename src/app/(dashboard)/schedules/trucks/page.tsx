"use client";

import { useState } from "react";
import { Truck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCollectionTrucks } from "@/components/schedules/TruckAssignmentFields";
import { staffRequest } from "@/lib/staff-client";

export default function CollectionTrucksPage() {
  const fleet = useCollectionTrucks();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function save(action: Record<string, unknown>, success: string) {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await staffRequest("/api/schedules/trucks", action);
      if (action.action === "add") setName("");
      fleet.reload();
      setMessage(success);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the truck. Try again.");
    } finally { setSaving(false); }
  }

  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
    <section className="tt-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-6">
        <div><h2>Fleet roster</h2><p className="mt-1 text-sm text-muted-foreground">An available truck can be assigned when planning a collection.</p></div>
        {!fleet.loading && !fleet.error && <span className="tt-status">{fleet.trucks.filter(truck => truck.available).length} available</span>}
      </div>
      {message && <p role="status" className="px-6 pt-4 text-sm">{message}</p>}
      {error && <p role="alert" className="px-6 pt-4 text-sm text-red-800">{error}</p>}
      {fleet.loading && <p role="status" className="p-6 text-sm">Loading fleet…</p>}
      {fleet.error && <div className="flex flex-wrap items-center gap-3 p-6"><p role="alert" className="text-sm">{fleet.error}</p><Button variant="outline" onClick={fleet.reload}>Retry</Button></div>}
      {!fleet.loading && !fleet.error && !fleet.trucks.length && <p className="tt-empty">Add your first collection truck to start assigning vehicles.</p>}
      <ul className="divide-y">
        {fleet.trucks.map(truck => <li key={truck.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e6eddf]"><Truck className="size-5" aria-hidden="true" /></span><div className="min-w-0"><p className="break-words font-semibold">{truck.name}</p><p className="text-xs text-muted-foreground">{truck.available ? "Available" : "Unavailable"}</p></div></div>
          <Button variant="outline" disabled={saving} onClick={() => void save({ action: "availability", id: truck.id, available: !truck.available }, truck.available ? "Truck marked unavailable for new assignments." : "Truck is available for assignment.")}>{truck.available ? "Mark unavailable" : "Make available"}</Button>
        </li>)}
      </ul>
    </section>
    <form className="tt-surface space-y-4 p-6" onSubmit={event => { event.preventDefault(); void save({ action: "add", name }, "Truck added to the fleet."); }}>
      <h2>Add a truck</h2>
      <label className="block space-y-2 text-sm font-semibold">Truck name or fleet number
        <Input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Collection Truck 01" required maxLength={60} disabled={saving} />
      </label>
      <Button type="submit" disabled={saving || !name.trim()}><Plus aria-hidden="true" />Add truck</Button>
      <p className="text-xs text-muted-foreground">Existing bookings stay on the calendar when a truck becomes unavailable. Review those schedules and reassign them as needed.</p>
    </form>
  </div>;
}
