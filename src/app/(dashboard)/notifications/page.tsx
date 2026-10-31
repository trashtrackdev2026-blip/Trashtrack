"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CalendarDays, 
  AlertTriangle, 
  Megaphone, 
  Calendar as CalendarIcon, 
  Search, 
  ChevronDown,
  Eye,
  MoreVertical,
  Plus,
  Check
} from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useState, useEffect } from "react";
import { collection, doc, deleteDoc } from "firebase/firestore";
import { subscribeWithDeadline } from "@/lib/live-data";
import { DataState } from "@/components/ui/data-state";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { staffRequest } from "@/lib/staff-client";
import { phoneDeliveryDue } from "@/lib/notification-publication";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  date?: string;
  recipients: string;
  push: boolean;
  pushStatus: string;
  createdAtMillis: number;
  pushStartedAtMillis?: number;
  pushNextRetryAt?: number;
  pushRetryable?: boolean;
}

export default function NotificationsPage() {
  const { role } = useAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retryData = () => { setLoading(true); setDataError(null); setAttempt(value => value + 1); };
  const [selectedNotif, setSelectedNotif] = useState<NotificationData | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filter State
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("category");
  const [status, setStatus] = useState("status");

  const filteredNotifications = notifications.filter((notif) => {
    const matchesSearch = notif.title.toLowerCase().includes(search.toLowerCase()) || notif.message.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "category" || notif.type.toLowerCase() === category;

    const matchesStatus = status === "status" || (status === "sent" ? !notif.push || notif.pushStatus === "queued" : status === "failed" ? notif.pushStatus === "failed" : notif.push && ["pending", "sending"].includes(notif.pushStatus));

    return matchesSearch && matchesCategory && matchesStatus;
  });

  useEffect(() => {
    if (role !== "Admin") return;
    return subscribeWithDeadline(collection(db, "notifications"), querySnapshot => {
      const notifs: NotificationData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const millis = (value: unknown): number => typeof value === "number" ? value :
          value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function" ? value.toMillis() : 0;
        const timestamp = millis(data.createdAt) || millis(data.timestamp);
        notifs.push({
          id: doc.id,
          title: data.title || "Notification",
          message: data.message || "",
          type: data.type || "general",
          isRead: data.isRead || false,
          recipients: data.recipients || "All Barangays", push: data.push === true, pushStatus: data.pushStatus || (data.push ? "pending" : "disabled"),
          createdAtMillis: timestamp, pushStartedAtMillis: millis(data.pushStartedAt),
          pushNextRetryAt: data.pushNextRetryAt, pushRetryable: data.pushRetryable,
          date: timestamp ? new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (data.date || "Recently")
        });
      });
      setNotifications(notifs.sort((a, b) => b.createdAtMillis - a.createdAtMillis));
      setLoading(false);
      setDataError(null);
    }, error => { setDataError(error.message.includes("taking too long") ? error.message : "Unable to load notifications. Check your connection and retry."); setLoading(false); });
  }, [role, attempt]);

  useEffect(() => {
    if (role !== "Admin") return;
    let disposed = false;
    let running = false;
    const resumeDelivery = async () => {
      if (running || !navigator.onLine) return;
      running = true;
      for (const notice of notifications.filter(item => phoneDeliveryDue(item)).slice(0, 3)) {
        if (disposed) break;
        try { await staffRequest("/api/notifications/send", { notificationId: notice.id }); }
        catch { /* Saved failures remain visible and eligible for the next retry. */ }
      }
      running = false;
    };
    const timer = window.setInterval(() => void resumeDelivery(), 30_000);
    const firstRetry = window.setTimeout(() => void resumeDelivery(), 1_500);
    window.addEventListener("online", resumeDelivery);
    // Let an in-progress publisher finish before starting an outbox retry.
    return () => { disposed = true; clearInterval(timer); clearTimeout(firstRetry); window.removeEventListener("online", resumeDelivery); };
  }, [role, notifications]);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this notification?")) {
      try {
        await deleteDoc(doc(db, "notifications", id));
      } catch (error) {
        console.error("Error deleting notification:", error);
      }
    }
  };
  const retryPhone = async (id: string) => {
    setRetrying(id); setDeliveryError("");
    try { await staffRequest("/api/notifications/send", { notificationId: id }); }
    catch (error) { setDeliveryError(error instanceof Error ? error.message : "Phone delivery could not be queued."); }
    finally { setRetrying(null); }
  };

  return (
    <>
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <DataState loading={loading} error={dataError} onRetry={retryData} />
        {deliveryError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{deliveryError}</p>}

        {/* Header */}
        <div className="tt-legacy-heading flex flex-col gap-2 mb-2">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Notifications</h1>
          <p className="text-sm text-slate-500">Create and manage notifications sent to residents.</p>
        </div>

        {/* KPI Cards */}
        <div className="tt-metric-strip">
          <KpiCard 
            title="Total Notifications" 
            value={notifications.length.toString()} 
            subtitle="All time" 
            icon={<CalendarIcon className="w-7 h-7" />} 
            iconBgColor="bg-[#E8F5E9]" 
            iconColor="text-[#2E7D32]" 
          />
          <KpiCard 
            title="Schedules & Alerts" 
            value={notifications.filter(n => n.type.toLowerCase() === 'schedule' || n.type.toLowerCase() === 'alert').length.toString()} 
            subtitle="System alerts" 
            icon={<CalendarDays className="w-7 h-7" />} 
            iconBgColor="bg-blue-50" 
            iconColor="text-blue-500" 
          />
          <KpiCard 
            title="Reports & Updates" 
            value={notifications.filter(n => n.type.toLowerCase() === 'report').length.toString()} 
            subtitle="Report status changes" 
            icon={<AlertTriangle className="w-7 h-7" />} 
            iconBgColor="bg-orange-50" 
            iconColor="text-orange-500" 
          />
          <KpiCard 
            title="General Messages" 
            value={notifications.filter(n => n.type.toLowerCase() !== 'report' && n.type.toLowerCase() !== 'schedule' && n.type.toLowerCase() !== 'alert').length.toString()} 
            subtitle="Community announcements" 
            icon={<Megaphone className="w-7 h-7" />} 
            iconBgColor="bg-purple-50" 
            iconColor="text-purple-500" 
          />
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mt-4">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search notifications..." 
                className="pl-9 h-11 bg-slate-50 border-slate-200" 
              />
            </div>

            <div className="flex gap-3">
              <Select value={category} onValueChange={(val) => { setCategory(val ?? "all"); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px] h-11 bg-white border-slate-200">
                  <SelectValue>{category === "category" ? "All categories" : category.charAt(0).toUpperCase()+category.slice(1)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Category (All)</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="alert">Alerts</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="event">Events</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={(val) => { setStatus(val ?? "all"); setCurrentPage(1); }}>
                <SelectTrigger className="w-[130px] h-11 bg-white border-slate-200">
                  <SelectValue>{status === "status" ? "All statuses" : status === "sent" ? "Sent" : status === "failed" ? "Phone failed" : "Phone pending"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Status (All)</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="pending">Phone pending</SelectItem>
                  <SelectItem value="failed">Phone failed</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="date">
                <SelectTrigger className="w-[120px] h-11 bg-white border-slate-200">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>


        </div>

        <nav className="tt-tabs" aria-label="Announcements"><Link href="/notifications" aria-current="page">Notification history</Link><Link href="/notifications/create">Compose notification</Link></nav>
        {/* Table Area */}
        <div className="tt-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700 w-1/3">Title</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700">Category</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700">Audience</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700">Date Sent</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-700 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNotifications.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((notif) => (
                  <tr key={notif.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 ${notif.type.toLowerCase() === 'report' ? 'bg-orange-50 text-orange-500' : notif.type.toLowerCase() === 'schedule' ? 'bg-blue-50 text-blue-500' : 'bg-[#E8F5E9] text-[#2E7D32]'}`}>
                          {notif.type.toLowerCase() === 'report' ? <AlertTriangle className="w-5 h-5" /> : notif.type.toLowerCase() === 'schedule' ? <CalendarDays className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm mb-1">{notif.title}</span>
                          <span className="text-[11px] text-slate-500 leading-snug line-clamp-2 max-w-sm">{notif.message}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap ${notif.type.toLowerCase() === 'report' ? 'text-orange-600 bg-orange-50' : notif.type.toLowerCase() === 'schedule' ? 'text-blue-600 bg-blue-50' : 'text-[#2E7D32] bg-[#E8F5E9]'}`}>
                        {notif.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-semibold text-slate-700">{notif.recipients}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-900">{notif.date || 'Recently'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full ${notif.isRead ? 'text-slate-500 bg-slate-100' : 'text-[#2E7D32] bg-[#E8F5E9]'}`}>
                        {!notif.push ? "In-app only" : notif.pushStatus === "queued" ? "Phone queued" : notif.pushStatus === "failed" ? "Phone failed" : "Phone pending"} <Check className="w-3 h-3" />
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        {notif.push && notif.pushStatus !== "queued" && <Button disabled={retrying !== null} variant="outline" size="sm" onClick={() => void retryPhone(notif.id)}>{retrying === notif.id ? "Queuing…" : "Retry phone delivery"}</Button>}
                        <Button 
                          onClick={() => setSelectedNotif(notif)} 
                          variant="outline" 
                          size="sm" 
                          className="h-8 border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-[#F1F8F5] hover:text-[#2E7D32] hover:border-green-200"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                        </Button>
                        <Button onClick={() => handleDelete(notif.id)} variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / itemsPerPage));
            const startItem = filteredNotifications.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
            const endItem = Math.min(currentPage * itemsPerPage, filteredNotifications.length);

            return (
              <div className="py-4 px-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-white gap-4">
                <span className="text-xs text-slate-500 font-medium">Showing {startItem} to {endItem} of {filteredNotifications.length} notifications</span>

                <div className="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="w-8 h-8 rounded-md border-slate-200 disabled:opacity-50"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
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
                        size="icon" 
                        className={`w-8 h-8 rounded-md border-slate-200 ${currentPage === pageNum ? 'bg-[#1B5E20] text-white border-[#1B5E20] hover:bg-[#2E7D32] hover:text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="text-slate-400 px-1">...</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="w-8 h-8 rounded-md border-slate-200 text-slate-600 hover:bg-slate-50"
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}

                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="w-8 h-8 rounded-md border-slate-200 disabled:opacity-50"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    <ChevronDown className="w-4 h-4 -rotate-90" />
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* View Notification Modal */}
      <Dialog open={selectedNotif !== null} onOpenChange={open => { if (!open) setSelectedNotif(null); }}>
      {selectedNotif && (
          <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 gap-0 bg-white">

            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <DialogTitle className="text-lg font-bold text-slate-900">Notification Details</DialogTitle>
              <DialogDescription className="sr-only">Saved notification sent to {selectedNotif.recipients}</DialogDescription>
            </div>

            <div className="p-8 flex flex-col gap-6">

              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${selectedNotif.type.toLowerCase() === 'report' ? 'bg-orange-50 text-orange-500' : selectedNotif.type.toLowerCase() === 'schedule' ? 'bg-blue-50 text-blue-500' : 'bg-[#E8F5E9] text-[#2E7D32]'}`}>
                  {selectedNotif.type.toLowerCase() === 'report' ? <AlertTriangle className="w-6 h-6" /> : selectedNotif.type.toLowerCase() === 'schedule' ? <CalendarDays className="w-6 h-6" /> : <Megaphone className="w-6 h-6" />}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 text-lg mb-1">{selectedNotif.title}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${selectedNotif.type.toLowerCase() === 'report' ? 'text-orange-600 bg-orange-50' : selectedNotif.type.toLowerCase() === 'schedule' ? 'text-blue-600 bg-blue-50' : 'text-[#2E7D32] bg-[#E8F5E9]'}`}>
                      {selectedNotif.type}
                    </span>
                    <span className="text-xs text-slate-500">{selectedNotif.date}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedNotif.message}</p>
              </div>

              <div className="flex w-full mt-2">
                <Button 
                  onClick={() => setSelectedNotif(null)}
                  className="w-full h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm"
                >
                  Close
                </Button>
              </div>

            </div>
          </DialogContent>
      )}
      </Dialog>
    </>
  );
}

// Custom icon component for the table
function FileTextIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}
