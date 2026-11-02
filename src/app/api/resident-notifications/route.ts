import {createHash} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {authenticatedAccount,requireStaffSecurity,staffApiError} from "@/lib/staff-auth";
import {StaffAccessError} from "@/lib/staff-access";
import {queueResidentNotification} from "@/lib/resident-notification-delivery";

export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    const {app,db,identity,profile}=await authenticatedAccount(request);await requireStaffSecurity();
    if(String(profile.role).toLowerCase()!=="resident")throw new StaffAccessError("Resident account required.");
    const body=await request.json().catch(()=>null);
    if(!body || !["register","retry"].includes(body.action))throw new StaffAccessError("Choose a valid notification operation.",400);
    if(body.action==="register" || body.token!==undefined) {
      if(typeof body.token!=="string" || !/^[\w:.-]{32,2048}$/.test(body.token))throw new StaffAccessError("Invalid phone notification registration.",400);
      const ref=db.collection("push_devices").doc(createHash("sha256").update(body.token).digest("hex"));
      const existing=await ref.get();
      if(body.action==="register" || existing.data()?.userId!==identity.uid)await ref.set({token:body.token,userId:identity.uid,updatedAt:FieldValue.serverTimestamp()});
    }
    // One equality query avoids a composite index; filtering and ordering are bounded here.
    const notices=await db.collection("resident_notifications").where("recipientId","==",identity.uid).get();
    const pending=notices.docs.filter(doc=>{const d=doc.data();return d.pushStatus!=="queued" && Number(d.pushNextRetryAt || 0)<=Date.now() && Number(d.atMillis)>Date.now()-7*86400000;}).sort((a,b)=>Number(b.data().atMillis)-Number(a.data().atMillis)).slice(0,5);
    await Promise.allSettled(pending.map(doc=>queueResidentNotification(app,db,doc.id)));
    return Response.json({saved:true},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return staffApiError(error);}
}
