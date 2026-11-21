import { StaffAccessError } from "./staff-access.ts";

export const TRUCK_DETAIL_LIMITS = { name: 60, plateNumber: 16, vehicleType: 50, makeModel: 100, notes: 600 } as const;

type TruckDetails = {
  name: string;
  plateNumber: string;
  vehicleType: string;
  makeModel: string;
  capacityKg: number | null;
  notes: string;
};

export type CollectionTruck = TruckDetails & { id: string; available: boolean; detailsRevision: number };

export function collectionTruckRecord(id: string, data: Record<string, unknown>): CollectionTruck {
  return {
    id,
    name: String(data.name || ""),
    available: data.available === true,
    plateNumber: typeof data.plateNumber === "string" ? data.plateNumber : "",
    vehicleType: typeof data.vehicleType === "string" ? data.vehicleType : "",
    makeModel: typeof data.makeModel === "string" ? data.makeModel : "",
    capacityKg: typeof data.capacityKg === "number" ? data.capacityKg : null,
    notes: typeof data.notes === "string" ? data.notes : "",
    detailsRevision: Number(data.detailsRevision || 0),
  };
}

export function collectionTruckDetails(body: Record<string, unknown>): TruckDetails {
  function text(field: keyof typeof TRUCK_DETAIL_LIMITS, label: string) {
    const raw = body[field] ?? "";
    const max = TRUCK_DETAIL_LIMITS[field];
    if (typeof raw !== "string" || raw.trim().length > max) throw new StaffAccessError(`Enter ${label} up to ${max} characters.`, 400);
    return raw.trim();
  }
  const name = text("name", "a truck name or fleet number").replace(/\s+/g, " ");
  if (!name) throw new StaffAccessError("Enter a truck name or fleet number.", 400);
  const plateNumber = text("plateNumber", "a plate number").replace(/ +/g, " ").toUpperCase();
  if (plateNumber && !/^[A-Z0-9][A-Z0-9 -]*$/.test(plateNumber)) throw new StaffAccessError("Use letters, numbers, spaces or hyphens for the plate number.", 400);
  const capacityKg = body.capacityKg ?? null;
  if (capacityKg !== null && (typeof capacityKg !== "number" || !Number.isSafeInteger(capacityKg) || capacityKg < 1)) {
    throw new StaffAccessError("Enter a payload capacity in whole kilograms.", 400);
  }
  return {
    name, plateNumber, capacityKg,
    vehicleType: text("vehicleType", "a vehicle type"),
    makeModel: text("makeModel", "a make and model"),
    notes: text("notes", "notes"),
  };
}

export function assertUniqueCollectionTruck(details: TruckDetails, roster: CollectionTruck[]) {
  const plateKey = (plate: string) => plate.toUpperCase().replace(/[ -]/g, "");
  if (roster.some(truck => truck.name.trim().replace(/\s+/g, " ").toLowerCase() === details.name.toLowerCase())) {
    throw new StaffAccessError("A truck with this name or fleet number is already registered.", 409);
  }
  if (details.plateNumber && roster.some(truck => plateKey(truck.plateNumber) === plateKey(details.plateNumber))) {
    throw new StaffAccessError("A truck with this plate number is already registered.", 409);
  }
}
