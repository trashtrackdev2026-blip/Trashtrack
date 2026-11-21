"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Save, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCollectionTrucks } from "@/components/schedules/TruckAssignmentFields";
import { TRUCK_DETAIL_LIMITS, type CollectionTruck } from "@/lib/collection-trucks";
import { staffRequest } from "@/lib/staff-client";
import { ApiResponseError } from "@/lib/api-response";

type SaveTruck = (body: Record<string, unknown>, success: string) => Promise<void>;

function TruckForm({ truck, saving, save, onClose }: {
  truck?: CollectionTruck;
  saving: boolean;
  save: SaveTruck;
  onClose?: () => void;
}) {
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const capacity = values.get("capacityKg");
    const details = {
      name: values.get("name"),
      plateNumber: values.get("plateNumber"),
      vehicleType: values.get("vehicleType"),
      makeModel: values.get("makeModel"),
      capacityKg: capacity ? Number(capacity) : null,
      notes: values.get("notes"),
    };
    try {
      if (truck) {
        await save({ action: "edit", id: truck.id, expectedRevision: truck.detailsRevision, ...details }, "Truck details saved.");
        onClose?.();
      } else {
        await save({ action: "add", available: values.has("available"), ...details }, "Truck added to the fleet.");
        form.reset();
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the truck. Try again.");
    }
  }

  return <form onSubmit={submit} className="space-y-4">
    <fieldset disabled={saving} className="space-y-4">
      <label className="block space-y-2 text-sm font-semibold">
        Truck name or fleet number <span className="text-xs font-normal text-muted-foreground">(required)</span>
        <Input name="name" defaultValue={truck?.name} placeholder="e.g. Collection Truck 01" required maxLength={TRUCK_DETAIL_LIMITS.name} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-semibold">
          Plate number
          <Input name="plateNumber" className="uppercase placeholder:normal-case" defaultValue={truck?.plateNumber} placeholder="e.g. ABC 1234" maxLength={TRUCK_DETAIL_LIMITS.plateNumber} />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          Vehicle type
          <Input name="vehicleType" defaultValue={truck?.vehicleType} placeholder="e.g. Dump truck" maxLength={TRUCK_DETAIL_LIMITS.vehicleType} />
        </label>
      </div>
      <label className="block space-y-2 text-sm font-semibold">
        Make and model
        <Input name="makeModel" defaultValue={truck?.makeModel} placeholder="e.g. Isuzu N-Series" maxLength={TRUCK_DETAIL_LIMITS.makeModel} />
      </label>
      <label className="block space-y-2 text-sm font-semibold">
        Payload capacity (kg)
        <Input name="capacityKg" type="number" inputMode="numeric" min={1} step={1} defaultValue={truck?.capacityKg ?? ""} placeholder="e.g. 3000" />
      </label>
      <label className="block space-y-2 text-sm font-semibold">
        Fleet notes
        <textarea name="notes" defaultValue={truck?.notes} rows={3} maxLength={TRUCK_DETAIL_LIMITS.notes} placeholder="e.g. Assigned to narrow-road routes"
          className="block w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal focus-visible:outline-2 focus-visible:outline-ring" />
      </label>
      {!truck && <label className="flex items-center gap-3 rounded-xl border bg-[#edf2e5] p-3 text-sm font-semibold">
        <input type="checkbox" name="available" defaultChecked className="size-4 shrink-0 accent-[#1b513d]" />
        Available for scheduling
      </label>}
    </fieldset>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      {onClose && <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>}
      <Button type="submit" size="lg" disabled={saving} className={truck ? undefined : "w-full"}>
        {truck ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {saving ? "Saving…" : truck ? "Save details" : "Add truck"}
      </Button>
    </div>
  </form>;
}

export default function CollectionTrucksPage() {
  const fleet = useCollectionTrucks();
  const [editing, setEditing] = useState<CollectionTruck | null>(null);
  const [saving, setSaving] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [message, setMessage] = useState("");

  const save: SaveTruck = async (body, success) => {
    setSaving(true);
    setRosterError("");
    setMessage("");
    try {
      await staffRequest("/api/schedules/trucks", body);
      fleet.reload();
      setMessage(success);
    } catch (failure) {
      if (failure instanceof ApiResponseError && failure.status === 409) fleet.reload();
      throw failure;
    } finally { setSaving(false); }
  };

  async function toggleAvailability(truck: CollectionTruck) {
    try {
      await save({ action: "availability", id: truck.id, available: !truck.available },
        truck.available ? "Truck marked unavailable for new assignments." : "Truck is available for assignment.");
    } catch (failure) {
      setRosterError(failure instanceof Error ? failure.message : "Could not update truck availability.");
    }
  }

  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(370px,420px)]">
    <section className="tt-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-6">
        <div><h2>Fleet roster</h2><p className="mt-1 text-sm text-muted-foreground">Available trucks can be assigned to collection schedules.</p></div>
        {!fleet.loading && !fleet.error && <span className="tt-status">{fleet.trucks.filter(truck => truck.available).length} available</span>}
      </div>
      {message && <p role="status" className="px-6 pt-4 text-sm">{message}</p>}
      {rosterError && <p role="alert" className="px-6 pt-4 text-sm text-red-800">{rosterError}</p>}
      {fleet.loading && <p role="status" className="p-6 text-sm">Loading fleet…</p>}
      {fleet.error && <div className="flex flex-wrap items-center gap-3 p-6"><p role="alert" className="text-sm">{fleet.error}</p><Button variant="outline" onClick={fleet.reload}>Retry</Button></div>}
      {!fleet.loading && !fleet.error && !fleet.trucks.length && <p className="tt-empty">Add your first truck to start assigning vehicles.</p>}
      <ul className="divide-y">
        {fleet.trucks.map(truck => {
          const specifications = [
            { label: "Plate number", value: truck.plateNumber },
            { label: "Vehicle type", value: truck.vehicleType },
            { label: "Make and model", value: truck.makeModel },
            { label: "Payload capacity", value: truck.capacityKg ? `${truck.capacityKg.toLocaleString("en-PH")} kg` : "" },
          ].filter(item => item.value);
          return <li key={truck.id} className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#d9e8d2] text-[#1b513d]"><Truck className="size-5" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <h3 className="break-words font-semibold">{truck.name}</h3>
                  <span className={truck.available ? "tt-status" : "tt-status tt-status-pending"}>{truck.available ? "Available" : "Unavailable"}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" type="button" disabled={saving} onClick={() => setEditing(truck)} aria-label={`Edit details for ${truck.name}`}><Pencil aria-hidden="true" />Edit details</Button>
                <Button variant="outline" type="button" disabled={saving} onClick={() => void toggleAvailability(truck)}>{truck.available ? "Mark unavailable" : "Make available"}</Button>
              </div>
            </div>
            {specifications.length > 0 && <dl className="grid gap-x-4 gap-y-3 rounded-xl border bg-[#edf2e5] p-4 text-sm sm:grid-cols-2">
              {specifications.map(item => <div key={item.label} className="min-w-0"><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="mt-1 break-words font-semibold">{item.value}</dd></div>)}
            </dl>}
            {truck.notes && <div className="text-sm"><p className="font-semibold">Fleet notes</p><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{truck.notes}</p></div>}
          </li>;
        })}
      </ul>
    </section>
    <section className="tt-surface space-y-4 p-6" aria-labelledby="add-truck">
      <h2 id="add-truck">Add a truck</h2>
      <TruckForm saving={saving} save={save} />
    </section>
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !saving) setEditing(null); }}>
      {editing && <DialogContent className="tt-themed-dialog sm:max-w-xl" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>Edit truck details</DialogTitle>
          <DialogDescription>{editing.name}</DialogDescription>
        </DialogHeader>
        <TruckForm key={editing.id} truck={editing} saving={saving} save={save} onClose={() => setEditing(null)} />
      </DialogContent>}
    </Dialog>
  </div>;
}
