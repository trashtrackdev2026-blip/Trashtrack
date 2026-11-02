import type {App} from "firebase-admin/app";
import {FieldValue, type Firestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import {privateReportPush} from "./report-progress";

export async function queueResidentNotification(app:App,db:Firestore,id:string) {
  const ref=db.collection("resident_notifications").doc(id);
  const job=await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),notice=snap.data();
    if(!notice || notice.pushStatus==="queued")return null;
    if(notice.pushStatus==="sending" && Number(notice.pushStartedMillis)>Date.now()-120000)return null;
    const recipient=(await tx.get(db.collection("users").doc(String(notice.recipientId)))).data();
    if(!recipient || String(recipient.role).toLowerCase()!=="resident" || ["suspended","disabled"].includes(String(recipient.accessStatus))) {
      tx.update(ref,{pushStatus:"disabled"});return null;
    }
    const devices=await tx.get(db.collection("push_devices").where("userId","==",notice.recipientId).limit(20));
    const tokens=devices.docs.map(doc=>({ref:doc.ref,token:String(doc.data().token || "")})).filter(device=>device.token);
    if(!tokens.length){tx.update(ref,{pushStatus:"pending",pushNextRetryAt:Date.now()+60000});return null;}
    tx.update(ref,{pushStatus:"sending",pushStartedMillis:Date.now(),pushAttempts:Number(notice.pushAttempts || 0)+1});
    return {notice,tokens};
  });
  if(!job)return;
  try {
    const result=await getMessaging(app).sendEach(job.tokens.map(device=>privateReportPush(id,job.notice,device.token)));
    const permanent=["messaging/registration-token-not-registered","messaging/invalid-registration-token"];
    await Promise.all(result.responses.map((response,index)=>!response.success && permanent.includes(response.error?.code || "") ? job.tokens[index].ref.delete() : Promise.resolve()));
    const retryable=result.responses.some(response=>!response.success&&!permanent.includes(response.error?.code || ""));
    await ref.update({pushStatus:retryable?"failed":result.successCount?"queued":"pending",pushRetryable:retryable,pushNextRetryAt:Date.now()+60000,pushQueuedAt:FieldValue.serverTimestamp()});
    if(retryable)throw new Error("Phone delivery is pending. The report update is saved in the resident inbox.");
  }catch(error){await ref.update({pushStatus:"failed",pushRetryable:true,pushNextRetryAt:Date.now()+60000}).catch(()=>{});throw error;}
}
