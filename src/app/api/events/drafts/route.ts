import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { StaffAccessError, staffAccessProblem } from "@/lib/staff-access";
import { eventFormFields } from "@/lib/event-form";
import { CertificateError } from "@/lib/certificate-data";

export async function POST(request: Request) {
  try {
    const {db,identity} = await authenticatedStaff(request,true);
    await requireStaffSecurity();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== "string" || !/^[\w-]{1,128}$/.test(body.id)) throw new StaffAccessError("A draft event ID is required.",400);
    const fields = eventFormFields(body,true);
    const ref = db.collection("events").doc(body.id);
    await db.runTransaction(async tx => {
      const [actor,current] = await Promise.all([tx.get(db.collection("users").doc(identity.uid)),tx.get(ref)]);
      if (staffAccessProblem(actor.data() || {},identity as unknown as Record<string,unknown>) || String(actor.data()?.role).toLowerCase() !== "admin") throw new StaffAccessError("Your MENRO access changed. Sign in again.");
      if (current.exists && (current.data()?.status !== "Draft" || current.data()?.createdBy !== identity.uid)) throw new StaffAccessError("This event is already published or belongs to another official.",409);
      tx.set(ref,{...fields,status:"Draft",createdBy:identity.uid,participants:0,
        ...(!current.exists ? {createdAt:FieldValue.serverTimestamp()} : {}),updatedAt:FieldValue.serverTimestamp()},{merge:true});
    });
    return Response.json({saved:true,id:body.id,status:"Draft"});
  } catch(error) {
    if(error instanceof CertificateError) return Response.json({error:error.message},{status:error.status});
    return staffApiError(error);
  }
}
