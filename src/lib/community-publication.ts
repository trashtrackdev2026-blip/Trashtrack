import { STAFF_BARANGAYS, StaffAccessError } from "./staff-access.ts";
import { eventDate } from "./certificate-data.ts";
import { eventFormFields } from "./event-form.ts";

export function communityPublication(kind: unknown, body: Record<string, unknown>) {
  if (kind !== "schedule" && kind !== "event") throw new StaffAccessError("Choose a schedule or event.", 400);
  const barangay = typeof body.barangay === "string" ? body.barangay.trim() : "";
  if (!(STAFF_BARANGAYS as readonly string[]).includes(barangay) && barangay !== "All Barangays") throw new StaffAccessError("Select a valid Balete barangay.", 400);
  const text = (key: string, max: number) => typeof body[key] === "string" ? body[key].trim().slice(0, max) : "";
  if (kind === "schedule") {
    const date = text("date", 10), time = text("time", 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(Date.parse(date + "T" + time + ":00+08:00"))) throw new StaffAccessError("Enter a valid collection date and time.", 400);
    eventDate({ dateISO: date });
    const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Manila" }).format(new Date(date + "T12:00:00+08:00"));
    return { post: { barangay, date, day, time, status: "Active", description: text("description", 2000) },
      announcement: { title: "Collection schedule · " + barangay, message: `Waste collection for ${barangay} is scheduled on ${date} at ${time}. Check the full schedule in TrashTrack.`, type: "schedule", recipients: barangay } };
  }
  const fields = eventFormFields(body);
  return { post: { ...fields,participants:0,status:"Upcoming" },
    announcement: { title: "New event · " + fields.title.slice(0, 80), message: `${fields.title.slice(0,150)} on ${fields.date} at ${fields.startTime}. Open Events in TrashTrack for details.`, type:"event",recipients:barangay } };
}
