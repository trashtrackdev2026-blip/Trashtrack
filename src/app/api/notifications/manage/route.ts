import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem } from "@/lib/staff-access";
import { notificationEdit } from "@/lib/notification-edit";

export async function POST(request: Request) {
  try {
    const {db,identity} = await authenticatedStaff(request,true);await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== "string" || !/^[\w-]{1,128}$/.test(body.id) || typeof body.expectedRevision !== "number") throw new StaffAccessError("Choose a saved notification.",400);
    const ref = db.collection("notifications").doc(body.id);
    await db.runTransaction(async tx => {
      const [actor,snap] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)),tx.get(ref)]);
      if (staffAccessProblem(actor.data() || {},identity as unknown as Record<string,unknown>) || String(actor.data()?.role).toLowerCase() !== "admin") throw new StaffAccessError("Your MENRO access changed. Sign in again.");
      const current = snap.data();if(!current) throw new StaffAccessError("Notification not found.",404);
      if(Number(current.revision || 0) !== body.expectedRevision) throw new StaffAccessError("This notification changed. Reopen it before editing.",409);
      tx.update(ref,{...notificationEdit(body,current),revision:body.expectedRevision+1,updatedBy:identity.uid,updatedAt:FieldValue.serverTimestamp()});
      tx.create(db.collection("audit_logs").doc(),{action:"notification.edit",actor:identity.uid,target:body.id,at:FieldValue.serverTimestamp()});
    });
    return Response.json({saved:true});
  }catch(error){return staffApiError(error);}
}
