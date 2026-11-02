import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedAccount, requireApprovedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem, staffRole } from "@/lib/staff-access";
import { feedbackFields, feedbackThrottle, FEEDBACK_STATUSES } from "@/lib/system-feedback";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
// Private materialized inbox views keep status pagination ordered by submission
// time without requiring an owner-only composite-index permission.
const inbox = (status: string) => "feedback_view_" + status.toLowerCase();

export async function POST(request: Request) {
  try {
    const account = await authenticatedAccount(request);
    const { db, identity } = account;
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new StaffAccessError("Provide a feedback message.", 400);
    if (body.action === "update") {
      requireApprovedStaff(request, account, true);
      if (!/^[\w-]{1,220}$/.test(String(body.id || "")) || !["Reviewed", "Closed"].includes(body.status) || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0) throw new StaffAccessError("Review a saved feedback message before updating it.", 400);
      const ref = db.collection("system_feedback").doc(body.id);
      await db.runTransaction(async tx => {
        const [actor, snap] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)),tx.get(ref)]);
        if (staffRole(actor.data()?.role) !== "admin" || staffAccessProblem(actor.data() || {}, identity as unknown as Record<string,unknown>)) throw new StaffAccessError("Your MENRO access changed. Sign in again.");
        const data = snap.data();
        if (!data) throw new StaffAccessError("Feedback not found.",404);
        if (data.status === body.status && data.updatedBy === identity.uid && Number(data.revision || 0) === body.expectedRevision + 1) return;
        if (Number(data.revision || 0) !== body.expectedRevision) throw new StaffAccessError("This feedback changed. Refresh the inbox before updating it.",409);
        if (data.status === "Closed") throw new StaffAccessError("This feedback is already closed.",409);
        const update = { status:body.status,revision:body.expectedRevision+1,updatedBy:identity.uid, ...(body.status === "Reviewed" ? {reviewedBy:identity.uid,reviewedAt:FieldValue.serverTimestamp()} : {closedBy:identity.uid,closedAt:FieldValue.serverTimestamp()}) };
        tx.update(ref, update);
        tx.delete(db.collection(inbox(data.status)).doc(body.id));
        tx.create(db.collection(inbox(body.status)).doc(body.id), {...data,...update});
        tx.create(db.collection("audit_logs").doc(), {action:"feedback."+body.status.toLowerCase(),actor:identity.uid,target:body.id,from:data.status,to:body.status,at:FieldValue.serverTimestamp()});
      });
      return Response.json({saved:true},{headers});
    }
    const result = await db.runTransaction(async tx => {
      const profile = (await tx.get(db.collection("users").doc(identity.uid))).data() || {};
      const fields = feedbackFields(body,profile);
      const id = identity.uid + "_" + body.submissionId;
      const ref = db.collection("system_feedback").doc(id);
      const limit = db.collection("feedback_limits").doc(identity.uid);
      const [previous, throttle] = await Promise.all([tx.get(ref),tx.get(limit)]);
      const changeHash = createHash("sha256").update(JSON.stringify({message:fields.message,category:fields.category,appVersion:fields.appVersion})).digest("hex");
      if (previous.exists) {
        if (previous.data()?.changeHash !== changeHash) throw new StaffAccessError("This feedback was already sent with different details. Start a new message.",409);
        return {id,status:String(previous.data()?.status || "New")};
      }
      const nextLimit = feedbackThrottle(throttle.data() || {},Date.now());
      const entry = {...fields,residentId:identity.uid,changeHash,createdAt:FieldValue.serverTimestamp()};
      tx.create(ref,entry);
      tx.create(db.collection(inbox("New")).doc(id),entry);
      tx.set(limit,nextLimit);
      return {id,status:"New"};
    });
    return Response.json(result,{headers});
  } catch (error) {return staffApiError(error);}
}

export async function GET(request: Request) {
  try {
    const account = await authenticatedAccount(request);
    const { db, identity } = account;
    await requireStaffSecurity();
    const params = new URL(request.url).searchParams;
    const ownId = params.get("id");
    if (ownId) {
      if (!/^[\w-]{1,220}$/.test(ownId)) throw new StaffAccessError("Choose a valid feedback receipt.",400);
      const data = (await db.collection("system_feedback").doc(ownId).get()).data();
      if (!data || data.residentId !== identity.uid || String(account.profile.role).toLowerCase() !== "resident") throw new StaffAccessError("Feedback receipt not found.",404);
      return Response.json({id:ownId,status:data.status},{headers});
    }
    requireApprovedStaff(request,account,true);
    if (params.get("summary") === "1") {
      const fresh = await db.collection(inbox("New")).count().get();
      return Response.json({newCount:fresh.data().count},{headers});
    }
    const status = params.get("status") || "all";
    if (status !== "all" && !(FEEDBACK_STATUSES as readonly string[]).includes(status)) throw new StaffAccessError("Choose a feedback status.",400);
    const collection = db.collection(status === "all" ? "system_feedback" : inbox(status));
    let query = collection.orderBy("createdAt","desc");
    const cursor = params.get("cursor");
    if (cursor) {
      if (!/^[\w-]{1,220}$/.test(cursor)) throw new StaffAccessError("Refresh the feedback inbox.",400);
      const last = await collection.doc(cursor).get();
      if (!last.exists || (status !== "all" && last.data()?.status !== status)) throw new StaffAccessError("This page changed. Refresh the feedback inbox.",409);
      query = query.startAfter(last);
    }
    const [page, fresh] = await Promise.all([query.limit(26).get(),db.collection(inbox("New")).count().get()]);
    const visible = page.docs.slice(0,25);
    const items = visible.map(doc => {const data=doc.data();return {id:doc.id,residentName:data.residentName,barangay:data.barangay,category:data.category,message:data.message,appVersion:data.appVersion,status:data.status,revision:Number(data.revision||0),createdAt:data.createdAt?.toDate?.().toISOString()||""};});
    return Response.json({items,newCount:fresh.data().count,nextCursor:page.docs.length>25?visible.at(-1)!.id:null},{headers});
  } catch(error) {return staffApiError(error);}
}
