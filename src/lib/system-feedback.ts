import { STAFF_BARANGAYS, StaffAccessError } from "./staff-access.ts";

export const FEEDBACK_CATEGORIES = ["Bug", "Suggestion", "Other"] as const;
export const FEEDBACK_STATUSES = ["New", "Reviewed", "Closed"] as const;

export function feedbackFields(body: Record<string, unknown>, profile: Record<string, unknown>) {
  if (String(profile.role).toLowerCase() !== "resident" || ["suspended", "disabled"].includes(String(profile.accessStatus)) || !(STAFF_BARANGAYS as readonly unknown[]).includes(profile.barangay)) throw new StaffAccessError("Use an active resident account to send feedback.");
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!/^[\w-]{8,80}$/.test(String(body.submissionId || ""))) throw new StaffAccessError("Start a new feedback message before sending.", 400);
  if (message.length < 20 || message.length > 2000) throw new StaffAccessError("Describe your feedback in 20 to 2,000 characters.", 400);
  if (!(FEEDBACK_CATEGORIES as readonly unknown[]).includes(body.category)) throw new StaffAccessError("Choose Bug, Suggestion or Other.", 400);
  return { message, category: String(body.category), residentName: String(profile.name || "Resident").slice(0,120), barangay: String(profile.barangay), appVersion: typeof body.appVersion === "string" ? body.appVersion.slice(0,40) : "", status:"New", revision:0 };
}

export function feedbackThrottle(current: {windowStart?:number;count?:number;lastSentAt?:number}, now: number) {
  const activeWindow = now - (current.windowStart || 0) < 3_600_000;
  if (now - (current.lastSentAt || 0) < 60_000 || (activeWindow && Number(current.count || 0) >= 5)) throw new StaffAccessError("Your previous feedback is saved. Wait before sending another message.", 429);
  return { windowStart: activeWindow ? current.windowStart! : now, count: activeWindow ? Number(current.count || 0) + 1 : 1, lastSentAt: now };
}
