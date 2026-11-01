import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { staffAccessProblem, staffRole, StaffAccessError } from "@/lib/staff-access";
import { assertCertificateEligible, requiredText, validId, CertificateError } from "@/lib/certificate-data";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !["inspect", "correct"].includes(body.action)) throw new StaffAccessError("Choose a certificate name action.",400);
    const {db,identity}=await authenticatedStaff(request,true,body.action==="correct");
    await requireStaffSecurity();
    const eventId=validId(body.eventId),userId=validId(body.userId);
    const certificateId=createHash("sha256").update(eventId+"\0"+userId).digest("hex");
    const ref=db.collection("certificates").doc(certificateId);
    const result=await db.runTransaction(async tx=>{
      const [actor,event,registration,profile,snapshot]=await Promise.all([tx.get(db.collection("users").doc(identity.uid)),tx.get(db.collection("events").doc(eventId)),tx.get(db.collection("registrations").doc(eventId+"_"+userId)),tx.get(db.collection("users").doc(userId)),tx.get(ref)]);
      if(staffRole(actor.data()?.role)!=="admin" || staffAccessProblem(actor.data()||{},identity as unknown as Record<string,unknown>))throw new StaffAccessError("Your MENRO access changed. Sign in again.");
      if(!event.exists)throw new StaffAccessError("Event not found.",404);
      assertCertificateEligible(eventId,userId,event.data()!,registration.data());
      const profileName=requiredText(profile.data()?.name,"Full participant name");
      const current=snapshot.data(),revision=Number(current?.revision||0);
      if(body.action==="inspect")return {issuedName:current?.participantName||null,profileName,revision,canCorrect:!!current && current.participantName!==profileName};
      if(body.identityConfirmed!==true || !Number.isInteger(body.expectedRevision) || typeof body.expectedName!=="string")throw new StaffAccessError("Verify the participant's full name before correcting the certificate.",400);
      if(profileName!==body.expectedName)throw new StaffAccessError("The profile name changed. Reopen the name review before correcting it.",409);
      if(!current)throw new StaffAccessError("Download the certificate first to create its issued record.",409);
      if(current.userId!==userId || current.eventId!==eventId)throw new StaffAccessError("Certificate identity does not match.",409);
      if(current.participantName===profileName)return {saved:true,profileName,revision};
      if(revision!==body.expectedRevision)throw new StaffAccessError("This certificate changed. Reopen the name review.",409);
      tx.create(ref.collection("revisions").doc(String(revision)),{...current,archivedAt:FieldValue.serverTimestamp(),archivedBy:identity.uid});
      tx.update(ref,{participantName:profileName,revision:revision+1,correctedAt:FieldValue.serverTimestamp(),correctedBy:identity.uid});
      tx.create(db.collection("audit_logs").doc(),{action:"certificate.correctName",actor:identity.uid,target:certificateId,eventId,userId,from:current.participantName,to:profileName,revision:revision+1,at:FieldValue.serverTimestamp()});
      return {saved:true,profileName,revision:revision+1};
    });
    return Response.json(result,{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){if(error instanceof CertificateError)return Response.json({error:error.message},{status:error.status});return staffApiError(error);}
}
