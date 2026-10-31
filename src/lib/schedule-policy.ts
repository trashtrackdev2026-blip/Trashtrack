import { StaffAccessError } from "./staff-access.ts";

export const COLLECTION_STATUSES = ["Active", "Completed", "Unfinished", "Failed", "Inactive"] as const;
export type CollectionStatus = typeof COLLECTION_STATUSES[number];

export function collectionStatus(value: unknown): CollectionStatus | null {
  return COLLECTION_STATUSES.find(status => status.toLowerCase() === String(value).trim().toLowerCase()) || null;
}

// A collection occupies its barangay's date, even when a different start time
// is entered. Failed/cancelled collections can be replaced without a future cap.
export function assertCollectionAvailable(
  proposed: { date: string; barangay: string },
  existing: { date?: unknown; barangay?: unknown; status?: unknown }[],
) {
  const conflict = existing.some(schedule => schedule.date === proposed.date
    && !["Failed", "Inactive"].includes(collectionStatus(schedule.status) || "Active")
    && (String(schedule.barangay).toLowerCase() === "all barangays"
      || proposed.barangay === "All Barangays" || schedule.barangay === proposed.barangay));
  if (conflict) throw new StaffAccessError("A collection already occupies this barangay and date. Open the existing schedule, or choose another date. Changing the start time does not create a separate collection.", 409);
}

export function collectionStatusUpdate(body: Record<string, unknown>) {
  const status = collectionStatus(body.status);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!status || notes.length > 2000) throw new StaffAccessError("Choose a valid collection status and notes up to 2,000 characters.", 400);
  if (["Failed", "Unfinished"].includes(status) && !notes) throw new StaffAccessError("Explain why this collection failed or remains unfinished.", 400);
  return { status, statusNotes: notes };
}
