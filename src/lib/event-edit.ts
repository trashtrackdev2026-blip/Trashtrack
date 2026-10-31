import { communityPublication } from "./community-publication.ts";
import { StaffAccessError } from "./staff-access.ts";
import { eventDate } from "./certificate-data.ts";

export function eventEditorTime(value: string, index = 0): string {
  const match = [...value.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)?/gi)][index];
  if (!match) return index === 0 ? "08:00" : "";
  let hour = Number(match[1]);
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export function eventEditorDate(dateISO: string | undefined, date: string): string {
  try { return eventDate({ dateISO, date }).iso; } catch { return ""; }
}

export function eventEditFields(body: Record<string, unknown>, current: Record<string, unknown>) {
  if (String(current.status).toLowerCase() === "completed") throw new StaffAccessError("Completed events are kept unchanged for attendance and certificate records.", 409);
  const validated = communityPublication("event", { ...body, certificateEnabled: false }).post;
  if (!("title" in validated)) throw new StaffAccessError("Invalid event details.", 400);
  // Attendance, participant counts, status and certificate settings are never
  // overwritten by the general details form.
  const { title, barangay, date, dateISO, time, startTime, endTime, location, description, category } = validated;
  return { title, barangay, date, dateISO, time, startTime, endTime, location, description, category };
}
