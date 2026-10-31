"use client";
import { useState } from "react";
import { format,isValid,parseISO } from "date-fns";
import Link from "next/link";
import { Check,ArrowRight,ArrowLeft,Send,CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScheduleSummary } from "@/components/schedules/ScheduleSummary";
import { BALETE_BARANGAYS } from "@/lib/barangay-geofence";
import { staffRequest } from "@/lib/staff-client";
import { db } from "@/lib/firebase";
import { collection,doc } from "firebase/firestore";

export default function CreateSchedulePage(){
 const [step,setStep]=useState<1|2|3>(1);
 const [form,setForm]=useState(()=>({barangay:"Poblacion",date:format(new Date(),"yyyy-MM-dd"),day:format(new Date(),"EEEE"),time:"08:00",notes:""}));
 const [publicationId]=useState(()=>doc(collection(db,"schedules")).id);
 const [saving,setSaving]=useState(false),[error,setError]=useState("");
 const valid=!!form.barangay&&!!form.date&&isValid(parseISO(form.date))&&/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time);
 async function publish(){if(!valid||saving)return;setSaving(true);setError("");try{await staffRequest("/api/community/publish",{kind:"schedule",id:publicationId,...form,description:form.notes});setStep(3);}catch(failure){setError(failure instanceof Error?failure.message:"The schedule could not be published. Retry to confirm the saved post.");}finally{setSaving(false);}}
 return <div className="space-y-6">
  <ol className="grid grid-cols-3 gap-3" aria-label="Collection publication steps">{["Schedule details","Review","Published"].map((label,index)=><li key={label} aria-current={step===index+1?"step":undefined} className={`flex items-center gap-3 rounded-xl border p-3 sm:p-4 ${step>=index+1?"border-green-300 bg-green-50":"bg-white/70 text-muted-foreground"}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white font-semibold">{step>index+1?<Check className="h-4 w-4"/>:index+1}</span><span className="text-xs font-semibold sm:text-sm">{label}</span></li>)}</ol>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
   <section className="tt-surface space-y-6 p-5 sm:p-8">
    {step===3?<><Check className="h-10 w-10 text-green-700"/><h2>Collection schedule published</h2><p className="text-sm text-muted-foreground">Your schedule is saved in the calendar. Check Announcements for its phone delivery status.</p><Link href="/schedules" className="tt-primary-link"><CalendarDays/>View collection schedules</Link></>:<>
     <div><h2>{step===1?"Schedule details":"Review collection schedule"}</h2><p className="mt-2 text-sm text-muted-foreground">{step===1?"Choose a barangay, collection time and date. The summary updates immediately.":"Review the summary, then publish this schedule for residents."}</p></div>
     {step===1?<form id="schedule-details" onSubmit={event=>{event.preventDefault();if(valid)setStep(2);}} className="space-y-5">
      <label className="block text-sm font-medium">Barangay<select required value={form.barangay} onChange={event=>setForm(current=>({...current,barangay:event.target.value}))} className="mt-2 h-11 w-full rounded-lg border bg-white px-3">{BALETE_BARANGAYS.map(name=><option key={name}>{name}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Start time<Input required type="time" value={form.time} onChange={event=>setForm(current=>({...current,time:event.target.value}))} className="mt-2 h-11"/></label><label className="block text-sm font-medium">Collection date<Input required type="date" value={form.date} onChange={event=>{const date=event.target.value;setForm(current=>({...current,date,day:date&&isValid(parseISO(date))?format(parseISO(date),"EEEE"):""}));}} className="mt-2 h-11"/></label></div>
      <p className="text-xs text-muted-foreground">{form.day||"Choose a date"}. One collection per barangay and date; future dates have no booking horizon.</p>
      <label className="block text-sm font-medium">Notes (optional)<textarea maxLength={2000} rows={4} value={form.notes} onChange={event=>setForm(current=>({...current,notes:event.target.value}))} placeholder="Collection instructions for residents" className="mt-2 w-full rounded-lg border bg-white p-3"/></label>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><Link href="/schedules" className="text-sm text-muted-foreground">Cancel</Link><Button type="submit" disabled={!valid}>Review schedule<ArrowRight/></Button></div>
     </form>:<><ScheduleSummary form={form}/><div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5"><Button variant="outline" disabled={saving} onClick={()=>setStep(1)}><ArrowLeft/>Edit details</Button><Button disabled={saving} onClick={()=>void publish()}><Send/>{saving?"Publishing…":"Publish schedule"}</Button></div></>}
    </>}
   </section>
   <aside><ScheduleSummary form={form}/></aside>
  </div>
 </div>;
}
