import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";
import { communityPublication } from "@/lib/community-publication";
import { queuePhoneNotification } from "@/lib/notification-delivery";
import { assertCollectionAvailable } from "@/lib/schedule-policy";
import { CertificateError } from "@/lib/certificate-data";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { app, db, identity } = await authenticatedStaff(request);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.id)) throw new StaffAccessError("A valid publication ID is required.", 400);
    const publication = communityPublication(body.kind, body);
    const hash = createHash("sha256").update(JSON.stringify(publication)).digest("hex");
    const postRef = db.collection(body.kind === "schedule" ? "schedules" : "events").doc(body.id);
    const notificationId = body.kind + "_" + body.id;
    const noticeRef = db.collection("notifications").doc(notificationId);
    await db.runTransaction(async tx => {
      const [actorSnap, postSnap, noticeSnap] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)), tx.get(postRef), tx.get(noticeRef)]);
      const actor = actorSnap.data() || {};
      if (staffAccessProblem(actor, identity as unknown as Record<string, unknown>)) throw new StaffAccessError("Your staff access changed. Sign in again.");
      if (staffRole(actor.role) !== "admin" && publication.post.barangay !== actor.barangay) throw new StaffAccessError("Publish only for your assigned barangay.");
      const publishingDraft = body.kind === "event" && postSnap.exists && postSnap.data()?.status === "Draft" && postSnap.data()?.createdBy === identity.uid && !noticeSnap.exists;
      if (postSnap.exists && !publishingDraft) {
        if (postSnap.data()?.createdBy !== identity.uid || postSnap.data()?.publicationHash !== hash || !noticeSnap.exists) throw new StaffAccessError("This publication already exists with different details. Open the saved post.", 409);
        return;
      }
      if (body.kind === "schedule" && "date" in publication.post) {
        const dayRef = db.collection("schedule_days").doc(publication.post.date);
        const [day, schedules] = await Promise.all([tx.get(dayRef), tx.get(db.collection("schedules").where("date", "==", publication.post.date))]);
        assertCollectionAvailable(publication.post, schedules.docs.map(doc => doc.data()));
        tx.set(dayRef, { revision: Number(day.data()?.revision || 0) + 1 });
      }
      const post = { ...publication.post, createdBy: identity.uid, publicationHash: hash, createdAt: FieldValue.serverTimestamp() };
      if (publishingDraft) tx.update(postRef,{...post,publishedAt:FieldValue.serverTimestamp()});
      else tx.create(postRef,post);
      tx.create(noticeRef, { ...publication.announcement, sourceId: body.id, push: true, pushStatus: "pending", isRead: false, createdBy: identity.uid,
        createdAt: FieldValue.serverTimestamp(), timestamp: FieldValue.serverTimestamp() });
    });
    await queuePhoneNotification(app, db, notificationId);
    return Response.json({ saved: true, queued: true, id: body.id, notificationId });
  } catch (error) {
    if (error instanceof CertificateError) return Response.json({ error: error.message }, { status: error.status });
    return staffApiError(error);
  }
}
