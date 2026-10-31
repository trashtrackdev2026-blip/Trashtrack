"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  Calendar as CalendarIcon, 
  Map as MapIcon,
  BookOpen,
  Maximize2,
  X, Download
} from "lucide-react";

import dynamic from "next/dynamic";
import { createPortal } from "react-dom";

import { useState, useEffect, useMemo } from "react";
import { collection, getCountFromServer, getDocs, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { assignReportBarangay, BALETE_BARANGAYS, loadBaleteBoundaries, type BarangayName } from "@/lib/barangay-geofence";
import type { BarangayStat } from "@/components/ui/Map";
import { withTimeout } from "@/lib/request-timeout";
import { DataState } from "@/components/ui/data-state";

interface GisReport {
  barangay: BarangayName | null;
  type: string;
  status: string;
  date: string;
}

const MapComponent = dynamic(() => import("@/components/ui/Map"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">Loading map...</div>
});
const AnalyticsCharts = dynamic(() => import("@/components/analytics/AnalyticsCharts"), {
  ssr: false,
  loading: () => <div className="h-72 rounded-2xl bg-slate-100" role="status">Loading charts…</div>,
});

const ReportTrendChart = dynamic(() => import("@/components/analytics/AnalyticsCharts").then(module => module.ReportTrendChart), { ssr:false, loading:()=> <div className="tt-surface h-96" role="status">Loading report trend…</div> });

export default function AnalyticsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [stats, setStats] = useState({
    totalReports: 0,
    resolvedReports: 0,
    pendingReports: 0,
    totalEvents: 0,
    totalResources: 0,
    eventParticipants: 0,
  });

  const [trendData, setTrendData] = useState<{ name: string; value: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [eventData, setEventData] = useState<{ name: string; value: number }[]>([]);
  const [barangayStats, setBarangayStats] = useState<BarangayStat[]>([]);
  const [gisReports, setGisReports] = useState<GisReport[]>([]);
  const [reportsData, setReportsData] = useState<DocumentData[] | null>(null);
  const [gisLoading, setGisLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayName | "all-barangays">("all-barangays");
  const [selectedType, setSelectedType] = useState("all-types");
  const [selectedPeriod, setSelectedPeriod] = useState("all-dates");
  const [geofenceNotice, setGeofenceNotice] = useState<string | null>(null);
  const [mapReferenceDate] = useState(() => Date.now());
  const reportTypes = useMemo(() => [...new Set([
    "Illegal Dumping", "Missed Collection", "Uncollected Waste", "Blocked Drainage", "Mixed Waste", "Others",
    ...gisReports.map(report => report.type),
  ])].sort(), [gisReports]);

  const mapStats = useMemo(() => {
    const cutoff = selectedPeriod === "all-dates" ? null : mapReferenceDate - Number(selectedPeriod) * 86_400_000;
    const result = new Map<BarangayName, BarangayStat>(BALETE_BARANGAYS.map(name => [name, { name, total: 0, resolved: 0, pending: 0, color: "bg-green-500" }]));
    const type = selectedType.toLowerCase();
    for (const report of gisReports) {
      if (!report.barangay || (selectedType !== "all-types" && report.type.toLowerCase() !== type) ||
          (cutoff !== null && !(Date.parse(report.date) >= cutoff))) continue;
      const stat = result.get(report.barangay)!;
      stat.total++;
      if (report.status === "resolved") stat.resolved++; else stat.pending++;
    }
    return [...result.values()].map(stat => ({ ...stat,
      color: stat.pending >= 30 ? "bg-red-500" : stat.pending >= 10 ? "bg-orange-500" : "bg-green-500" }));
  }, [gisReports, selectedType, selectedPeriod, mapReferenceDate]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user || role !== "Admin") return;
    let cancelled = false;
    const fetchAnalyticsData = async () => {
      setLoading(true); setDataError(null);
      try {
        const [reportsSnap, eventsSnap, resourcesCount] = await withTimeout(Promise.all([
          getDocs(collection(db, "reports")),
          getDocs(collection(db, "events")),
          getCountFromServer(collection(db, "educational_resources")),
        ]), "Analytics data is taking too long. Check your connection and retry.", 15_000);
        if (cancelled) return;

        const totalReports = reportsSnap.size;
        let resolvedReports = 0;
        let pendingReports = 0;

        reportsSnap.forEach((doc) => {
          const status = doc.data().status?.toLowerCase();
          if (status === "resolved") resolvedReports++;
          else if (status === "pending") pendingReports++;
        });

        const totalEvents = eventsSnap.size;
        let eventParticipants = 0;
        eventsSnap.forEach((doc) => {
          eventParticipants += (doc.data().participants || 0);
        });

        const totalResources = resourcesCount.data().count;

        setStats({
          totalReports,
          resolvedReports,
          pendingReports,
          totalEvents,
          totalResources,
          eventParticipants,
        });

        // GIS loads independently, so boundaries never hold up KPIs or charts.
        setReportsData(reportsSnap.docs.map(doc => doc.data()));

        const categoryMap: Record<string, { value: number, color: string }> = {
          'Illegal Dumping': { value: 0, color: '#EF4444' },
          'Uncollected Waste': { value: 0, color: '#F97316' },
          'Blocked Drainage': { value: 0, color: '#0EA5E9' },
          'Mixed Waste': { value: 0, color: '#22C55E' },
          'Others': { value: 0, color: '#8B5CF6' }
        };

        reportsSnap.forEach((doc) => {
          const data = doc.data();
          const type = data.type || data.category || "Others";

          let catFound = false;
          for (const cat in categoryMap) {
            if (type.toLowerCase().includes(cat.toLowerCase())) {
              categoryMap[cat].value++;
              catFound = true;
              break;
            }
          }
          if (!catFound) categoryMap['Others'].value++;
        });

        // Only include categories with >0 value, or all if 0
        const catArr = Object.keys(categoryMap).map(k => ({ name: k, ...categoryMap[k] }));
        const totalCats = catArr.reduce((sum, item) => sum + item.value, 0);
        if (totalCats > 0) {
          // Convert to percentages
          setCategoryData(catArr.map(c => ({ ...c, value: Math.round((c.value / totalCats) * 100) })));
        } else {
          setCategoryData(catArr); // all 0
        }

        // 2. Process Events by Type
        const evtMap: Record<string, number> = {
          'Clean-Up Drives': 0,
          'Tree Planting': 0,
          'Seminars': 0,
        };
        eventsSnap.forEach((doc) => {
          const title = (doc.data().title || "").toLowerCase();
          if (title.includes('clean')) evtMap['Clean-Up Drives']++;
          else if (title.includes('tree')) evtMap['Tree Planting']++;
          else if (title.includes('seminar')) evtMap['Seminars']++;
          else evtMap['Clean-Up Drives']++; // Default for others
        });
        setEventData(Object.keys(evtMap).map(k => ({ name: k, value: evtMap[k] })));

        // 3. Real Trend Data (Dynamic last 6 months)
        const today = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const last6Months: string[] = [];

        for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          last6Months.push(monthNames[d.getMonth()]);
        }

        const trendMap: Record<string, number> = {};
        last6Months.forEach(m => trendMap[m] = 0);

        reportsSnap.forEach((doc) => {
          const data = doc.data();
          let rDate = null;

          if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            rDate = data.createdAt.toDate();
          } else if (data.timestamp) {
            rDate = new Date(data.timestamp);
          } else if (data.date) {
            rDate = new Date(data.date);
          }

          if (rDate && !isNaN(rDate.getTime())) {
            const mName = monthNames[rDate.getMonth()];
            if (trendMap[mName] !== undefined) {
              trendMap[mName]++;
            }
          } else {
            // Fallback to current month if date is missing/invalid
            trendMap[last6Months[5]]++;
          }
        });

        setTrendData(last6Months.map(m => ({ name: m, value: trendMap[m] })));

      } catch (error) {
        if (!cancelled) setDataError(error instanceof Error ? error.message : "Unable to load analytics.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAnalyticsData();
  return () => { cancelled = true; };
  }, [user, role, authLoading, attempt]);

  useEffect(() => {
    if (authLoading || !user || role !== "Admin" || !reportsData) return;
    let cancelled = false;
    void (async () => {
      setGisLoading(true);
      try {
        const boundaries = await loadBaleteBoundaries();
        const mapped: GisReport[] = [];
        const result = new Map<string, BarangayStat>(BALETE_BARANGAYS.map(name => [name, { name, total: 0, resolved: 0, pending: 0, color: "bg-green-500" }]));
        let gpsNeedsReview = 0;
        for (let index = 0; index < reportsData.length; index++) {
          if (cancelled) return;
          const data = reportsData[index];
          const assignment = assignReportBarangay(boundaries, data);
          const status = String(data.status || "pending").toLowerCase();
          mapped.push({ barangay: assignment.barangay, type: data.type || data.category || "Others", status, date: data.date || "" });
          if (["outside", "boundary", "invalid"].includes(assignment.method)) gpsNeedsReview++;
          if (assignment.barangay) {
            const stat = result.get(assignment.barangay)!;
            stat.total++;
            if (status === "resolved") stat.resolved++; else stat.pending++;
          }
          // Yield between batches so large GPS datasets don't freeze controls.
          if (index % 100 === 99) await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (cancelled) return;
        setBarangayStats([...result.values()].map(stat => ({ ...stat, color: stat.pending >= 30 ? "bg-red-500" : stat.pending >= 10 ? "bg-orange-500" : "bg-green-500" })));
        setGisReports(mapped);
        const unassigned = mapped.filter(report => !report.barangay).length;
        setGeofenceNotice(unassigned ? `${unassigned} reports are unassigned to a barangay${gpsNeedsReview ? `; ${gpsNeedsReview} have GPS outside the boundaries, on a border, or invalid coordinates` : ""}. Review their locations.` : null);
      } catch {
        if (!cancelled) setGeofenceNotice("Unable to load barangay boundaries. Check your connection and retry analytics.");
      } finally { if (!cancelled) setGisLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [reportsData, user, role, authLoading]);
  const exportReport = () => {
    const rows=mapStats.filter(row=>selectedBarangay==="all-barangays"||row.name===selectedBarangay);
    const csv=[['Barangay','Total reports','Resolved','Pending'],...rows.map(row=>[row.name,row.total,row.resolved,row.pending])].map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}));const link=document.createElement('a');link.href=url;link.download='TrashTrack-Reports-'+new Date().toISOString().slice(0,10)+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  return (
    <>
      <div className="space-y-6 max-w-[1400px] mx-auto pb-8">
        <DataState loading={loading} error={dataError} onRetry={() => setAttempt(value => value + 1)} />

        {/* Header */}
        <div className="tt-legacy-heading flex flex-col gap-2 mb-2">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Monitor waste concerns, community participation, and environmental activities across Balete.</p>
        </div>

        <div className="flex justify-end"><Button variant="outline" disabled={loading||gisLoading||!!dataError} onClick={exportReport}><Download aria-hidden="true" />Export CSV</Button></div>
        {/* KPI Cards */}
        <div className="tt-metric-strip">
          <KpiCard 
            title="Total Waste Reports" 
            value={loading || dataError ? "—" : stats.totalReports.toString()}
            subtitle="All time reports" 
            icon={<FileText className="w-7 h-7" />} 
            iconBgColor="bg-[#E8F5E9]" 
            iconColor="text-[#2E7D32]" 
          />
          <KpiCard 
            title="Resolved Reports" 
            value={loading || dataError ? "—" : stats.resolvedReports.toString()}
            subtitle={`${stats.totalReports > 0 ? Math.round((stats.resolvedReports / stats.totalReports) * 100) : 0}% resolved`} 
            icon={<CheckCircle2 className="w-7 h-7" />} 
            iconBgColor="bg-blue-50" 
            iconColor="text-blue-500" 
          />
          <KpiCard 
            title="Pending Reports" 
            value={loading || dataError ? "—" : stats.pendingReports.toString()}
            subtitle={`${stats.totalReports > 0 ? Math.round((stats.pendingReports / stats.totalReports) * 100) : 0}% pending`} 
            icon={<Clock className="w-7 h-7" />} 
            iconBgColor="bg-orange-50" 
            iconColor="text-orange-500" 
          />
          <KpiCard 
            title="Community Events" 
            value={loading || dataError ? "—" : stats.totalEvents.toString()}
            subtitle="This year" 
            icon={<CalendarIcon className="w-7 h-7" />} 
            iconBgColor="bg-purple-50" 
            iconColor="text-purple-500" 
          />
        </div>

        {/* Second Row: Map and Table */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">

          {/* GIS Map Panel */}
          <div className="tt-surface min-w-0 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-[#2E7D32]" /> GIS Waste Monitoring Map
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                onClick={() => setIsMapExpanded(true)}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 bg-white flex flex-wrap gap-3">
              <Select value={selectedBarangay} onValueChange={value => {
                if (value === "all-barangays" || BALETE_BARANGAYS.includes(value as BarangayName)) {
                  setSelectedBarangay(value as BarangayName | "all-barangays");
                }
              }}>
                <SelectTrigger aria-label="Filter by barangay" className="w-[160px] h-9 text-xs bg-slate-50 border-slate-200">
                  <SelectValue>{selectedBarangay === "all-barangays" ? "All Barangays" : selectedBarangay}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-barangays">All Barangays</SelectItem>
                  {BALETE_BARANGAYS.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedType} onValueChange={value => { if (value) setSelectedType(value); }}>
                <SelectTrigger aria-label="Report type" className="w-[160px] h-9 text-xs bg-slate-50 border-slate-200">
                  <SelectValue>{selectedType === "all-types" ? "All Types" : selectedType}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-types">All Types</SelectItem>
                  {reportTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedPeriod} onValueChange={value => { if (value) setSelectedPeriod(value); }}>
                <SelectTrigger aria-label="Date range" className="w-[200px] h-9 text-xs bg-slate-50 border-slate-200">
                  <SelectValue>{selectedPeriod === "all-dates" ? "All Dates" : `Last ${selectedPeriod} Days`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-dates">All Dates</SelectItem>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative isolate w-full h-[350px] p-2 bg-slate-50 border-b border-slate-100">
               <MapComponent barangayStats={mapStats} selectedBarangay={selectedBarangay} />

               {/* Legend */}
               <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md border border-slate-100 z-[1000]">
                 <h4 className="text-[10px] font-bold text-slate-700 mb-2 uppercase tracking-wider">Legend</h4>
                 <div className="space-y-1.5">
                   <div className="flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                     <span className="text-[11px] font-medium text-slate-600">High Concern</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                     <span className="text-[11px] font-medium text-slate-600">Moderate Concern</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                     <span className="text-[11px] font-medium text-slate-600">Low Concern</span>
                   </div>
                 </div>
               </div>

            </div>
            {geofenceNotice && <p className="px-4 py-2 text-xs text-amber-800 bg-amber-50" role="status">{geofenceNotice}</p>}
            {(loading || gisLoading) && <p className="px-4 py-2 text-xs text-slate-500" role="status">Loading report counts…</p>}
          </div>

          {/* Table Panel */}
          <ReportTrendChart trendData={trendData} totalReports={stats.totalReports} resolvedReports={stats.resolvedReports} pendingReports={stats.pendingReports} />
        </div>

<div className="tt-surface flex flex-col">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2E7D32]" /> Waste Reports by Barangay
              </h3>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-xs">
                  <tr>
                    <th className="py-3 px-4 font-semibold text-slate-600">Barangay</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-center">Total Reports</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-center">Resolved</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-center">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {barangayStats.map((stat, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-800 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${stat.color}`}></div>
                        {stat.name}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">{stat.total}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{stat.resolved}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{stat.pending}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-100">
                    <td className="py-3 px-4 text-slate-900">Total</td>
                    <td className="py-3 px-4 text-center text-slate-900">{stats.totalReports}</td>
                    <td className="py-3 px-4 text-center text-slate-900">{stats.resolvedReports}</td>
                    <td className="py-3 px-4 text-center text-slate-900">{stats.pendingReports}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        {!loading && !dataError && <AnalyticsCharts hideTrend trendData={trendData} categoryData={categoryData} eventData={eventData} stats={stats} />}

        <div className="flex flex-wrap items-center gap-3 border-t pt-5 text-sm text-muted-foreground"><BookOpen className="h-4 w-4" aria-hidden="true" /><span>{stats.totalResources} learning resources available to the community</span></div>

      </div>

      {/* Expanded GIS Map Modal */}
      {isMapExpanded && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Expanded GIS map" className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 lg:p-8 animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full h-full flex flex-col overflow-hidden relative">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-[#2E7D32]" /> GIS Waste Monitoring Map (Expanded)
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                className="w-8 h-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 bg-slate-50 rounded-full"
                onClick={() => setIsMapExpanded(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 w-full relative isolate bg-slate-50">
              <MapComponent barangayStats={mapStats} selectedBarangay={selectedBarangay} />

              {/* Floating Legend for Expanded Map */}
              <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-xl border border-slate-100 z-[1000]">
                 <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">Legend</h4>
                 <div className="space-y-2">
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-200"></div>
                     <span className="text-xs font-semibold text-slate-700">High Concern (30+ Reports)</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm shadow-amber-200"></div>
                     <span className="text-xs font-semibold text-slate-700">Moderate (10-29 Reports)</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
                     <span className="text-xs font-semibold text-slate-700">Low (0-9 Reports)</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}
