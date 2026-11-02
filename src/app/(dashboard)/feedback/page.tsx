"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, RefreshCw, ChevronLeft, ChevronRight, Check, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataState } from "@/components/ui/data-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { DetailPanel, useWideWorkspace } from "@/components/layout/DetailPanel";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { staffRequest } from "@/lib/staff-client";
import { useAuth } from "@/context/AuthContext";

type Feedback = {id:string;residentName:string;barangay:string;category:string;message:string;appVersion:string;status:string;revision:number;createdAt:string};
type Page = {items:Feedback[];newCount:number;nextCursor:string|null};
const date = (value:string) => value ? new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(value)) : "Time unavailable";

export default function FeedbackPage() {
  const {user,role} = useAuth();
  const [state,setState] = useState<Page & {owner:string}>({items:[],newCount:0,nextCursor:null,owner:""});
  const [filter,setFilter] = useState("all");
  const [cursors,setCursors] = useState<string[]>([""]);
  const [search,setSearch] = useState("");
  const [attempt,setAttempt] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [selected,setSelected] = useState<string|null>(null);
  const [busy,setBusy] = useState(false);
  const [actionError,setActionError] = useState("");
  const wide = useWideWorkspace();
  const Title = wide ? "h2" : DialogTitle;
  const Description = wide ? "p" : DialogDescription;
  const cursor = cursors.at(-1) || "";
  const uid = user?.uid;
  useEffect(() => {
    if (!uid || role !== "Admin") return;
    let stopped=false;
    const load = () => {void staffRequest<Page>(`/api/feedback?status=${encodeURIComponent(filter)}&cursor=${encodeURIComponent(cursor)}`,undefined,uid).then(page=>{if(!stopped){setState({...page,owner:uid});setError("");}}).catch(failure=>{if(!stopped)setError(failure instanceof Error?failure.message:"The feedback inbox could not be loaded.");}).finally(()=>{if(!stopped)setLoading(false);});};
    load();const interval=window.setInterval(load,45_000);return()=>{stopped=true;clearInterval(interval);};
  },[uid,role,filter,cursor,attempt]);
  const visible = state.owner===uid ? state.items.filter(item=>[item.message,item.residentName,item.barangay,item.category].some(value=>value.toLowerCase().includes(search.trim().toLowerCase()))) : [];
  const active = state.owner===uid ? state.items.find(item=>item.id===selected) : null;
  const refresh = () => {setLoading(true);setCursors([""]);setAttempt(n=>n+1);};
  async function update(status:string) {
    if(!active||busy)return;setBusy(true);setActionError("");
    try {await staffRequest("/api/feedback",{action:"update",id:active.id,status,expectedRevision:active.revision},uid);setSelected(null);refresh();}
    catch(failure){setActionError(failure instanceof Error?failure.message:"The review state could not be saved.");}finally{setBusy(false);}
  }
  return <div className="space-y-5"><DataState loading={loading} error={error||null} onRetry={refresh}/>
    <section className="tt-metric-strip"><KpiCard title="New feedback" value={state.owner===uid?String(state.newCount):"—"} subtitle="Waiting for MENRO review" icon={<Inbox/>}/><KpiCard title="Messages on this page" value={state.owner===uid?String(state.items.length):"—"} subtitle="Resident experiences and suggestions" icon={<MessageSquareText/>}/></section>
    <div className="tt-filter-bar"><div className="min-w-56 flex-1"><Input aria-label="Search this feedback page" placeholder="Search messages on this page…" value={search} onChange={e=>setSearch(e.target.value)}/></div><select aria-label="Feedback status" className="min-h-11 rounded-xl border bg-[#fffef8] px-4 text-sm" value={filter} onChange={e=>{setFilter(e.target.value);setCursors([""]);setSelected(null);setLoading(true);}}><option value="all">All feedback</option>{["New","Reviewed","Closed"].map(status=><option key={status}>{status}</option>)}</select><Button variant="outline" disabled={loading} onClick={refresh}><RefreshCw className="h-4 w-4"/>Refresh</Button></div>
    <div className="tt-calendar-workspace"><section className="tt-surface overflow-hidden"><div className="divide-y">{visible.map(item=><button key={item.id} type="button" disabled={busy} onClick={()=>{setSelected(item.id);setActionError("");}} className="flex min-h-28 w-full items-start gap-4 p-5 text-left hover:bg-[#edf3e8]" aria-pressed={selected===item.id}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#e6eddf] text-[#174c39]"><MessageSquareText className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{item.residentName} · {item.barangay}</strong><span className="tt-status">{item.status}</span></span><span className="mt-2 block line-clamp-2 text-sm text-[#526b5b]">{item.message}</span><small className="mt-2 block text-[#64736b]">{item.category} · {date(item.createdAt)}</small></span><ChevronRight className="mt-1 h-4 w-4 shrink-0"/></button>)}</div>{!loading&&!visible.length&&<p className="tt-empty">{search?"No messages match this page. Clear search or browse another page.":"No feedback here yet. Resident messages will appear after they send feedback from Help & Support."}</p>}
    <div className="tt-pagination"><span>Page {cursors.length} · Philippine time</span><div><Button variant="outline" disabled={loading||cursors.length===1||busy} onClick={()=>{setCursors(current=>current.slice(0,-1));setSelected(null);setLoading(true);}}><ChevronLeft className="h-4 w-4"/>Previous</Button><Button variant="outline" disabled={loading||!state.nextCursor||busy} onClick={()=>{if(state.nextCursor)setCursors(current=>[...current,state.nextCursor!]);setSelected(null);setLoading(true);}}>Next<ChevronRight className="h-4 w-4"/></Button></div></div></section>
    <DetailPanel wide={wide} dark busy={busy} open={!!active} onOpenChange={open=>{if(!open&&!busy)setSelected(null);}} label="Resident system feedback" empty={<div className="p-6"><MessageSquareText className="mb-5 h-8 w-8"/><h2>Every little improvement counts.</h2><p className="mt-3 text-sm leading-relaxed">Select a resident&apos;s message to review their experience with TrashTrack. Waste concerns continue through Reports.</p></div>}>{active&&<div className="space-y-5 p-6"><header><Title className="font-outfit text-2xl">A note from {active.residentName}.</Title><Description className="mt-2 text-sm">{active.barangay} · {date(active.createdAt)}</Description></header><span className="tt-status">{active.category} · {active.status}</span><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{active.message}</p><p className="break-all text-xs opacity-80">App {active.appVersion||"unspecified"} · Reference {active.id.slice(-12)}</p>{actionError&&<p role="alert" className="rounded-xl bg-[#fffef8] p-3 text-sm text-red-800">{actionError}</p>}{active.status!=="Closed"&&<div className="flex flex-wrap gap-3 border-t border-white/20 pt-5"><Button disabled={busy||active.status==="Reviewed"} variant="outline" onClick={()=>void update("Reviewed")}><Check className="h-4 w-4"/>Mark reviewed</Button><Button disabled={busy} onClick={()=>void update("Closed")}>{busy?"Saving…":"Close feedback"}</Button></div>}</div>}</DetailPanel></div>
  </div>;
}
