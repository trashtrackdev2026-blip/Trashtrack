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
  const noteLabel = notes ? " Outcome notes: " : "";
  const remaining = 500 - prefix.length - suffix.length - noteLabel.length;
  const detail = notes.length > remaining ? notes.slice(0, remaining - 1) + "…" : notes;
  return { title: `Collection ${status.toLowerCase()} · ${recipients}`, message: prefix + noteLabel + detail + suffix,
    outcomeStatus:status, outcomeNotes:notes, type: "schedule", recipients };
}

/** Use the same resident-facing clock for creation, edits, cancellation and follow-ups. */
export function collectionChangeMessage(action:string, current:Record<string,unknown>, next:Record<string,unknown>|null) {
  const old=`${current.barangay}, ${current.date || current.day} at ${collectionTimeLabel(String(current.time || ""))}`;
  const prefix=action==="delete" ? `Collection cancelled: ${old}.`
    : `${action==="followup"?"Follow-up collection":"Collection schedule updated"}: ${next!.barangay}, ${next!.date} at ${collectionTimeLabel(String(next!.time))}. Previous schedule: ${old}.`;
  const notes=String(current.statusNotes || "").trim();
  const label=notes ? ` Previous outcome: ${current.status}. Outcome notes: ` : "";
  const suffix=" Open TrashTrack for details.";
  const remaining=Math.max(0,500-prefix.length-label.length-suffix.length);
  return prefix+label+(notes.length>remaining ? notes.slice(0,Math.max(0,remaining-1))+"…" : notes)+suffix;
}
