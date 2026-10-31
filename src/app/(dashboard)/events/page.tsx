"use client";

import { Users, Search, MapPin, Calendar, CalendarCheck, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, MoreVertical, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from "next/image";

import { useState, useEffect } from "react";
import { collection, deleteDoc, doc, query, where } from "firebase/firestore";
import { subscribeWithDeadline } from "@/lib/live-data";
import { DataState } from "@/components/ui/data-state";
import { db } from "@/lib/firebase";
import { eventRequest } from "@/lib/event-client";
import { EventCertificateSettings } from "@/components/events/EventCertificateSettings";
import { CertificatePreview } from "@/components/events/CertificatePreview";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EditEventDialog, type EditableEvent } from "@/components/events/EditEventDialog";
import { Pencil } from "lucide-react";
import { AttendanceQr } from "@/components/events/AttendanceQr";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2 } from "lucide-react";

interface EventData {
  id: string;
  title: string;
  barangay: string;
  date: string;
  time: string;
  participants: number;
  status: string;
  img: string;
  description: string;
  dateISO?: string;
  certificateEnabled?: boolean;
  certificateSignatory?: string;
  certificatePosition?: string;
  certificateOrganizer?: string;
  attendanceMethod?: string;
}

export default function EventsPage() {
  const { role } = useAuth();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retryData = () => { setLoading(true); setDataError(null); setAttempt(value => value + 1); };
  const [editingEvent, setEditingEvent] = useState<EditableEvent | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<{id: string; userId: string; userName: string; barangay: string; registeredAt: number; attended: boolean}[]>([]);
  const [participantsEventId, setParticipantsEventId] = useState<string | null>(null);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [participantsAttempt, setParticipantsAttempt] = useState(0);
  const loadingParticipants = activeEventId !== participantsEventId || !!participantsError;
  const [actionError, setActionError] = useState("");
  const [busyAttendance, setBusyAttendance] = useState<string | null>(null);
  const [downloadingCertificate, setDownloadingCertificate] = useState<string | null>(null);
  const [certificatePreview, setCertificatePreview] = useState<Record<string, unknown> | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const filteredEvents = events.filter(event => (!search.trim() || [event.title,event.barangay,event.description || ""].some(value => value.toLowerCase().includes(search.trim().toLowerCase())))
    && (statusFilter === "all" || event.status.toLowerCase() === statusFilter)
    && (barangayFilter === "all" || event.barangay === barangayFilter)
    && (dateFilter === "all" || (event.dateISO || event.date || "").slice(0,7) === new Date().toISOString().slice(0,7)));
  // Derive activeEvent from the live events list so it always reflects real-time data
  const activeEvent = events.find(e => e.id === activeEventId) ?? null;


  useEffect(() => {
    if (role !== "Admin") return;
    // Real-time listener so participant counts update instantly when residents register
    const unsubscribe = subscribeWithDeadline(collection(db, "events"), (querySnapshot) => {
      const eventsList: EventData[] = [];
      querySnapshot.forEach((doc) => {
        eventsList.push({ id: doc.id, ...doc.data() } as EventData);
      });
      setEvents(eventsList);
      setLoading(false); setDataError(null);
      setActiveEventId(current => eventsList.some(event => event.id === current) ? current : null);

    }, (error) => {
      setLoading(false); setDataError(error.message.includes("taking too long") ? error.message : "Unable to load events. Check your connection and retry.");

    });
    return () => unsubscribe();
  }, [role, attempt]);

  // Fetch participants in real-time whenever the selected event changes
  useEffect(() => {
    if (!activeEventId || role !== "Admin") return;
    const q = query(collection(db, "registrations"), where("eventId", "==", activeEventId));
    const unsub = subscribeWithDeadline(q, (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        userId: d.data().userId || "",
        userName: d.data().userName ?? "Unknown",
        barangay: d.data().barangay ?? "-",
        registeredAt: d.data().registeredAt ?? 0,
        attended: d.data().attended === true && typeof d.data().attendanceVerifiedBy === "string" && !!d.data().attendanceVerifiedBy.trim(),
      }));
      list.sort((a, b) => b.registeredAt - a.registeredAt);
      setParticipants(list);
      setParticipantsEventId(activeEventId);
      setParticipantsError(null);
    }, error => { setParticipantsError(error.message.includes("taking too long") ? error.message : "Unable to load attendance. Check your connection and retry."); });
    return () => unsub();
  }, [activeEventId, role, participantsAttempt]);

  const handleToggleAttendance = async (registrationId: string, currentStatus: boolean) => {
    setBusyAttendance(registrationId);
    setActionError("");
    try {
      await eventRequest("/api/events/manage", { action: "attendance", registrationId, attended: !currentStatus });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Attendance could not be saved.");
    } finally { setBusyAttendance(null); }
  };

  const handleMarkCompleted = async () => {
    if (!activeEventId) return;
    const confirmed = participants.filter(participant => participant.attended).length;
    if (!confirm("Complete this event? " + confirmed + " participant(s) have confirmed attendance. Anyone still unconfirmed must scan the event QR or have MENRO confirm attendance before downloading a certificate.")) return;
    try {
      await eventRequest("/api/events/manage", { action: "complete", eventId: activeEventId });
      alert("Event completed. Certificates are available only to participants whose attendance you confirmed.");
    } catch (error) {
      console.error("Error completing event:", error);
      setActionError(error instanceof Error ? error.message : "Failed to mark event as completed.");
    }
  };

  const downloadAttendeeCertificate = async (userId: string, name: string) => {
    if (!activeEventId) return;
    setDownloadingCertificate(userId); setActionError("");
    try {
      const response = await eventRequest("/api/certificates", { eventId: activeEventId, userId });
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "TrashTrack-Certificate-" + name.replace(/[^A-Za-z0-9 _-]/g, "").slice(0, 45) + ".pdf";
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setActionError(error instanceof Error ? error.message : "Certificate could not be downloaded."); }
    finally { setDownloadingCertificate(null); }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await deleteDoc(doc(db, "events", eventId));
      if (activeEventId === eventId) {
        setActiveEventId(current => current === eventId ? null : current);
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Failed to delete event.");
    }
  };

  const handleView = (event: EventData) => {
    setActiveEventId(event.id);

  };

  return (
    <>
      {certificatePreview && <CertificatePreview data={certificatePreview} onClose={() => setCertificatePreview(null)} />}
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <DataState loading={loading} error={dataError} onRetry={retryData} />

        {/* KPI Cards */}
        <div className="tt-metric-strip">
          <KpiCard 
            title="Total Events" 
            value={events.length.toString()} 
            subtitle="All community events" 
            icon={<CalendarCheck className="w-7 h-7" />} 
            iconBgColor="bg-[#E8F5E9]" 
            iconColor="text-[#2E7D32]" 
          />
          <KpiCard 
            title="Upcoming Events" 
            value={events.filter(e => e.status.toLowerCase() === 'upcoming').length.toString()} 
            subtitle="Scheduled events" 
            icon={<Calendar className="w-7 h-7" />} 
            iconBgColor="bg-blue-50" 
            iconColor="text-blue-500" 
          />
          <KpiCard 
            title="Ongoing Events" 
            value={events.filter(e => e.status.toLowerCase() === 'ongoing').length.toString()} 
            subtitle="Currently ongoing" 
            icon={<CalendarClock className="w-7 h-7" />} 
            iconBgColor="bg-purple-50" 
            iconColor="text-purple-500" 
          />
          <KpiCard 
            title="Completed Events" 
            value={events.filter(e => e.status.toLowerCase() === 'completed').length.toString()} 
            subtitle="Successfully completed" 
            icon={<CheckCircle2 className="w-7 h-7" />} 
            iconBgColor="bg-[#E8F5E9]" 
            iconColor="text-[#2E7D32]" 
          />
        </div>

        <div className="min-w-0">
          {/* Main Table Area */}
          <div className="flex-1 tt-surface overflow-hidden flex flex-col">

            {/* Filters Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64 shrink-0 mt-5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search events" aria-label="Search events" value={search} onChange={event => { setSearch(event.target.value);setCurrentPage(1); }}
                    className="pl-9 bg-slate-50 border-none rounded-xl h-9 text-sm focus-visible:ring-1 focus-visible:ring-[#2E7D32] focus-visible:bg-white transition-colors"
                  />
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Status</span>
                  <Select value={statusFilter} onValueChange={value => { setStatusFilter(value || "all");setCurrentPage(1); }}>
                    <SelectTrigger className="w-[120px] bg-white border-slate-200 rounded-xl h-9 text-sm">
                      <SelectValue>{statusFilter === "all" ? "All statuses" : statusFilter.charAt(0).toUpperCase()+statusFilter.slice(1)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Barangay</span>
                  <Select value={barangayFilter} onValueChange={value => { setBarangayFilter(value || "all");setCurrentPage(1); }}>
                    <SelectTrigger className="w-[140px] bg-white border-slate-200 rounded-xl h-9 text-sm">
                      <SelectValue>{barangayFilter === "all" ? "All barangays" : barangayFilter}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Barangays</SelectItem>
                      {[...new Set(events.map(event => event.barangay))].filter(Boolean).sort().map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Date Range</span>
                  <Select value={dateFilter} onValueChange={value => { setDateFilter(value || "all");setCurrentPage(1); }}>
                    <SelectTrigger className="w-[120px] bg-white border-slate-200 rounded-xl h-9 text-sm">
                      <SelectValue>{dateFilter === "all" ? "All time" : "This month"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="this-month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col justify-end pt-[20px]">

              </div>
            </div>

            {/* Table */}
            <div className="tt-event-agenda">
                {filteredEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(event => { const raw=event.dateISO || event.date;const date=new Date(raw + (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? "T12:00:00" : ""));const valid=!Number.isNaN(date.getTime());return <article key={event.id} className={"tt-event-row" + (activeEvent?.id === event.id ? " is-selected" : "")}>
                  <div className="tt-date-block"><strong>{valid ? date.getDate().toString().padStart(2,"0") : "—"}</strong><span>{valid ? date.toLocaleDateString("en-PH",{month:"short"}) : "Event"}</span></div>
                  <button type="button" className="tt-event-main" onClick={() => handleView(event)} aria-pressed={activeEvent?.id === event.id}><strong>{event.title}</strong><small>{event.barangay}<br />{event.date} · {event.time}<br />{event.participants || 0} registered · {event.status}</small></button>
                  <div className="tt-event-row-actions"><Button variant="outline" onClick={() => handleView(event)} aria-label={"View " + event.title}>View</Button><DropdownMenu><DropdownMenuTrigger className="tt-icon-control" aria-label={"Actions for " + event.title}><MoreVertical /></DropdownMenuTrigger><DropdownMenuContent align="end">{event.status.toLowerCase() !== "completed" && <DropdownMenuItem onClick={() => setEditingEvent(event)}><Pencil />Edit event</DropdownMenuItem>}<DropdownMenuItem className="text-red-700" onClick={() => void handleDeleteEvent(event.id)}><Trash2 />Delete event</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
                </article>;})}
                {!loading && filteredEvents.length === 0 && <p className="tt-empty">No events match your filters.</p>}
              </div>

            {/* Pagination */}
            {(() => {
              const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
              const startItem = filteredEvents.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
              const endItem = Math.min(currentPage * itemsPerPage, filteredEvents.length);

              return (
                <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">Showing {startItem} to {endItem} of {filteredEvents.length} events</span>

                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="w-7 h-7 rounded-md border-slate-200 text-slate-500 disabled:opacity-50" 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </Button>

                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = currentPage;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;

                      return (
                        <Button 
                          key={pageNum}
                          variant="outline" 
                          size="sm" 
                          className={`w-7 h-7 rounded-md border-slate-200 ${currentPage === pageNum ? 'bg-[#2E7D32] text-white border-[#2E7D32]' : 'text-slate-600 hover:bg-slate-50'}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}

                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <>
                        <span className="px-1 text-slate-400">...</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-7 h-7 rounded-md border-slate-200 text-slate-600 hover:bg-slate-50"
                          onClick={() => setCurrentPage(totalPages)}
                        >
                          {totalPages}
                        </Button>
                      </>
                    )}

                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="w-7 h-7 rounded-md border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    >
                      <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 hidden sm:flex">
                    <Select 
                      value={itemsPerPage.toString()} 
                      onValueChange={(val) => {
                        setItemsPerPage(Number(val));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[100px] bg-white border-slate-200 rounded-lg h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 per page</SelectItem>
                        <SelectItem value="10">10 per page</SelectItem>
                        <SelectItem value="25">25 per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right Panel: Event Details */}
          <Dialog open={!!activeEvent} onOpenChange={open => { if (!open) setActiveEventId(null); }}>
          {activeEvent && (
          <DialogContent id="event-detail" className="sm:max-w-3xl">
            <DialogDescription className="sr-only">Event information, attendance and certificates.</DialogDescription>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 pr-8">
              <DialogTitle className="font-bold text-lg text-slate-900">Event Details</DialogTitle>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${activeEvent.status.toLowerCase() === 'completed' ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-blue-50 text-blue-500'}`}>{activeEvent.status}</span>
                {activeEvent.status.toLowerCase() !== 'completed' && (
                  <Button onClick={handleMarkCompleted} disabled={loadingParticipants || busyAttendance !== null} size="sm" variant="outline" className="h-6 text-[10px] px-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                    Mark Completed
                  </Button>
                )}
              </div>
            </div>

            <div className="mb-6 flex flex-col gap-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-xl">
                 <Image src={activeEvent.img} alt={activeEvent.title} fill className="object-cover" />
              </div>
              <div className="flex flex-col">
                <h4 className="mb-2 font-outfit text-xl font-semibold leading-tight text-slate-800">{activeEvent.title}</h4>
                <p className="text-[10px] text-slate-500 leading-tight">{activeEvent.description}</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <h5 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Event Information</h5>

              <div className="flex gap-3 items-start">
                <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Date & Time</span>
                  <span className="text-xs font-medium text-slate-800">{activeEvent.date} • {activeEvent.time}</span>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Location</span>
                  <span className="text-xs font-medium text-slate-800">{activeEvent.barangay}</span>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Organized By</span>
                  <span className="text-xs font-medium text-slate-800">MENRO Department</span>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Participants</span>
                  <span className="text-xs font-medium text-slate-800">{activeEvent.participants} recorded</span>
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <AttendanceQr key={activeEvent.id} eventId={activeEvent.id} method={activeEvent.attendanceMethod} />

              <div className="bg-green-50 p-3 rounded-lg flex items-start gap-2 border border-green-100/50">
                <div className="w-4 h-4 rounded-full bg-[#2E7D32] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold">i</span>
                </div>
                <p className="text-[10px] text-[#2E7D32] leading-tight">Attendance is confirmed by scanning the event QR or by MENRO below. Completed participants with unconfirmed attendance see a pending certificate in the phone.</p>
              </div>
            </div>
            <EventCertificateSettings key={activeEvent.id} event={activeEvent} onPreview={setCertificatePreview} />
            {actionError && <p role="alert" className="mt-3 text-xs text-red-700">{actionError}</p>}
            <div className="mt-6">
              <h5 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                Participants
                <span className="ml-auto text-[10px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-bold">{participants.length}</span>
              </h5>
              {participantsError ? <DataState loading={false} error={participantsError} onRetry={() => { setParticipantsError(null); setParticipantsEventId(null); setParticipantsAttempt(value => value + 1); }} /> : loadingParticipants ? (
                <div className="text-xs text-slate-400 text-center py-4">Loading...</div>
              ) : participants.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No participants registered yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="py-2 px-3 text-left font-bold text-slate-600">Name</th>
                        <th className="py-2 px-3 text-left font-bold text-slate-600">Barangay</th>
                        <th className="py-2 px-3 text-center font-bold text-slate-600">Attended</th>
                        <th className="py-2 px-3 text-center font-bold text-slate-600">Certificate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {participants.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 font-semibold text-slate-800">{p.userName}</td>
                          <td className="py-2 px-3 text-slate-500">{p.barangay || "-"}</td>
                          <td className="py-2 px-3 text-center">
                            <input 
                              type="checkbox" 
                              checked={p.attended}
                              disabled={busyAttendance !== null}
                              onChange={() => handleToggleAttendance(p.id, p.attended)}
                              className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Button variant="ghost" size="icon" aria-label={"Download certificate for " + p.userName}
                              disabled={!p.attended || !p.userId || activeEvent.status !== "Completed" || activeEvent.certificateEnabled === false || downloadingCertificate !== null}
                              onClick={() => downloadAttendeeCertificate(p.userId, p.userName)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </DialogContent>
          )}
          </Dialog>
        </div>
      </div>
      {editingEvent && <EditEventDialog key={editingEvent.id} event={editingEvent} onClose={() => setEditingEvent(null)} />}
    </>
  );
}
