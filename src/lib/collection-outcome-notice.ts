import { STAFF_BARANGAYS, StaffAccessError } from "./staff-access.ts";
import { collectionTimeLabel } from "./collection-calendar.ts";
import type { CollectionStatus } from "./schedule-policy.ts";

export function collectionOutcomeNotice(current: Record<string, unknown>, status: CollectionStatus, notes: string) {
  const recipients = String(current.barangay || "").trim();
  if (recipients !== "All Barangays" && !(STAFF_BARANGAYS as readonly string[]).includes(recipients)) throw new StaffAccessError("This collection has no valid barangay audience. Correct its barangay before notifying residents.", 400);
  const date = typeof current.date === "string" && current.date ? current.date : String(current.day || "posted collection day");
  const time = typeof current.time === "string" && current.time ? ` at ${collectionTimeLabel(current.time)}` : "";
  const prefix = `The ${recipients} collection on ${date}${time} is now ${status.toLowerCase()}.`;
  const suffix = " Open the collection schedule in TrashTrack for details.";
  const remaining = 500 - prefix.length - suffix.length - 1;
  const detail = notes.length > remaining ? notes.slice(0, remaining - 1) + "…" : notes;
  return { title: `Collection ${status.toLowerCase()} · ${recipients}`, message: prefix + (detail ? " " + detail : "") + suffix,
    type: "schedule", recipients };
}
