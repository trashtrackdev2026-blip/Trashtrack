"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarDays, AlertTriangle, Clock, Bell, CalendarCheck, FileText, FileBarChart, Info, AlertCircle, Calendar, Megaphone } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { withTimeout } from "@/lib/request-timeout";
import { scheduleOccursOn } from "@/lib/schedules";
import { DataState } from "@/components/ui/data-state";

export default function Dashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSchedules: 0,
    pendingReports: 0,
    unresolvedIssues: 0,
    recentNotifications: 0,
    upcomingEvents: 0,
  });
  const [todaySchedules, setTodaySchedules] = useState<{id: string, barangay: string, time: string, status: string}[]>([]);

  useEffect(() => {
    if (authLoading || !user || role !== "Admin") return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true); setError(null);
      try {
        const [usersCount, schedulesSnap, reportsCount, pendingCount, resolvedCount, notificationsCount, eventsCount] = await withTimeout(Promise.all([
          getCountFromServer(collection(db, "users")),
          getDocs(collection(db, "schedules")),
          getCountFromServer(collection(db, "reports")),
          getCountFromServer(query(collection(db, "reports"), where("status", "in", ["Pending", "pending"]))),
          getCountFromServer(query(collection(db, "reports"), where("status", "in", ["Resolved", "resolved"]))),
          getCountFromServer(collection(db, "notifications")),
          getCountFromServer(query(collection(db, "events"), where("status", "in", ["Upcoming", "upcoming", "UPCOMING"]))),
        ]), "Dashboard data is taking too long. Check the internet connection and retry.", 15_000);
        if (cancelled) return;
        const today = new Date();
        const todays = schedulesSnap.docs.filter(doc => {
          const data = doc.data();
          return scheduleOccursOn({ day: data.day || "", status: data.status || "", date: data.date }, today);
        });
        setTodayCount(todays.length);
        setStats({
          totalUsers: usersCount.data().count,
          activeSchedules: schedulesSnap.docs.filter(doc => doc.data().status === "Active").length,
          pendingReports: pendingCount.data().count,
          unresolvedIssues: reportsCount.data().count - resolvedCount.data().count,
          recentNotifications: notificationsCount.data().count,
          upcomingEvents: eventsCount.data().count,
        });
        setTodaySchedules(todays.slice(0, 3).map(doc => ({ id: doc.id, barangay: doc.data().barangay || doc.data().location || "All", time: doc.data().time || "TBD", status: "Pending" })));
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : "Unable to load dashboard data.");
      } finally { if (!cancelled) setLoading(false); }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [user, role, authLoading, attempt]);

  const recentActivity: { id: string; type: string; text: string; subtext: string; time: string }[] = [];

  return (
    <>
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <DataState loading={loading} error={error} onRetry={() => setAttempt(value => value + 1)} />
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard 
            title="Total Users" 
            value={loading || error ? "—" : stats.totalUsers.toString()}
            subtitle="All registered users" 
            icon={<Users className="w-7 h-7" />} 
            iconBgColor="bg-[#E8F5E9]" 
            iconColor="text-[#2E7D32]" 
          />
          <KpiCard 
            title="Active Schedules" 
            value={loading || error ? "—" : stats.activeSchedules.toString()}
            subtitle="Collection schedules" 
            icon={<CalendarDays className="w-7 h-7" />} 
            iconBgColor="bg-blue-50" 
            iconColor="text-blue-500" 
          />
          <KpiCard 
            title="Pending Reports" 
            value={loading || error ? "—" : stats.pendingReports.toString()}
            subtitle="For validation" 
            icon={<AlertCircle className="w-7 h-7" />} 
            iconBgColor="bg-red-50" 
            iconColor="text-red-500" 
          />
          <KpiCard 
            title="Unresolved Issues" 
            value={loading || error ? "—" : stats.unresolvedIssues.toString()}
            subtitle="Not yet resolved" 
            icon={<AlertTriangle className="w-7 h-7" />} 
            iconBgColor="bg-amber-50" 
            iconColor="text-amber-500" 
          />
        </div>

        {/* Today at a Glance */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Today at a Glance</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-none shadow-sm rounded-2xl bg-gradient-to-r from-emerald-50 to-emerald-50/20">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600">Today&apos;s Collections</span>
                  <span className="text-xl font-bold text-slate-900 mt-1">{loading || error ? "—" : todayCount}</span>
                  <span className="text-[10px] text-slate-500">Scheduled for today</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-sm rounded-2xl bg-gradient-to-r from-blue-50 to-blue-50/20">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-blue-100 text-blue-500">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600">Total Notifications</span>
                  <span className="text-xl font-bold text-slate-900 mt-1">{loading || error ? "—" : stats.recentNotifications}</span>
                  <span className="text-[10px] text-slate-500">System alerts</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-2xl bg-gradient-to-r from-purple-50 to-purple-50/20">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-purple-100 text-purple-600">
                  <Users className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-600">Upcoming Events</span>
                  <span className="text-xl font-bold text-slate-900 mt-1">{loading || error ? "—" : stats.upcomingEvents}</span>
                  <span className="text-[10px] text-slate-500">Scheduled events</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 3 Columns Section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Today's Collection Schedule */}
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-800">Today&apos;s Collection Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="font-medium pb-2 font-semibold">Barangay</th>
                    <th className="font-medium pb-2 text-center font-semibold">Collection Time</th>
                    <th className="font-medium pb-2 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySchedules.map((schedule) => (
                    <tr key={schedule.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 text-slate-800 font-medium">{schedule.barangay}</td>
                      <td className="py-3 text-center text-slate-600 font-medium">{schedule.time}</td>
                      <td className="py-3 text-right">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          schedule.status === 'Ongoing' ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-orange-50 text-orange-500'
                        }`}>
                          {schedule.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4">
                <Link href="/schedules" className="text-xs font-bold text-[#2E7D32] hover:underline flex items-center">
                  View Full Schedule <span className="ml-1">→</span>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Alerts & Priorities */}
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-800">Alerts & Priorities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100 cursor-pointer hover:bg-red-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                      <span className="font-bold">!</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{stats.pendingReports} Pending Reports</span>
                      <span className="text-xs text-slate-500">Need validation</span>
                    </div>
                  </div>
                  <span className="text-slate-400">›</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{stats.unresolvedIssues} Unresolved Issues</span>
                      <span className="text-xs text-slate-500">Require attention</span>
                    </div>
                  </div>
                  <span className="text-slate-400">›</span>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-[#F1F8F5] rounded-xl border border-green-100">
                  <div className="w-8 h-8 rounded-full bg-[#2E7D32] flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800">All systems are operational</span>
                    <span className="text-xs text-slate-500">No critical alerts at the moment</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-none shadow-sm rounded-2xl relative">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-800">Recent Activity</CardTitle>
              <Link href="/analytics" className="text-xs font-bold text-[#2E7D32] hover:underline flex items-center">
                View All <span className="ml-1">→</span>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <div className="mt-0.5">
                        {activity.type === 'report' && <FileText className="w-4 h-4 text-[#2E7D32]" />}
                        {activity.type === 'schedule' && <CalendarDays className="w-4 h-4 text-blue-500" />}
                        {activity.type === 'notification' && <Bell className="w-4 h-4 text-purple-500" />}
                        {activity.type === 'user' && <Users className="w-4 h-4 text-orange-400" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">{activity.text}</span>
                        <span className="text-[10px] text-slate-500">{activity.subtext}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2 mt-0.5">{activity.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
