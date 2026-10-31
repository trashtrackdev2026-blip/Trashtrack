"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, Users, FileText, AlertCircle } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, getCountFromServer, getDocs, query, where, limit } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { withTimeout } from "@/lib/request-timeout";
import { scheduleOccursOn } from "@/lib/schedules";
import { DataState } from "@/components/ui/data-state";
import { collectionTimeLabel } from "@/lib/collection-calendar";

type OverviewSchedule = { id: string; barangay: string; time: string; description: string };
type OverviewReport = { id: string; type: string; location: string; date: string; image: string };
type OverviewEvent = { id: string; title: string; date: string; location: string; time: string };

export default function Dashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [stats, setStats] = useState({ totalUsers: 0, activeSchedules: 0, pendingReports: 0, unresolvedIssues: 0, recentNotifications: 0, upcomingEvents: 0 });
  const [todaySchedules, setTodaySchedules] = useState<OverviewSchedule[]>([]);
  const [recentReports, setRecentReports] = useState<OverviewReport[]>([]);
  const [nextEvent, setNextEvent] = useState<OverviewEvent | null>(null);

  useEffect(() => {
    if (authLoading || !user || role !== "Admin") return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true); setError(null);
      try {
        const [usersCount, schedulesSnap, reportsCount, pendingCount, resolvedCount, notificationsCount, eventsSnap, pendingSnap] = await withTimeout(Promise.all([
          getCountFromServer(collection(db, "users")), getDocs(collection(db, "schedules")),
          getCountFromServer(collection(db, "reports")),
          getCountFromServer(query(collection(db, "reports"), where("status", "in", ["Pending", "pending"]))),
          getCountFromServer(query(collection(db, "reports"), where("status", "in", ["Resolved", "resolved"]))),
          getCountFromServer(collection(db, "notifications")),
          getDocs(query(collection(db, "events"), where("status", "in", ["Upcoming", "upcoming", "UPCOMING"]))),
          getDocs(query(collection(db, "reports"), where("status", "in", ["Pending", "pending"]), limit(3))),
        ]), "Dashboard data is taking too long. Check the internet connection and retry.", 15_000);
        if (cancelled) return;
        const todays = schedulesSnap.docs.filter(doc => { const data = doc.data(); return scheduleOccursOn({ day: data.day || "", status: data.status || "", date: data.date }, new Date()); });
        setTodayCount(todays.length);
        setStats({ totalUsers: usersCount.data().count, activeSchedules: schedulesSnap.docs.filter(doc => doc.data().status === "Active").length,
          pendingReports: pendingCount.data().count, unresolvedIssues: reportsCount.data().count - resolvedCount.data().count,
          recentNotifications: notificationsCount.data().count, upcomingEvents: eventsSnap.size });
        setTodaySchedules(todays.map(doc => ({ id: doc.id, barangay: doc.data().barangay || "All barangays", time: doc.data().time || "Time to be announced", description: doc.data().description || doc.data().notes || "Collection schedule" })).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 4));
        setRecentReports(pendingSnap.docs.map(doc => { const data = doc.data(); const attachment = Array.isArray(data.attachments) ? data.attachments.find(item => item?.type === "image" && typeof item.url === "string") : null; return { id: doc.id, type: data.type || "Community concern", location: data.location || "Balete", date: data.date || "", image: typeof data.imageUrl === "string" && data.imageUrl ? data.imageUrl : attachment?.url || "" }; }));
        const events = eventsSnap.docs.map(doc => ({ id: doc.id, title: doc.data().title || "Community event", date: doc.data().dateISO || doc.data().date || "", location: doc.data().location || doc.data().barangay || "Balete", time: doc.data().time || "" })).sort((a, b) => a.date.localeCompare(b.date));
        setNextEvent(events[0] || null);
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : "Unable to load dashboard data."); }
      finally { if (!cancelled) setLoading(false); }
    };
    void fetchData();
    return () => { cancelled = true; };
  }, [user, role, authLoading, attempt]);

  const value = (number: number) => loading || error ? "—" : number.toLocaleString();
  const eventDate = nextEvent?.date ? new Date(nextEvent.date + (nextEvent.date.length === 10 ? "T12:00:00" : "")) : null;
  const validEventDate = eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate : null;
  return <div>
    <DataState loading={loading} error={error} onRetry={() => setAttempt(value => value + 1)} />
    <section className="tt-metric-strip" aria-label="Operations summary">
      <KpiCard title="Registered users" value={value(stats.totalUsers)} subtitle="Residents & staff" icon={<Users />} />
      <KpiCard title="Active schedules" value={value(stats.activeSchedules)} subtitle="Across barangays" icon={<CalendarDays />} />
      <KpiCard title="Pending reports" value={value(stats.pendingReports)} subtitle="Awaiting validation" icon={<FileText />} className="tt-metric-attention" />
      <KpiCard title="Unresolved issues" value={value(stats.unresolvedIssues)} subtitle="Follow-up needed" icon={<AlertCircle />} />
    </section>
    <div className="tt-overview-grid">
      <section className="tt-surface tt-panel-padding">
        <div className="tt-section-heading"><h2>Today’s collections</h2><Link href="/schedules" className="tt-text-link">View calendar <ArrowUpRight aria-hidden="true" /></Link></div>
        <p className="text-xs text-muted-foreground">{loading || error ? "Your posted collection schedule" : `${todayCount} ${todayCount === 1 ? "collection" : "collections"} on the schedule today`}</p>
        <div className="tt-collection-feature">
          <div className="tt-collection-photo"><Image src="/images/collection-community.webp" alt="Illustrative scene of a collection truck and sanitation workers" fill sizes="(max-width:767px) 90vw, (max-width:1100px) 40vw, 26vw" /></div>
          <div className="tt-collection-list">{todaySchedules.map(schedule => <div className="tt-collection-row" key={schedule.id}><strong>{collectionTimeLabel(schedule.time)}</strong><div><p>{schedule.barangay}</p><small className="line-clamp-2">{schedule.description}</small></div><span className="tt-status">Scheduled</span></div>)}</div>
        </div>
        {!loading && !error && !todaySchedules.length && <p className="tt-empty">No collections are scheduled for today.<br /><Link href="/schedules" className="tt-text-link mt-3">Browse upcoming collections <ArrowUpRight /></Link></p>}
        <p className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Collection times follow the posted schedule.</p>
      </section>
      <section className="tt-surface tt-panel-padding tt-dark-panel tt-overview-attention">
        <div className="tt-section-heading"><h2>Needs your attention</h2><span className="text-xs text-muted-foreground">{value(stats.pendingReports)} pending</span></div>
        {recentReports.map(report => <Link href="/reports" key={report.id} className="tt-overview-report"><span className="tt-overview-thumbnail">{report.image ? <Image src={report.image} alt="Submitted report evidence" fill sizes="68px" unoptimized /> : <FileText aria-hidden="true" />}</span><div><strong>{report.type}</strong><small>{report.location}{report.date ? ` · ${report.date}` : ""}</small></div><ArrowUpRight aria-hidden="true" /></Link>)}
        {!loading && !error && !recentReports.length && <p className="py-6 text-sm text-muted-foreground">No reports are awaiting initial validation.</p>}
        <Link href="/reports" className="tt-text-link mt-4">Review all reports <ArrowUpRight aria-hidden="true" /></Link>
      </section>
    </div>
    <section className="tt-community-feature" aria-label="Community events">
      <Image src="/images/community-lakeside.webp" alt="Illustrative community lakeside clean-up" fill sizes="(max-width:767px) 100vw, 85vw" />
      <div className="tt-community-feature-copy">
        {validEventDate && <div className="tt-date-block"><strong>{validEventDate.getDate().toString().padStart(2, "0")}</strong><span>{validEventDate.toLocaleDateString("en-PH", { month: "short" })}</span></div>}
        <div><h2>{nextEvent?.title || "Care for our community, together."}</h2><p>{nextEvent ? `${nextEvent.location}${nextEvent.time ? ` · ${nextEvent.time}` : ""}` : "Discover community events and environmental activities in Balete."}</p><Link href="/events" className="tt-text-link">{nextEvent ? "View event" : "Explore events"} <ArrowUpRight aria-hidden="true" /></Link></div>
      </div>
    </section>
    <div className="tt-overview-links"><Link href="/notifications">{value(stats.recentNotifications)} announcements</Link><Link href="/events">{value(stats.upcomingEvents)} upcoming events</Link><Link href="/analytics" className="tt-text-link">Explore analytics <ArrowUpRight aria-hidden="true" /></Link></div>
  </div>;
}
