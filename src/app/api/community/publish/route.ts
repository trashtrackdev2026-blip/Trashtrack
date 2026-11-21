import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";
import { communityPublication } from "@/lib/community-publication";
import { queuePhoneNotification } from "@/lib/notification-delivery";
import { assertCollectionAvailable, collectionTruckName } from "@/lib/schedule-policy";
import { CertificateError } from "@/lib/certificate-data";
import { assertFutureSchedule } from "@/lib/scheduling-time";
import { collectionTruckNotice } from "@/lib/collection-outcome-notice";

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
      // Retry an already committed publication even after its start has passed;
      // only new posts and publishing drafts are new scheduling actions.
      assertFutureSchedule("dateISO" in publication.post ? publication.post.dateISO : publication.post.date, "startTime" in publication.post ? publication.post.startTime : publication.post.time);
      let truckName = "";
      let truckNotice = "";
      if ("day" in publication.post) {
        if (publication.post.truckId) {
          if (staffRole(actor.role) !== "admin") throw new StaffAccessError("MENRO manages collection truck assignments.");
          const truck = await tx.get(db.collection("collection_trucks").doc(publication.post.truckId));
          const fleet = truck.data();
          truckName = collectionTruckName(fleet);
          truckNotice = collectionTruckNotice(truckName, fleet);
        }
        const dayRef = db.collection("schedule_days").doc(publication.post.date);
        const [day, schedules] = await Promise.all([tx.get(dayRef), tx.get(db.collection("schedules").where("date", "==", publication.post.date))]);
        assertCollectionAvailable(publication.post, schedules.docs.map(doc => doc.data()));
        tx.set(dayRef, { revision: Number(day.data()?.revision || 0) + 1 });
      }
      const post = { ...publication.post, ...(truckName ? { truckName } : {}), createdBy: identity.uid, publicationHash: hash, createdAt: FieldValue.serverTimestamp() };
      if (publishingDraft) tx.update(postRef,{...post,publishedAt:FieldValue.serverTimestamp()});
      else tx.create(postRef,post);
      const message = truckNotice ? truckNotice + "\n" + publication.announcement.message : publication.announcement.message;
      tx.create(noticeRef, { ...publication.announcement, message, sourceId: body.id, push: true, pushStatus: "pending", isRead: false, createdBy: identity.uid,
        createdAt: FieldValue.serverTimestamp(), timestamp: FieldValue.serverTimestamp() });
    });
    await queuePhoneNotification(app, db, notificationId);
    return Response.json({ saved: true, queued: true, id: body.id, notificationId });
  } catch (error) {
    if (error instanceof CertificateError) return Response.json({ error: error.message }, { status: error.status });
    return staffApiError(error);
  }
}
