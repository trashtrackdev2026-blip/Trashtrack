import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";
import { notificationPublication } from "@/lib/notification-publication";
import { queuePhoneNotification } from "@/lib/notification-delivery";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { app, db, identity } = await authenticatedStaff(request);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.id)) throw new StaffAccessError("A valid notification ID is required.", 400);
    const publication = notificationPublication(body);
    const publicationHash = createHash("sha256").update(JSON.stringify(publication)).digest("hex");
    const reference = db.collection("notifications").doc(body.id);
    await db.runTransaction(async tx => {
      const [actorSnap, existing] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)), tx.get(reference)]);
      const actor = actorSnap.data() || {};
      if (staffAccessProblem(actor, identity as unknown as Record<string, unknown>)) throw new StaffAccessError("Your staff access changed. Sign in again.");
      if (staffRole(actor.role) !== "admin" && publication.recipients !== actor.barangay) throw new StaffAccessError("Send only to your assigned barangay.");
      if (existing.exists) {
        if (existing.data()?.createdBy !== identity.uid || existing.data()?.publicationHash !== publicationHash) throw new StaffAccessError("This notification was already saved with different details.", 409);
        return;
      }
      tx.create(reference, { ...publication, publicationHash, createdBy: identity.uid, isRead: false,
        pushStatus: publication.push ? "pending" : "disabled", createdAt: FieldValue.serverTimestamp(), timestamp: FieldValue.serverTimestamp() });
    });
    if (publication.push) {
      try { await queuePhoneNotification(app, db, body.id); }
      catch (error) {
        return Response.json({ saved: true, queued: false, notificationId: body.id,
          deliveryError: error instanceof Error ? error.message : "Phone delivery is pending. Retry the saved notification." });
      }
    }
    return Response.json({ saved: true, queued: publication.push, notificationId: body.id });
  } catch (error) { return staffApiError(error); }
}
