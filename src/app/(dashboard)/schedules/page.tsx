"use client";

import { Search, Calendar, Plus, ChevronLeft, ChevronRight, PenSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

import { useState, useEffect } from "react";
import { collection, doc, deleteDoc } from "firebase/firestore";
import { subscribeWithDeadline } from "@/lib/live-data";
import { DataState } from "@/components/ui/data-state";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { scheduleOccursOn } from "@/lib/schedules";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, addMonths, subMonths, isSameMonth, isToday } from "date-fns";

interface Schedule {
  id: string;
  barangay: string;
  day: string;
  date?: string;
  time: string;
  status: string;
}

export default function SchedulesPage() {
  const { role } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retryData = () => { setLoading(true); setDataError(null); setAttempt(value => value + 1); };
  const [currentDate, setCurrentDate] = useState(new Date());

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  useEffect(() => {
    if (role !== "Admin") return;
    return subscribeWithDeadline(collection(db, "schedules"), snapshot => {
      setSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Schedule));
      setLoading(false);
      setDataError(null);
    }, error => {
      setDataError(error.message.includes("taking too long") ? error.message : "Unable to load schedules. Check your connection and retry.");
      setLoading(false);
    });
  }, [role, attempt]);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      try {
        await deleteDoc(doc(db, "schedules", id));
      } catch (error) {
        console.error("Error deleting schedule:", error);
      }
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <DataState loading={loading} error={dataError} onRetry={retryData} />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Collection Schedules</h1>
            <p className="text-sm text-slate-500 mt-0.5">Create, update, publish, and monitor waste collection schedules.</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard 
            title="Total Active Schedules" 
            value={schedules.filter(s => s.status === 'Active').length.toString()} 
            subtitle="Collection schedules" 
            icon={<Calendar className="w-7 h-7" />} 
            iconBgColor="bg-[#E8F5E9]" 
            iconColor="text-[#2E7D32]" 
          />
          <KpiCard 
            title="Today's Collections" 
            value={schedules.filter(s => scheduleOccursOn(s, new Date())).length.toString()} 
            subtitle="Scheduled for today" 
            icon={<Calendar className="w-7 h-7" />} 
            iconBgColor="bg-blue-50" 
            iconColor="text-blue-500" 
          />
          <KpiCard 
            title="Upcoming Collections" 
            value={schedules.filter(s => s.status === "Active" && (!s.date || s.date >= format(new Date(), "yyyy-MM-dd"))).length.toString()} 
            subtitle="Upcoming active collections" 
            icon={<Calendar className="w-7 h-7" />} 
            iconBgColor="bg-orange-50" 
            iconColor="text-orange-500" 
          />
          <KpiCard 
            title="Total Barangays" 
            value={new Set(schedules.map(s => s.barangay)).size.toString()} 
            subtitle="Covered barangays" 
            icon={<Calendar className="w-7 h-7" />} 
            iconBgColor="bg-purple-50" 
            iconColor="text-purple-500" 
          />
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search schedule..." 
                className="pl-9 bg-white border-slate-200 rounded-xl h-9 text-sm focus-visible:ring-1 focus-visible:ring-[#2E7D32] transition-colors"
              />
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
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Collection Day</span>
              <Select defaultValue="all">
                <SelectTrigger className="w-[140px] bg-white border-slate-200 rounded-xl h-9 text-sm">
                  <SelectValue placeholder="All Days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Days</SelectItem>
                  <SelectItem value="monday">Monday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 ml-1">Status</span>
              <Select defaultValue="all">
                <SelectTrigger className="w-[140px] bg-white border-slate-200 rounded-xl h-9 text-sm">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col justify-end pt-[20px]">
            <Link href="/schedules/create">
              <Button className="h-9 px-4 bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl shadow-sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Create Schedule
              </Button>
            </Link>
          </div>
        </div>

        {/* 2 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
          
          {/* Calendar View */}
          <div>
            <h2 className="font-bold text-slate-900 mb-4">Calendar View</h2>
            <div className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden p-4">
              <div className="flex items-center justify-between mb-4">
                <Button onClick={prevMonth} variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-bold text-slate-800">{format(currentDate, 'MMMM yyyy')}</span>
                <Button onClick={nextMonth} variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
                    {day}
                  </div>
                ))}
                
                {calendarDays.map((day, idx) => {
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isTodayDate = isToday(day);
                  
                  const daySchedules = schedules.filter(s => scheduleOccursOn(s, day));

                  return (
                    <div key={idx} className={`h-24 p-1 border-t border-slate-100 flex flex-col ${!isCurrentMonth ? 'bg-slate-50/50' : isTodayDate ? 'bg-green-50/30' : ''}`}>
                      <span className={`text-sm font-medium p-1 ${!isCurrentMonth ? 'text-slate-300' : isTodayDate ? 'text-[#2E7D32] font-bold' : 'text-slate-800'}`}>
                        {format(day, 'd')}
                      </span>
                      <div className="flex-1 overflow-y-auto mt-1 space-y-1 scrollbar-hide">
                        {daySchedules.map(schedule => (
                          <div key={schedule.id} className="bg-[#2E7D32] text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm leading-tight truncate" title={`${schedule.barangay} - ${schedule.time}`}>
                            <span className="font-bold">{schedule.barangay}</span>
                            <span className="block opacity-80">{schedule.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-500 mt-4">Dated collections appear once. Older weekly schedules repeat on their collection days.</p>
            </div>
          </div>

          {/* Schedule List */}
          <div className="flex flex-col h-full">
            <h2 className="font-bold text-slate-900 mb-4">Schedule List</h2>
            <div className="flex-1 bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] font-semibold text-slate-500 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
                    <tr>
                      <th className="py-4 px-6 rounded-tl-2xl">Barangay</th>
                      <th className="py-4 px-4">Collection Day</th>
                      <th className="py-4 px-4">Start Time</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-6 text-right rounded-tr-2xl">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Loading schedules...</td></tr>}
                    {schedules.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((schedule) => (
                      <tr key={schedule.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3 px-6 font-medium text-slate-800">{schedule.barangay}</td>
                        <td className="py-3 px-4 font-medium text-slate-600">{schedule.date || schedule.day}</td>
                        <td className="py-3 px-4 font-medium text-slate-600">{schedule.time}</td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-bold text-[#2E7D32]">
                            {schedule.status}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-[#2E7D32] hover:bg-green-50 rounded-md transition-colors">
                              <PenSquare className="w-4 h-4" />
                            </Button>
                            <Button onClick={() => handleDelete(schedule.id)} variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
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
                const totalPages = Math.max(1, Math.ceil(schedules.length / itemsPerPage));
                const startItem = schedules.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
                const endItem = Math.min(currentPage * itemsPerPage, schedules.length);
                
                return (
                  <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between mt-auto gap-4">
                    <span className="text-xs text-slate-500">Showing {startItem} to {endItem} of {schedules.length} schedules</span>
                    
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
                  </div>
                );
              })()}
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
