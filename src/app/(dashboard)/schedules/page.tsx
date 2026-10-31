"use client";

import { Search, CalendarDays, ChevronLeft, ChevronRight, Eye, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DetailPanel, useWideWorkspace } from "@/components/layout/DetailPanel";
import { useState, useEffect, useRef } from "react";
import { collection, doc, deleteDoc } from "firebase/firestore";
import { subscribeWithDeadline } from "@/lib/live-data";
import { DataState } from "@/components/ui/data-state";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { COLLECTION_STATUSES } from "@/lib/schedule-policy";
import { staffRequest } from "@/lib/staff-client";
import { scheduleOccursOn } from "@/lib/schedules";
import { BALETE_BARANGAYS } from "@/lib/barangay-geofence";
import { collectionTimeLabel, filterCollectionSchedules, type CollectionSchedule, type CollectionFilters } from "@/lib/collection-calendar";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, addMonths, addDays, isSameMonth, isSameDay } from "date-fns";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function SchedulesPage() {
  const wideDetails = useWideWorkspace();
  const DetailTitle = wideDetails ? "h2" : DialogTitle;
  const DetailDescription = wideDetails ? "p" : DialogDescription;
  const { role } = useAuth();
  const [schedules, setSchedules] = useState<CollectionSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [filters, setFilters] = useState<CollectionFilters>({ search: "", barangay: "all", day: "all", status: "all" });
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSchedule, setActiveSchedule] = useState<CollectionSchedule | null>(null);
  const [statusDraft, setStatusDraft] = useState("Active");
  const [statusNotes, setStatusNotes] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 10;
  const retryData = () => { setLoading(true); setDataError(null); setAttempt(value => value + 1); };
  useEffect(() => {
    if (role !== "Admin") return;
    return subscribeWithDeadline(collection(db, "schedules"), snapshot => {
      setSchedules(snapshot.docs.map(doc => { const data=doc.data();return { id:doc.id, barangay:typeof data.barangay==="string"?data.barangay:"All barangays",day:typeof data.day==="string"?data.day:"",date:typeof data.date==="string"?data.date:undefined,time:typeof data.time==="string"?data.time:"Time to be announced",status:typeof data.status==="string"?data.status:"Inactive",description:typeof data.description==="string"?data.description:undefined,statusNotes:typeof data.statusNotes==="string"?data.statusNotes:undefined,notes:typeof data.notes==="string"?data.notes:undefined }; }));setLoading(false);setDataError(null);
    }, error => { setDataError(error.message.includes("taking too long") ? error.message : "Unable to load schedules. Check your connection and retry.");setLoading(false); });
  }, [role, attempt]);
  useEffect(()=>{const scroller=calendarRef.current;if(!scroller||scroller.scrollWidth<=scroller.clientWidth)return;const selected=scroller.querySelector<HTMLElement>('.tt-week-date[aria-pressed="true"]');if(selected)scroller.scrollLeft=selected.getBoundingClientRect().left-scroller.getBoundingClientRect().left+scroller.scrollLeft-14;},[selectedDate,period,view]);
  const changeFilter = (key: keyof CollectionFilters, value: string) => { setFilters(current => ({ ...current, [key]: value }));setCurrentPage(1); };
  const filtered = filterCollectionSchedules(schedules, filters);
  const firstDay = period === "week" ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const lastDay = period === "week" ? addDays(firstDay, 6) : endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const occurs = (schedule: CollectionSchedule, day: Date) => scheduleOccursOn({ ...schedule, status: "Active" }, day);
  const selectedSchedules = filtered.filter(schedule => occurs(schedule, selectedDate));
  const listSchedules = view === "calendar" ? selectedSchedules : filtered;
  const totalPages = Math.max(1, Math.ceil(listSchedules.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const movePeriod = (direction: number) => { const date = period === "week" ? addDays(currentDate, direction * 7) : addMonths(currentDate, direction);setCurrentDate(date);setSelectedDate(date);setCurrentPage(1); };
  const openSchedule = (schedule: CollectionSchedule) => { if (savingStatus) return; setActiveSchedule(schedule);setStatusDraft(schedule.status);setStatusNotes(schedule.statusNotes || "");setStatusError(""); };
  const saveStatus = async () => {
    if (!activeSchedule || savingStatus) return;
    setSavingStatus(true);setStatusError("");
    try { await staffRequest("/api/schedules/manage", { id:activeSchedule.id,expectedStatus:activeSchedule.status,status:statusDraft,notes:statusNotes });setActiveSchedule(null); }
    catch (error) {setStatusError(error instanceof Error ? error.message : "Collection status could not be saved.");}
    finally {setSavingStatus(false);}
  };
  const handleDelete = async (schedule: CollectionSchedule) => {
    if (!confirm(`Delete the ${schedule.barangay} collection schedule?`)) return;
    setDeleting(schedule.id);
    try { await deleteDoc(doc(db, "schedules", schedule.id));setActiveSchedule(null); }
    catch { setDataError("The schedule could not be deleted. Please try again."); }
    finally { setDeleting(null); }
  };
  const metricValue = (number: number) => loading || dataError ? "—" : number;
  return <div>
    <DataState loading={loading} error={dataError} onRetry={retryData} />
    <section className="tt-metric-strip" aria-label="Collection summary">
      <KpiCard title="Active schedules" value={metricValue(schedules.filter(s => s.status.toLowerCase() === "active").length)} subtitle="Collection schedules" icon={<CalendarDays />} />
      <KpiCard title="Today’s collections" value={metricValue(schedules.filter(s => scheduleOccursOn(s, new Date())).length)} subtitle="Scheduled for today" icon={<CalendarDays />} />
      <KpiCard title="Upcoming" value={metricValue(schedules.filter(s => s.status.toLowerCase() === "active" && (!s.date || s.date >= format(new Date(), "yyyy-MM-dd"))).length)} subtitle="Active collections" icon={<CalendarDays />} />
      <KpiCard title="Barangays covered" value={metricValue(new Set(schedules.map(s => s.barangay)).size)} subtitle="Collection coverage" icon={<CalendarDays />} />
    </section>
    <div className="tt-filter-bar"><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input className="pl-9" aria-label="Search schedules" placeholder="Search schedules" value={filters.search} onChange={event => changeFilter("search", event.target.value)} /></div>
      <Select value={filters.barangay} onValueChange={value => changeFilter("barangay", value || "all")}><SelectTrigger aria-label="Filter by barangay" className="w-44"><SelectValue>{filters.barangay === "all" ? "All barangays" : filters.barangay}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All barangays</SelectItem>{BALETE_BARANGAYS.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select>
      <Select value={filters.day} onValueChange={value => changeFilter("day", value || "all")}><SelectTrigger aria-label="Filter by day" className="w-36"><SelectValue>{filters.day === "all" ? "All days" : filters.day.charAt(0).toUpperCase()+filters.day.slice(1)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All days</SelectItem>{weekdays.map(day => <SelectItem key={day} value={day.toLowerCase()}>{day}</SelectItem>)}</SelectContent></Select>
      <Select value={filters.status} onValueChange={value => changeFilter("status", value || "all")}><SelectTrigger aria-label="Filter by status" className="w-36"><SelectValue>{filters.status === "all" ? "All statuses" : filters.status.charAt(0).toUpperCase()+filters.status.slice(1)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{COLLECTION_STATUSES.map(status => <SelectItem key={status} value={status.toLowerCase()}>{status}</SelectItem>)}</SelectContent></Select>
      <div className="tt-tabs mb-0 border-0 p-0" aria-label="Schedule view"><button type="button" aria-pressed={view === "calendar"} onClick={() => { setView("calendar");setCurrentPage(1); }}>Calendar</button><button type="button" aria-pressed={view === "list"} onClick={() => { setView("list");setCurrentPage(1); }}>List</button></div>
    </div>
    <div className="tt-calendar-workspace"><section className="tt-surface overflow-hidden">
      {view === "calendar" && <><div className="tt-calendar-toolbar"><div><Button variant="ghost" size="icon" aria-label={`Previous ${period}`} onClick={() => movePeriod(-1)}><ChevronLeft /></Button><h2>{period === "week" ? `${format(firstDay, "d MMM")} – ${format(lastDay, "d MMM yyyy")}` : format(currentDate, "MMMM yyyy")}</h2><Button variant="ghost" size="icon" aria-label={`Next ${period}`} onClick={() => movePeriod(1)}><ChevronRight /></Button><Button variant="secondary" onClick={() => { const today = new Date();setCurrentDate(today);setSelectedDate(today);setCurrentPage(1); }}>Today</Button></div><div className="tt-tabs mb-0 border-0 p-0" aria-label="Calendar period"><button type="button" aria-pressed={period === "week"} onClick={() => setPeriod("week")}>Week</button><button type="button" aria-pressed={period === "month"} onClick={() => setPeriod("month")}>Month</button></div></div>
      <div ref={calendarRef} className="tt-week-scroll" role="region" aria-label="Collection calendar"><div className={period === "week" ? "tt-week-grid" : "tt-month-grid"}>
        {period === "month" && weekdays.map(day => <div key={day} className="tt-month-heading">{day.slice(0, 3)}</div>)}
        {days.map(day => <div key={day.toISOString()} className={period === "week" ? "tt-week-day" : `tt-month-day${isSameMonth(day, currentDate) ? "" : " is-muted"}`}><button type="button" className="tt-week-date" aria-label={format(day, "EEEE, d MMMM yyyy")} aria-pressed={isSameDay(day, selectedDate)} onClick={() => { setSelectedDate(day);setCurrentPage(1); }}><span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong></button>
          {filtered.filter(schedule => occurs(schedule, day)).map(schedule => <button type="button" key={schedule.id} className="tt-week-event" onClick={() => { setSelectedDate(day);openSchedule(schedule); }}><strong>{collectionTimeLabel(schedule.time)}</strong>{schedule.barangay}<small>{schedule.status}{schedule.description || schedule.notes ? ` · ${(schedule.description || schedule.notes || "").slice(0, 65)}` : ""}</small></button>)}
        </div>)}
      </div></div></>}
      <div className={view === "calendar" ? "tt-schedule-details" : "p-5"}><div className="tt-section-heading"><h2>{view === "calendar" ? format(selectedDate, "EEEE, d MMMM") : "Schedule list"}</h2><span className="text-[11px] text-muted-foreground">Collection times follow the posted schedule.</span></div>
        <div className="tt-table-scroll"><table className="w-full min-w-[570px] text-left"><thead><tr className="border-b"><th className="py-3 pr-4">Time</th><th className="py-3 pr-4">Barangay</th><th className="py-3 pr-4">Date / day</th><th className="py-3 pr-4">Status</th><th className="py-3 text-right">Actions</th></tr></thead><tbody>
          {listSchedules.slice((page - 1) * itemsPerPage, page * itemsPerPage).map(schedule => <tr key={schedule.id} className="border-b last:border-0"><td className="py-4 pr-4 font-medium">{collectionTimeLabel(schedule.time)}</td><td className="py-4 pr-4">{schedule.barangay}<p className="max-w-64 whitespace-pre-wrap break-words text-[11px] text-muted-foreground">{schedule.description?.trim() || schedule.notes?.trim()}</p></td><td className="py-4 pr-4">{schedule.date || schedule.day}</td><td className="py-4 pr-4"><span className="tt-status">{schedule.status}</span></td><td className="py-4"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" aria-label={`View ${schedule.barangay} schedule`} onClick={() => openSchedule(schedule)}><Eye /></Button><Button variant="ghost" size="icon" disabled={deleting !== null} aria-label={`Delete ${schedule.barangay} schedule`} onClick={() => void handleDelete(schedule)}><Trash2 className="text-red-700" /></Button></div></td></tr>)}
        </tbody></table></div>
        {!loading && !listSchedules.length && <p className="tt-empty">{view === "calendar" ? "No collections match this date and your filters." : "No schedules match your filters."}</p>}
      </div>
      <div className="tt-pagination"><span role="status">{listSchedules.length ? `Showing ${(page - 1) * itemsPerPage + 1}–${Math.min(page * itemsPerPage, listSchedules.length)} of ${listSchedules.length}` : "0 schedules"}</span><div><Button variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => setCurrentPage(page - 1)}><ChevronLeft /></Button><span className="self-center px-2">{page} / {totalPages}</span><Button variant="outline" aria-label="Next page" disabled={page >= totalPages} onClick={() => setCurrentPage(page + 1)}><ChevronRight /></Button></div></div>
    </section>
    <DetailPanel wide={wideDetails} dark busy={savingStatus} label="Collection details" empty={<div className="tt-calendar-day-summary"><h2>{format(selectedDate, "EEEE, d MMMM")}</h2><p>{selectedSchedules.length} scheduled collections</p>{selectedSchedules.map(schedule => <button type="button" key={schedule.id} className="tt-calendar-day-row w-full text-left" disabled={savingStatus} onClick={() => openSchedule(schedule)}><div><strong>{schedule.barangay}</strong><span>{collectionTimeLabel(schedule.time)}</span></div><Eye className="h-4 w-4" aria-hidden="true" /></button>)}<p className="mt-5">{selectedSchedules.length ? "Choose a collection to review its details and record an outcome." : "No collections match this date and your filters."}</p></div>} open={!!activeSchedule} onOpenChange={open => { if (!open && !savingStatus) setActiveSchedule(null); }}><div className="p-5"><DialogHeader><DetailTitle>{activeSchedule?.barangay} collection</DetailTitle><DetailDescription>Published collection schedule</DetailDescription></DialogHeader>{wideDetails && <button type="button" className="tt-text-link mt-4" disabled={savingStatus} onClick={() => setActiveSchedule(null)}>Back to selected day</button>}{activeSchedule && <dl className="grid grid-cols-[100px_1fr] gap-4 py-3 text-sm"><dt className="text-muted-foreground">Date / day</dt><dd>{activeSchedule.date || activeSchedule.day}</dd><dt className="text-muted-foreground">Time</dt><dd>{collectionTimeLabel(activeSchedule.time)}</dd><dt className="text-muted-foreground">Status</dt><dd>{activeSchedule.status}</dd><dt className="text-muted-foreground">Notes</dt><dd className="whitespace-pre-wrap break-words">{activeSchedule.description?.trim() || activeSchedule.notes?.trim() || "No additional notes."}</dd></dl>}{activeSchedule && <div className="space-y-4 border-t pt-4"><label className="block text-sm">Collection outcome<select aria-label="Collection outcome" value={statusDraft} disabled={savingStatus} onChange={event => setStatusDraft(event.target.value)} className="mt-2 w-full rounded-lg border p-2">{COLLECTION_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><label className="block text-sm">Outcome notes<textarea aria-label="Outcome notes" maxLength={2000} value={statusNotes} disabled={savingStatus} onChange={event => setStatusNotes(event.target.value)} className="mt-2 w-full rounded-lg border p-2" rows={3} /></label><p className="text-xs text-muted-foreground">Explain unfinished or failed collections so MENRO can arrange follow-up.</p>{statusError && <p role="alert" className="text-sm text-red-700">{statusError}</p>}<Button disabled={savingStatus} onClick={() => void saveStatus()}>{savingStatus ? "Saving…" : "Save collection status"}</Button></div>}</div></DetailPanel></div>
  </div>;
}
