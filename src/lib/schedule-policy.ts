import { StaffAccessError } from "./staff-access.ts";

export const COLLECTION_STATUSES = ["Active", "Completed", "Unfinished", "Failed"] as const;
export type CollectionStatus = typeof COLLECTION_STATUSES[number] | "Inactive";

export function collectionStatus(value: unknown): CollectionStatus | null {
  return [...COLLECTION_STATUSES, "Inactive" as const].find(status => status.toLowerCase() === String(value).trim().toLowerCase()) || null;
}

export function assertCollectionEditable(current: { status?: unknown }) {
  if (collectionStatus(current.status) === "Completed") throw new StaffAccessError("Completed collections are locked and remain available for reference.", 409);
}

// A collection occupies its barangay's date, even when a different start time
// is entered. Failed/cancelled collections can be replaced without a future cap.
export type TruckAssignment = { truckId: string; endTime: string };
type ScheduleSlot = { date?: unknown; barangay?: unknown; status?: unknown; truckId?: unknown; time?: unknown; endTime?: unknown };
const clockTime = /^([01]\d|2[0-3]):[0-5]\d$/;

export function collectionTruckError(time: string, truckId: string, endTime: string) {
  if (!truckId) return null;
  if (!clockTime.test(endTime) || endTime <= time) return "Set a truck end time after the start time on the same day.";
  return null;
}

export function collectionTruckFields(body: Record<string, unknown>, time: string): TruckAssignment {
  const { truckId = "", endTime = "" } = body;
  if (typeof truckId !== "string" || (truckId && !/^[\w-]{1,128}$/.test(truckId)) || typeof endTime !== "string") {
    throw new StaffAccessError("Choose a valid collection truck and end time.", 400);
  }
  const issue = collectionTruckError(time, truckId, endTime);
  if (issue) throw new StaffAccessError(issue, 400);
  return { truckId, endTime: truckId ? endTime : "" };
}

export function collectionTruckName(truck: Record<string, unknown> | undefined, allowUnavailable = false) {
  if (typeof truck?.name !== "string" || (!allowUnavailable && truck.available !== true)) {
    throw new StaffAccessError("This truck is unavailable. Choose another truck or leave the collection unassigned.", 409);
  }
  return truck.name;
}

export function assertCollectionAvailable(
  proposed: ScheduleSlot & { date: string; barangay: string },
  existing: ScheduleSlot[],
) {
  const occupied = existing.filter(schedule => schedule.date === proposed.date
    && !["Failed", "Inactive"].includes(collectionStatus(schedule.status) || "Active"));
  const conflict = occupied.some(schedule => String(schedule.barangay).toLowerCase() === "all barangays"
      || proposed.barangay === "All Barangays" || schedule.barangay === proposed.barangay);
  if (conflict) throw new StaffAccessError("A collection already occupies this barangay and date. Open the existing schedule, or choose another date. Changing the start time does not create a separate collection.", 409);
  if (!proposed.truckId) return;
  const start = String(proposed.time);
  const end = String(proposed.endTime);
  if (!clockTime.test(start) || !clockTime.test(end) || end <= start) {
    throw new StaffAccessError("Set a valid start and end time for the assigned truck.", 400);
  }
  const overlapping = occupied.some(schedule => {
    if (schedule.truckId !== proposed.truckId) return false;
    const savedStart = String(schedule.time);
    const savedEnd = String(schedule.endTime);
    return !clockTime.test(savedStart) || !clockTime.test(savedEnd) || savedEnd <= savedStart
      || (start < savedEnd && savedStart < end);
  });
  if (overlapping) throw new StaffAccessError("This truck is already assigned during that time. Choose a different truck or move the collection time.", 409);
}

export function collectionStatusUpdate(body: Record<string, unknown>) {
  const status = collectionStatus(body.status);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!status || status === "Inactive" || notes.length > 2000) throw new StaffAccessError("Choose Active, Completed, Unfinished or Failed, and notes up to 2,000 characters. Inactive is retained only on historical records.", 400);
  if (["Failed", "Unfinished"].includes(status) && !notes) throw new StaffAccessError("Explain why this collection failed or remains unfinished.", 400);
  return { status, statusNotes: notes };
}
