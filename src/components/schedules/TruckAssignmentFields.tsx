"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { staffRequest } from "@/lib/staff-client";

export type CollectionTruck = { id: string; name: string; available: boolean };

export function useCollectionTrucks() {
  const [result, setResult] = useState<{ trucks: CollectionTruck[]; error: string } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let disposed = false;
    void staffRequest<{ trucks: CollectionTruck[] }>("/api/schedules/trucks")
      .then(({ trucks }) => { if (!disposed) setResult({ trucks, error: "" }); })
      .catch(() => { if (!disposed) setResult({ trucks: [], error: "Trucks could not be loaded. Retry to see available vehicles." }); });
    return () => { disposed = true; };
  }, [revision]);
  const reload = () => { setResult(null); setRevision(value => value + 1); };
  return { trucks: result?.trucks || [], error: result?.error || "", loading: !result, reload };
}

const field = "mt-2 min-h-11 w-full rounded-lg border bg-[#fffef8] px-3";

export function TruckAssignmentFields({
  fleet, truckId, truckName, endTime, truckError, onTruckChange, onEndTimeChange,
}: {
  fleet: ReturnType<typeof useCollectionTrucks>;
  truckId: string;
  truckName: string;
  endTime: string;
  truckError: string | null;
  onTruckChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
}) {
  const available = fleet.trucks.filter(truck => truck.available);
  return <section className="space-y-4 rounded-xl border border-[#ccd9c7] bg-[#edf2e5] p-4" aria-label="Truck assignment">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-semibold"><Truck className="h-5 w-5" aria-hidden="true" />Truck assignment</h3>
      <Link href="/schedules/trucks" target="_blank" className="tt-text-link text-sm">Manage trucks</Link>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Collection truck
        <select className={field} value={truckId} onChange={event => onTruckChange(event.target.value)}>
          <option value="">Leave unassigned</option>
          {truckId && !available.some(truck => truck.id === truckId) && <option value={truckId}>{truckName || "Current assignment"}</option>}
          {available.map(truck => <option key={truck.id} value={truck.id}>{truck.name}</option>)}
        </select>
      </label>
      {truckId && <label className="text-sm font-medium">Truck end time
        <input className={field} type="time" required value={endTime} onChange={event => onEndTimeChange(event.target.value)} aria-invalid={!!endTime && !!truckError} />
      </label>}
    </div>
    {fleet.loading && <p role="status" className="text-xs text-muted-foreground">Loading available trucks…</p>}
    {fleet.error && <p role="alert" className="text-xs">{fleet.error} <button type="button" onClick={fleet.reload} className="underline">Retry</button></p>}
    {!fleet.loading && !fleet.error && !available.length && <p className="text-xs text-muted-foreground">No trucks are available. Add or reactivate a truck in Manage trucks, then <button type="button" onClick={fleet.reload} className="underline">reload the list</button>.</p>}
    {!!endTime && truckError && <p role="alert" className="text-sm text-red-800">{truckError}</p>}
  </section>;
}
