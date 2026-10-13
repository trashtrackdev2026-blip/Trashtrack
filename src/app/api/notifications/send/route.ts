import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { PushConfigurationError } from "@/lib/firebase-admin";
import { authenticatedStaff } from "@/lib/staff-auth";
import { StaffAccessError } from "@/lib/staff-access";
import { BALETE_BARANGAYS } from "@/lib/barangay-geofence";
import { buildPhonePush } from "@/lib/phone-push";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!bearer) return Response.json({ error: "Sign in as an admin to send phone notifications." }, { status: 401 });
  try {
    const { app, db } = await authenticatedStaff(request, true);
    const body = await request.json().catch(() => null);
    if (typeof body?.notificationId !== "string" || !/^[\w-]{1,128}$/.test(body.notificationId)) {
      return Response.json({ error: "A valid saved notification ID is required." }, { status: 400 });
    }
    const reference = db.collection("notifications").doc(body.notificationId);
    const snapshot = await reference.get();
    const data = snapshot.data();
    if (!data) return Response.json({ error: "Notification not found." }, { status: 404 });
    if (data.push !== true) return Response.json({ error: "Phone push is disabled for this notification." }, { status: 409 });
    let payload;
    try { payload = buildPhonePush(snapshot.id, data, BALETE_BARANGAYS); }
    catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }

    // Claim this document so repeated clicks or a client timeout cannot send concurrent copies.
    const claim = await db.runTransaction(async transaction => {
      const latest = (await transaction.get(reference)).data();
      if (!latest) return "missing";
      if (latest.pushStatus === "queued") return "queued";
      if (latest.pushStatus === "sending" && latest.pushStartedAt instanceof Timestamp &&
          Date.now() - latest.pushStartedAt.toMillis() < 5 * 60 * 1000) return "sending";
      transaction.update(reference, { pushStatus: "sending", pushStartedAt: FieldValue.serverTimestamp() });
      return "claimed";
    });
    if (claim === "missing") return Response.json({ error: "Notification not found." }, { status: 404 });
    if (claim === "queued") return Response.json({ queued: true });
    if (claim === "sending") return Response.json({ error: "Phone delivery is still being queued. Wait a moment before retrying." }, { status: 409 });
    try {
      const messageId = await getMessaging(app).send(payload);
      await reference.update({ pushStatus: "queued", pushMessageId: messageId, pushQueuedAt: FieldValue.serverTimestamp() });
      return Response.json({ queued: true });
    } catch {
      await reference.update({ pushStatus: "failed" }).catch(() => {});
      return Response.json({ error: "Firebase could not queue the phone notification. Check the server's internet connection, Firebase Messaging API and service-account permissions, then retry." }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof StaffAccessError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof PushConfigurationError) return Response.json({ error: error.message }, { status: 503 });
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code.startsWith("auth/")) return Response.json({ error: "Your admin session could not be verified. Sign in again." }, { status: 401 });
    return Response.json({ error: "Phone delivery could not be prepared. Check the admin server's Firebase access and retry." }, { status: 502 });
  }
}
