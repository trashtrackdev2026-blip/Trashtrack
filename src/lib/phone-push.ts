import type { Message } from "firebase-admin/messaging";

export const ALL_RESIDENTS_TOPIC = "trashtrack_residents_v1";
export const PHONE_NOTIFICATION_CHANNEL = "trashtrack_updates";

export function buildPhonePush(id: string, data: Record<string, unknown>, barangays: readonly string[]): Message {
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const body = typeof data.message === "string" ? data.message.trim() : "";
  if (!title || title.length > 100 || !body || body.length > 500) {
    throw new Error("A title of 1–100 characters and a message of 1–500 characters are required.");
  }
  const recipients = data.recipients ?? "All Barangays";
  if (recipients !== "All Barangays" && (typeof recipients !== "string" || !barangays.includes(recipients))) {
    throw new Error("Select All Barangays or a valid Balete barangay.");
  }
  return {
    topic: recipients === "All Barangays" ? ALL_RESIDENTS_TOPIC :
      `trashtrack_barangay_${String(recipients).toLowerCase().replaceAll(" ", "_")}_v1`,
    // Data messages without a collapse key keep distinct updates while offline.
    // Android persists the inbox item and posts the visible notification itself.
    data: { notificationId: id, openNotifications: "true", type: String(data.type ?? "general"),
      title, message: body, recipients: String(recipients) },
    android: {
      priority: "high",
      ttl: 7 * 24 * 60 * 60 * 1000,
    },
  };
}
