import { StaffAccessError } from "./staff-access.ts";

// Scheduling always uses the municipality's clock, including on servers in UTC
// and browsers whose device timezone is different.
export function manilaDateTime(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

export function schedulingBounds(date: string, now = Date.now()) {
  const next = manilaDateTime(Math.floor(now / 60_000) * 60_000 + 60_000);
  return { minDate: next.date, minTime: date === next.date ? next.time : undefined };
}

export function schedulingError(date: string, time: string, now = Date.now(), incomplete = false): string | null {
  if (!date && incomplete && !time) return null;
  if (!date && incomplete) return "Choose a date for the entered start time.";
  const day = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.valueOf()) || day.toISOString().slice(0, 10) !== date) return "Choose a valid scheduling date.";
  if (date < manilaDateTime(now).date) return "Past dates cannot be scheduled. Choose today or a future date (Philippine time).";
  if (!time && incomplete) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return "Choose a valid start time, including AM or PM.";
  if (Date.parse(`${date}T${time}:00+08:00`) <= now) return "That start time has already passed. Choose a later time (Philippine time).";
  return null;
}

export function assertFutureSchedule(date: string, time: string, now = Date.now(), incomplete = false) {
  const error = schedulingError(date, time, now, incomplete);
  if (error) throw new StaffAccessError(error, 400);
}
