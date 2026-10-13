"use client";

import { Users, Search, MapPin, Calendar, CalendarCheck, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, MoreVertical, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Image from "next/image";
import Link from "next/link";

import { useState, useEffect } from "react";
import { collection, deleteDoc, doc, query, where } from "firebase/firestore";
import { subscribeWithDeadline } from "@/lib/live-data";
import { DataState } from "@/components/ui/data-state";
import { db } from "@/lib/firebase";
import { eventRequest } from "@/lib/event-client";
import { EventCertificateSettings } from "@/components/events/EventCertificateSettings";
import { CertificatePreview } from "@/components/events/CertificatePreview";
import { AttendanceQr } from "@/components/events/AttendanceQr";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Trash2 } from "lucide-react";

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
      setActiveEventId(current => eventsList.some(event => event.id === current) ? current : eventsList[0]?.id ?? null);

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
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <>
      {certificatePreview && <CertificatePreview data={certificatePreview} onClose={() => setCertificatePreview(null)} />}
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <DataState loading={loading} error={dataError} onRetry={retryData} />
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Table Area */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            
            {/* Filters Bar */}
            <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64 shrink-0 mt-5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search events..." 
                    className="pl-9 bg-slate-50 border-none rounded-xl h-9 text-sm focus-visible:ring-1 focus-visible:ring-[#2E7D32] focus-visible:bg-white transition-colors"
                  />
                </div>
                
                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Status</span>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[120px] bg-white border-slate-200 rounded-xl h-9 text-sm">
                      <SelectValue placeholder="All Status" />
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
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[140px] bg-white border-slate-200 rounded-xl h-9 text-sm">
                      <SelectValue placeholder="All Barangays" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Barangays</SelectItem>
                      <SelectItem value="poblacion">Poblacion</SelectItem>
                      <SelectItem value="makina">Makina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Date Range</span>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[120px] bg-white border-slate-200 rounded-xl h-9 text-sm">
                      <SelectValue placeholder="All Time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="this-month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col justify-end pt-[20px]">
                <Link href="/events/create">
                  <Button className="h-9 px-4 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl shadow-sm">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create Event
                  </Button>
                </Link>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-6">Event Title</th>
                    <th className="py-3 px-4">Barangay</th>
                    <th className="py-3 px-4">Date & Time <span className="inline-block ml-1">↑</span></th>
                    <th className="py-3 px-4">Participants</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((event) => (
                    <tr key={event.id} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors ${activeEvent?.id === event.id ? 'bg-[#E8F5E9]/30' : ''}`}>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-10 rounded overflow-hidden relative shrink-0">
                            <Image src={event.img} alt={event.title} fill className="object-cover" />
                          </div>
                          <span className="font-bold text-slate-800 line-clamp-2 max-w-[150px] leading-tight">{event.title}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-600 font-medium">{event.barangay}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-slate-800 font-medium">{event.date}</span>
                          <span className="text-[10px] text-slate-500">{event.time}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center text-slate-700 font-medium">
                          <Users className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          {event.participants}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          event.status === 'Completed' ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-blue-50 text-blue-500'
                        }`}>
                          {event.status}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            onClick={() => handleView(event)}
                            variant="outline" size="sm" className={`h-7 px-3 text-xs rounded-lg ${activeEvent?.id === event.id ? 'text-white bg-[#2E7D32] border-[#2E7D32]' : event.status.toLowerCase() === 'upcoming' ? 'text-blue-600 border-blue-200 hover:bg-blue-50' : 'text-[#2E7D32] border-green-200 hover:bg-[#E8F5E9]'}`}>
                            View
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none">
                              <MoreVertical className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="cursor-pointer" onClick={() => alert("Edit coming soon!")}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={() => handleDeleteEvent(event.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {(() => {
              const totalPages = Math.max(1, Math.ceil(events.length / itemsPerPage));
              const startItem = events.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
              const endItem = Math.min(currentPage * itemsPerPage, events.length);
              
              return (
                <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="text-xs text-slate-500">Showing {startItem} to {endItem} of {events.length} events</span>
                  
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
          {activeEvent && (
          <div className="w-full lg:w-[320px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-900">Event Details</h3>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${activeEvent.status.toLowerCase() === 'completed' ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-blue-50 text-blue-500'}`}>{activeEvent.status}</span>
                {activeEvent.status.toLowerCase() !== 'completed' && (
                  <Button onClick={handleMarkCompleted} disabled={loadingParticipants || busyAttendance !== null} size="sm" variant="outline" className="h-6 text-[10px] px-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                    Mark Completed
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="w-20 h-20 rounded-lg overflow-hidden relative shrink-0">
                 <Image src={activeEvent.img} alt={activeEvent.title} fill className="object-cover" />
              </div>
              <div className="flex flex-col">
                <h4 className="font-bold text-slate-800 text-sm leading-tight mb-1">{activeEvent.title}</h4>
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
            
          </div>
          )}
        </div>
      </div>
    </>
  );
}
