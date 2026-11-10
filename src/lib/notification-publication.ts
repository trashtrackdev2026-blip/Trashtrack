import { BALETE_BARANGAYS } from "./barangay-geofence.ts";
import { StaffAccessError } from "./staff-access.ts";
import { manilaDateTime } from "./scheduling-time.ts";

export function announcementExpired(endDate: unknown, now = Date.now()): boolean {
  return typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate < manilaDateTime(now).date;
}

export function notificationPublication(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const recipients = typeof body.recipients === "string" ? body.recipients.trim() : "";
  if (!title || title.length > 100 || !message || message.length > 500) throw new StaffAccessError("Enter a title (1–100 characters) and message (1–500 characters).", 400);
  if (recipients !== "All Barangays" && !(BALETE_BARANGAYS as readonly string[]).includes(recipients)) throw new StaffAccessError("Select a valid Balete barangay.", 400);
  if (!["schedule", "alert", "event", "general"].includes(String(body.type)) || typeof body.push !== "boolean") throw new StaffAccessError("Choose a notification category and phone delivery setting.", 400);
  const endDate = body.endDate ?? "";
  if (endDate !== "") {
    const date = typeof endDate === "string" ? new Date(`${endDate}T00:00:00Z`) : new Date(NaN);
    if (typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== endDate) {
      throw new StaffAccessError("Choose a valid announcement end date.", 400);
    }
  }
  return { title, message, recipients, type: String(body.type), push: body.push, ...(endDate ? { endDate } : {}) };
}

export function phoneDeliveryDue(notice: {
  push: boolean; pushStatus: string; createdAtMillis?: number; pushStartedAtMillis?: number;
  pushNextRetryAt?: number; pushRetryable?: boolean;
}, now = Date.now()): boolean {
  if (!notice.push || notice.pushStatus === "queued" || notice.pushRetryable === false) return false;
  if (notice.pushStatus === "sending") return now - (notice.pushStartedAtMillis ?? now) >= 5 * 60_000;
  if (notice.pushStatus === "pending") return now - (notice.createdAtMillis ?? now) >= 30_000;
  return notice.pushStatus === "failed" && now >= (notice.pushNextRetryAt ?? 0);
}
