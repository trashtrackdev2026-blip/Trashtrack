import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem } from "@/lib/staff-access";
import { notificationEdit } from "@/lib/notification-edit";
import { queuePhoneNotification } from "@/lib/notification-delivery";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const {app,db,identity} = await authenticatedStaff(request,true);await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== "string" || !/^[\w-]{1,128}$/.test(body.id) || typeof body.expectedRevision !== "number") throw new StaffAccessError("Choose a saved notification.",400);
    if (typeof body.changeId !== "string" || !/^[\w-]{1,80}$/.test(body.changeId) || !Number.isInteger(body.expectedRevision) || body.expectedRevision < 0) throw new StaffAccessError("Refresh the dashboard and reopen the notification before editing.",400);
    const ref = db.collection("notifications").doc(body.id);
    const notificationId = "notification_update_" + createHash("sha256").update(body.id + "\0" + body.changeId).digest("hex");
    const updateRef = db.collection("notifications").doc(notificationId);
    const changeHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const result = await db.runTransaction(async tx => {
      const [actor,snap,previous] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)),tx.get(ref),tx.get(updateRef)]);
      if (staffAccessProblem(actor.data() || {},identity as unknown as Record<string,unknown>) || String(actor.data()?.role).toLowerCase() !== "admin") throw new StaffAccessError("Your MENRO access changed. Sign in again.");
      if (previous.exists) {
        if (previous.data()?.changeHash !== changeHash || previous.data()?.createdBy !== identity.uid) throw new StaffAccessError("This update was saved with different details. Reopen the notification.",409);
        return {changed:true,push:previous.data()?.push === true};
      }
      const current = snap.data();if(!current) throw new StaffAccessError("Notification not found.",404);
      if(Number(current.revision || 0) !== body.expectedRevision) throw new StaffAccessError("This notification changed. Reopen it before editing.",409);
      const fields=notificationEdit(body,current);
      if (fields.title === current.title && fields.message === current.message && fields.type === current.type) return {changed:false,push:false};
      tx.update(ref,{...fields,revision:body.expectedRevision+1,updatedBy:identity.uid,updatedAt:FieldValue.serverTimestamp()});
      tx.create(updateRef,{...fields,title:("Updated · " + fields.title).slice(0,100),originalNotificationId:body.id,sourceId:current.sourceId || body.id,
        recipients:current.recipients,push:current.push === true,pushStatus:current.push === true ? "pending" : "disabled",isRead:false,changeHash,sourceRevision:body.expectedRevision+1,createdBy:identity.uid,createdAt:FieldValue.serverTimestamp(),timestamp:FieldValue.serverTimestamp()});
      tx.create(db.collection("audit_logs").doc(),{action:"notification.edit",actor:identity.uid,target:body.id,at:FieldValue.serverTimestamp()});
      return {changed:true,push:current.push === true};
    });
    if(result.push) {
      try {await queuePhoneNotification(app,db,notificationId);}
      catch(error) {return Response.json({saved:true,changed:true,queued:false,notificationId,deliveryError:error instanceof Error ? error.message : "Phone delivery is pending. Retry the saved update in Announcements."});}
    }
    return Response.json({saved:true,changed:result.changed,queued:result.push,notificationId:result.changed?notificationId:undefined});
  }catch(error){return staffApiError(error);}
}
