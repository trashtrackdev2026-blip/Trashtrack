"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { staffRequest } from "@/lib/staff-client";
import { StaffConfirmationRequired, withRecentStaffSignIn } from "@/lib/staff-action";
import { ConfirmStaffSession } from "@/components/auth/ConfirmStaffSession";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
type NameReview={issuedName:string|null;profileName:string;revision:number;canCorrect:boolean};
export function CertificateNameCorrection({eventId,userId,onClose}:{eventId:string;userId:string;onClose:()=>void}) {
  const [data,setData]=useState<NameReview|null>(null),[error,setError]=useState(""),[saved,setSaved]=useState(false),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[reauth,setReauth]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let stopped=false;void staffRequest<NameReview>("/api/certificates/correct-name",{action:"inspect",eventId,userId}).then(result=>{if(!stopped){setData(result);setError("");}}).catch(failure=>{if(!stopped)setError(failure instanceof Error?failure.message:"Could not review this name.");});return()=>{stopped=true;};},[eventId,userId,attempt]);
  async function correct(){if(!data||!confirmed||!auth.currentUser)return;setBusy(true);setError("");try{await withRecentStaffSignIn(auth.currentUser,()=>staffRequest("/api/certificates/correct-name",{action:"correct",eventId,userId,identityConfirmed:true,expectedRevision:data.revision,expectedName:data.profileName}));setSaved(true);}catch(failure){if(failure instanceof StaffConfirmationRequired)setReauth(true);else setError(failure instanceof Error?failure.message:"Correction failed.");}finally{setBusy(false);}}
  return <><Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent showCloseButton={!busy}><DialogHeader><DialogTitle>Review certificate name</DialogTitle><DialogDescription>Correct an issued name using the full name in the resident profile. The prior certificate record is retained in the correction history.</DialogDescription></DialogHeader>
    {data?<><dl className="grid gap-2 text-sm"><dt>Issued name</dt><dd className="font-semibold">{data.issuedName||"Not issued yet"}</dd><dt>Current full profile name</dt><dd className="font-semibold">{data.profileName}</dd></dl>{!saved&&data.canCorrect&&<label className="flex gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I verified this participant&apos;s identity and full name and authorize this correction.</label>}{!data.canCorrect&&<p className="text-sm">{data.issuedName?"The certificate already uses this full name.":"Download the certificate to issue it with the current full profile name."}</p>}</>:!error&&<p role="status">Loading name review…</p>}
    {saved&&<p role="status" className="text-sm text-green-800">Full name corrected. Download the certificate again to get the corrected PDF.</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-3"><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>{!data&&error&&<Button onClick={()=>setAttempt(v=>v+1)}>Retry review</Button>}{data?.canCorrect&&!saved&&<Button disabled={busy||!confirmed} onClick={()=>void correct()}>{busy?"Saving…":"Correct full name"}</Button>}</div>
  </DialogContent></Dialog>{reauth&&auth.currentUser&&<ConfirmStaffSession user={auth.currentUser} onCancel={()=>setReauth(false)} onConfirmed={async()=>{setReauth(false);await correct();}}/>}</>;
}
