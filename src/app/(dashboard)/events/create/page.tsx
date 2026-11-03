"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { collection,doc,getDoc } from "firebase/firestore";
import { CalendarDays,Check,FileText,ImagePlus,Send } from "lucide-react";
import { db } from "@/lib/firebase";
import { staffRequest } from "@/lib/staff-client";
import { STAFF_BARANGAYS } from "@/lib/staff-access";
import { EVENT_CATEGORIES } from "@/lib/event-categories";
import { eventFormFields } from "@/lib/event-form";
import { collectionTimeLabel } from "@/lib/collection-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CertificatePreview } from "@/components/events/CertificatePreview";
import { assertFutureSchedule, schedulingBounds, schedulingError } from "@/lib/scheduling-time";
import { useSchedulingClock } from "@/lib/use-scheduling-clock";

type EventForm={title:string;category:string;description:string;dateISO:string;startTime:string;endTime:string;barangay:string;location:string;img:string;coverFileName:string;attendanceMethod:string;certificateEnabled:boolean;certificateSignatory:string;certificatePosition:string;certificateOrganizer:string};
const emptyForm:EventForm={title:"",category:"Clean-up Drive",description:"",dateISO:"",startTime:"",endTime:"",barangay:"Poblacion",location:"",img:"/images/balete-lakeside.webp",coverFileName:"",attendanceMethod:"qr",certificateEnabled:false,certificateSignatory:"",certificatePosition:"MENRO Officer",certificateOrganizer:"Municipal Environment and Natural Resources Office (MENRO)"};
export default function CreateEventPage(){
 const now=useSchedulingClock();
 const [form,setForm]=useState<EventForm>(emptyForm),[id,setId]=useState(()=>doc(collection(db,"events")).id);
 const [loadingDraft,setLoadingDraft]=useState(false),[busy,setBusy]=useState<"draft"|"publish"|null>(null);
 const [uploadingFileName, setUploadingFileName] = useState("");
 const [coverError, setCoverError] = useState("");
 const uploading = uploadingFileName !== "";
 const [error,setError]=useState(""),[message,setMessage]=useState(""),[published,setPublished]=useState(false),[preview,setPreview]=useState<Record<string,unknown>|null>(null);
 useEffect(()=>{const draft=new URLSearchParams(window.location.search).get("draft");if(!draft)return;let cancelled=false;void(async()=>{setLoadingDraft(true);try{const snap=await getDoc(doc(db,"events",draft));const data=snap.data();if(!data||data.status!=="Draft")throw new Error("This draft is unavailable or already published.");if(!cancelled){setId(draft);setForm({...emptyForm,...data} as EventForm);}}catch(failure){if(!cancelled)setError(failure instanceof Error?failure.message:"The draft could not be loaded.");}finally{if(!cancelled)setLoadingDraft(false);}})();return()=>{cancelled=true;};},[]);
 function field<K extends keyof EventForm>(key:K,value:EventForm[K]){setForm(current=>({...current,[key]:value}));setMessage("");}
 async function save(draft:boolean){if(busy||uploading||loadingDraft)return;setError("");setMessage("");try{const fields=eventFormFields(form,draft);assertFutureSchedule(fields.dateISO,fields.startTime,Date.now(),draft);}catch(failure){setError(failure instanceof Error?failure.message:"Check the event details.");return;}setBusy(draft?"draft":"publish");try{const payload={...form,id,kind:"event"};const result=await staffRequest<{queued?:boolean;deliveryError?:string}>(draft?"/api/events/drafts":"/api/community/publish",payload);if(draft){setMessage("Draft saved. It is available in Events and remains hidden from residents until published.");}else{setPublished(true);if(result.deliveryError)setMessage(result.deliveryError);}}catch(failure){setError(failure instanceof Error?failure.message:"The event could not be saved. Your entered details are kept.");}finally{setBusy(null);}}
 async function upload(event: React.ChangeEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  input.value = "";
  if (!file || uploading || busy || loadingDraft) return;
  setCoverError("");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
   setCoverError("Choose a JPG, PNG or WebP cover image up to 10 MB.");
   return;
  }
  setUploadingFileName(file.name);
  try {
   const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
   const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
   if (!cloud || !preset) throw new Error("Cover uploads are not configured.");
   const body = new FormData();
   body.append("file", file);
   body.append("upload_preset", preset);
   const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST", body, signal: AbortSignal.timeout(60_000),
   });
   const data = await response.json();
   if (!response.ok || !data.secure_url) throw new Error(data.error?.message || "Cover image could not be uploaded.");
   setForm(current => ({ ...current, img: data.secure_url, coverFileName: file.name }));
   setMessage("");
  } catch (failure) {
   setCoverError(failure instanceof Error ? failure.message : "Cover upload failed.");
  } finally {
   setUploadingFileName("");
  }
 }
 const disabled=!!busy||uploading||loadingDraft;
 const hasCustomCover = !!form.img && form.img !== emptyForm.img;
 const bounds=schedulingBounds(form.dateISO,now),dateTimeError=schedulingError(form.dateISO,form.startTime,now,true);
 return <div className="space-y-5">
  {preview&&<CertificatePreview data={preview} onClose={()=>setPreview(null)}/>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {message&&<p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-900">{message}</p>}
  {published?<section className="tt-surface space-y-5 p-8"><Check className="h-10 w-10 text-green-700"/><h2>Event published</h2><p>“{form.title}” is saved and available in the resident app. Check Announcements for its phone delivery status.</p><Link href="/events" className="tt-primary-link">View events</Link></section>:<div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
   <form onSubmit={event=>{event.preventDefault();void save(false);}} className="tt-surface space-y-7 p-5 sm:p-8">
    <fieldset disabled={disabled} className="space-y-7"><legend className="sr-only">Community event details</legend>
    <section className="space-y-4"><h2>Event information</h2><label className="block text-sm">Event title<Input required maxLength={150} value={form.title} onChange={e=>field("title",e.target.value)} className="mt-2 h-11"/></label><label className="block text-sm">Category<select value={form.category} onChange={e=>field("category",e.target.value)} className="mt-2 h-11 w-full rounded-lg border px-3">{EVENT_CATEGORIES.map(value=><option key={value}>{value}</option>)}</select></label><label className="block text-sm">Description<textarea rows={4} maxLength={5000} value={form.description} onChange={e=>field("description",e.target.value)} className="mt-2 w-full rounded-lg border p-3"/></label>
     <div>
      <p className="text-sm font-medium" id="event-cover-label">Cover image <span className="font-normal text-muted-foreground">(optional)</span></p>
      <label className="mt-2 flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[#8ba88f] bg-[#fffcf4] p-4 text-[#12372f] focus-within:ring-2 focus-within:ring-[#194f3d] has-disabled:cursor-default">
       <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e9edd9] text-[#194f3d]"><ImagePlus size={21} aria-hidden="true" /></span>
       <span className="min-w-0 grow basis-36">
        <span className="block break-all text-sm font-semibold" role="status">
         {uploading ? `Uploading ${uploadingFileName}…` : hasCustomCover ? form.coverFileName || "Saved cover image" : "Choose a cover image"}
        </span>
        <span id="event-cover-hint" className="mt-1 block text-xs text-[#4d6056]">JPG, PNG or WebP · up to 10 MB</span>
       </span>
       <span aria-hidden="true" className="rounded-full bg-[#194f3d] px-4 py-2 text-xs font-semibold text-[#fffcf4]">{hasCustomCover ? "Replace image" : "Browse files"}</span>
       <input type="file" aria-labelledby="event-cover-label" aria-describedby="event-cover-hint"
        accept="image/jpeg,image/png,image/webp" onChange={event => void upload(event)} className="sr-only" />
      </label>
      {coverError && <p role="alert" className="mt-2 text-sm text-red-800">{coverError}</p>}
     </div>
    </section>
    <section className="space-y-4 border-t pt-5"><h2>Date, time and location</h2><div className="grid gap-4 sm:grid-cols-3"><label className="block text-sm">Event date<Input required type="date" min={bounds.minDate} value={form.dateISO} onChange={e=>field("dateISO",e.target.value)} className="mt-2 h-11"/></label><label className="block text-sm">Start time<Input required type="time" min={bounds.minTime} value={form.startTime} onChange={e=>field("startTime",e.target.value)} className="mt-2 h-11"/></label><label className="block text-sm">End time (optional)<Input type="time" min={form.startTime||bounds.minTime} value={form.endTime} onChange={e=>field("endTime",e.target.value)} className="mt-2 h-11"/></label></div><p className="text-xs text-muted-foreground">Choose a future start in Philippine time. End time must be later on the same date.</p>{dateTimeError&&<p role="alert" className="text-sm text-red-700">{dateTimeError}</p>}<label className="block text-sm">Barangay<select value={form.barangay} onChange={e=>field("barangay",e.target.value)} className="mt-2 h-11 w-full rounded-lg border px-3">{[...STAFF_BARANGAYS,"All Barangays"].map(value=><option key={value}>{value}</option>)}</select></label><label className="block text-sm">Venue / location<Input maxLength={240} value={form.location} onChange={e=>field("location",e.target.value)} className="mt-2 h-11"/></label></section>
    <section className="space-y-4 border-t pt-5"><h2>Attendance</h2><div className="flex flex-wrap gap-5">{[{value:"qr",label:"QR code attendance"},{value:"manual",label:"Manual attendance"}].map(option=><label key={option.value} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="attendance" checked={form.attendanceMethod===option.value} onChange={()=>field("attendanceMethod",option.value)}/>{option.label}</label>)}</div><p className="text-xs text-muted-foreground">Attendance QR codes become available after publication.</p></section>
    <section className="space-y-4 border-t pt-5"><h2>Certificate (optional)</h2><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={form.certificateEnabled} onChange={e=>field("certificateEnabled",e.target.checked)}/>Enable certificates for verified attendees</label>{form.certificateEnabled&&<><label className="block text-sm">Signatory name<Input value={form.certificateSignatory} onChange={e=>field("certificateSignatory",e.target.value)} className="mt-2"/></label><label className="block text-sm">Signatory position<Input value={form.certificatePosition} onChange={e=>field("certificatePosition",e.target.value)} className="mt-2"/></label><label className="block text-sm">Organizing office<Input value={form.certificateOrganizer} onChange={e=>field("certificateOrganizer",e.target.value)} className="mt-2"/></label><Button type="button" variant="outline" onClick={()=>setPreview({participantName:"Sample Participant",eventTitle:form.title,eventDate:form.dateISO,...form})}>Preview existing certificate</Button></>}</section>
    </fieldset>
    <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-5"><Link href="/events" className="mr-auto text-sm text-muted-foreground">Cancel</Link><Button type="button" variant="outline" disabled={disabled} onClick={()=>void save(true)}><FileText/>{busy==="draft"?"Saving draft…":"Save as Draft"}</Button><Button type="submit" disabled={disabled}><Send/>{busy==="publish"?"Publishing…":"Publish Event"}</Button></div>
   </form>
   <aside className="tt-surface space-y-5 p-5"><div className="relative aspect-video overflow-hidden rounded-xl"><Image src={form.img||emptyForm.img} alt="Event cover preview" fill sizes="330px" className="object-cover"/></div><h2>{form.title||"Event preview"}</h2><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 text-sm">{[["Date",form.dateISO],["Start",form.startTime?collectionTimeLabel(form.startTime):""],["End",form.endTime?collectionTimeLabel(form.endTime):"To be announced"],["Barangay",form.barangay],["Venue",form.location],["Certificates",form.certificateEnabled?"Enabled":"Disabled"]].map(([label,value])=><div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="break-words text-right">{value||"Not set"}</dd></div>)}</dl><p className="border-t pt-4 text-xs text-muted-foreground"><CalendarDays className="mb-2 h-4 w-4"/>Drafts can be saved with a title and barangay. Date, start time and enabled certificate details are checked when you publish.</p></aside>
  </div>}
 </div>;
}
