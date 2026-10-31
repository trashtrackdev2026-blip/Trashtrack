"use client";
import { useState } from "react";
import { Dialog,DialogContent,DialogTitle,DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { staffRequest } from "@/lib/staff-client";

export function EditNotificationDialog({notice,onClose}:{notice:{id:string;title:string;message:string;type:string;revision?:number};onClose:()=>void}){
  const [title,setTitle]=useState(notice.title),[message,setMessage]=useState(notice.message),[type,setType]=useState(notice.type);
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  async function save(event:React.FormEvent){event.preventDefault();if(saving)return;setSaving(true);setError("");try{await staffRequest("/api/notifications/manage",{id:notice.id,expectedRevision:notice.revision||0,title,message,type});onClose();}catch(failure){setError(failure instanceof Error?failure.message:"Notification could not be saved.");}finally{setSaving(false);}}
  return <Dialog open onOpenChange={open=>{if(!open&&!saving)onClose();}}><DialogContent className="sm:max-w-lg" showCloseButton={!saving}><DialogTitle>Edit notification</DialogTitle><DialogDescription>Updates the in-app notification. Phone messages already delivered keep their original text; saving does not send another phone alert.</DialogDescription><form onSubmit={save} className="space-y-4"><label className="block">Title<Input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="block">Message<textarea required maxLength={500} rows={5} className="mt-2 w-full rounded-lg border p-3" value={message} onChange={e=>setMessage(e.target.value)}/></label><label className="block">Category<select value={type} onChange={e=>setType(e.target.value)} className="mt-2 w-full rounded-lg border p-2">{["general","schedule","alert","event",...(notice.type === "report" ? ["report"] : [])].map(value=><option key={value}>{value}</option>)}</select></label>{error&&<p role="alert" className="text-red-700">{error}</p>}<div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving?"Saving…":"Save notification"}</Button></div></form></DialogContent></Dialog>;
}
