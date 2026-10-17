import { STAFF_BARANGAYS, StaffAccessError } from "./staff-access.ts";
import { certificateSettings, eventDate } from "./certificate-data.ts";

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
  const title = text("title", 150), start = text("startTime", 5), end = text("endTime", 5);
  if (!title || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || (end && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start))) throw new StaffAccessError("Enter an event title and valid start/end times.", 400);
  const date = eventDate({ dateISO: body.dateISO });
  const settings = body.certificateEnabled === false ? { certificateEnabled: false, certificateSignatory: text("certificateSignatory", 100), certificatePosition: text("certificatePosition", 100), certificateOrganizer: text("certificateOrganizer", 160) } : certificateSettings(body);
  return { post: { title, barangay, date: date.display, dateISO: date.iso, time: `${start} - ${end || "TBD"}`, startTime: start, endTime: end,
    location: text("location", 240), description: text("description", 5000), category: text("category", 80), img: text("img", 2000),
    participants: 0, status: "Upcoming", attendanceMethod: body.attendanceMethod === "manual" ? "manual" : "qr", ...settings },
    announcement: { title: "New event · " + title.slice(0, 80), message: `${title.slice(0, 150)} on ${date.display} at ${start}. Open Events in TrashTrack for details.`, type: "event", recipients: barangay } };
}
