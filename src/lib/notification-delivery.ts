import type { App } from "firebase-admin/app";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { BALETE_BARANGAYS } from "./barangay-geofence";
import { buildPhonePush } from "./phone-push";
import { StaffAccessError } from "./staff-access";

export async function queuePhoneNotification(app: App, db: Firestore, id: string) {
  const reference = db.collection("notifications").doc(id);
  const payload = await db.runTransaction(async tx => {
    const data = (await tx.get(reference)).data();
    if (!data) throw new StaffAccessError("Notification not found.", 404);
    if (data.push !== true) throw new StaffAccessError("Phone push is disabled for this notification.", 409);
    if (data.pushStatus === "queued") return null;
    if (data.pushStatus === "sending" && data.pushStartedAt instanceof Timestamp && Date.now() - data.pushStartedAt.toMillis() < 5 * 60 * 1000) throw new StaffAccessError("Phone delivery is being queued. Wait a moment, then retry to check its status.", 409);
    let message;
    try { message = buildPhonePush(id, data, BALETE_BARANGAYS); }
    catch (error) { throw new StaffAccessError(error instanceof Error ? error.message : "Invalid notification details.", 400); }
    tx.update(reference, { pushStatus: "sending", pushStartedAt: FieldValue.serverTimestamp(),
      pushAttempts: (typeof data.pushAttempts === "number" ? data.pushAttempts : 0) + 1 });
    return message;
  });
  if (!payload) return;
  try {
    const messageId = await getMessaging(app).send(payload);
    await reference.update({ pushStatus: "queued", pushMessageId: messageId, pushQueuedAt: FieldValue.serverTimestamp(), pushRetryable: false });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    const retryable = !["messaging/invalid-argument", "messaging/invalid-payload", "messaging/authentication-error", "messaging/mismatched-credential"].includes(code);
    await reference.update({ pushStatus: "failed", pushErrorCode: code, pushRetryable: retryable, pushNextRetryAt: Date.now() + 60_000 }).catch(() => {});
    throw new StaffAccessError("The post is saved, but phone delivery could not be queued. Retry publishing to send the saved notification.", 502);
  }
}
