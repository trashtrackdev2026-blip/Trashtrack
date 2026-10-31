import { StaffAccessError, STAFF_BARANGAYS } from "./staff-access.ts";
import { certificateSettings, eventDate } from "./certificate-data.ts";

export function normalizedEventTime(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(raw);
  if (!match) return "";
  let hour = Number(match[1]);
  if (match[3]) {
    if (hour < 1 || hour > 12) return "";
    hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  }
  return hour <= 23 && Number(match[2]) <= 59 ? `${String(hour).padStart(2,"0")}:${match[2]}` : "";
}

export function eventFormFields(body: Record<string, unknown>, draft = false) {
  const text = (name: string, max: number) => typeof body[name] === "string" ? body[name].trim().slice(0,max) : "";
  const title = text("title",150), barangay = text("barangay",80);
  if (!title) throw new StaffAccessError("Enter the event title before saving.",400);
  if (!(STAFF_BARANGAYS as readonly string[]).includes(barangay) && barangay !== "All Barangays") throw new StaffAccessError("Select the event barangay.",400);
  const startTime = normalizedEventTime(body.startTime), endTime = normalizedEventTime(body.endTime);
  if (!draft && !startTime) throw new StaffAccessError("Choose a valid event start time, including AM or PM.",400);
  if (!draft && String(body.endTime || "").trim() && !endTime) throw new StaffAccessError("Choose a valid event end time, including AM or PM.",400);
  if (!draft && endTime && endTime <= startTime) throw new StaffAccessError("The end time must be later than the start time on the event date. Check AM and PM.",400);
  const date = draft && !body.dateISO ? {iso:"",display:""} : eventDate({dateISO:body.dateISO});
  const settings = draft || body.certificateEnabled === false ? {
    certificateEnabled:body.certificateEnabled !== false, certificateSignatory:text("certificateSignatory",100),
    certificatePosition:text("certificatePosition",100), certificateOrganizer:text("certificateOrganizer",160),
  } : certificateSettings(body);
  return {title,barangay,date:date.display,dateISO:date.iso,startTime,endTime,time:startTime ? `${startTime} - ${endTime || "TBD"}` : "",
    description:text("description",5000),location:text("location",240),category:text("category",80),img:text("img",2000),
    attendanceMethod:body.attendanceMethod === "manual" ? "manual" : "qr",...settings};
}
