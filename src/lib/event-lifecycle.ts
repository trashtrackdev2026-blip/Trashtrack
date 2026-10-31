import { eventDate } from "./certificate-data.ts";

export function eventRegistrationClosed(event: Record<string, unknown>, now = Date.now()) {
  if (["draft", "completed", "complete", "finished", "archived", "cancelled", "canceled"].includes(String(event.status).trim().toLowerCase())) return true;
  try {
    const date = eventDate(event).iso;
    const times = String(event.time || "").match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g) || [];
    const end = typeof event.endTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(event.endTime) ? event.endTime : times.length >= 2 ? times.at(-1)! : "23:59";
    return Date.parse(date + "T" + end.padStart(5, "0") + ":00+08:00") < now;
  } catch { return false; }
}
