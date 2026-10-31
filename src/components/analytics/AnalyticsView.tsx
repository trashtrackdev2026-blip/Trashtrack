"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { collection, type DocumentData } from "firebase/firestore";
import { Download, FileText, CheckCircle2, Clock, CalendarDays, Maximize2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { subscribeWithDeadline } from "@/lib/live-data";
import { summarizeAnalytics, analyticsReportDate, CALAWIT_SERVICE_NOTE } from "@/lib/analytics-data";
import { normalizeReportStatus } from "@/lib/report-workflow";
import { assignReportBarangay, BALETE_BARANGAYS, loadBaleteBoundaries, type BarangayName } from "@/lib/barangay-geofence";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataState } from "@/components/ui/data-state";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { BarangayStat } from "@/components/ui/Map";
import type { AnalyticsPdfSection } from "@/lib/analytics-pdf";

const MapComponent = dynamic(() => import("@/components/ui/Map"), { ssr:false, loading:() => <p className="p-4">Loading map…</p> });
const Charts = dynamic(() => import("@/components/analytics/AnalyticsCharts"), { ssr:false });
const ReportTrendChart = dynamic(() => import("@/components/analytics/AnalyticsCharts").then(module => module.ReportTrendChart), { ssr:false });
type Source = "reports" | "events" | "educational_resources" | "schedules";
type MappedReport = { barangay: BarangayName | null; type: string; resolved: boolean; date: Date | null };
const selectClass = "h-10 min-w-0 rounded-lg border bg-white px-3 text-sm";
const emptyData = { reports:null, events:null, educational_resources:null, schedules:null };

export default function AnalyticsView() {
  const { user, role, loading: authLoading } = useAuth();
  const [data, setData] = useState<Record<Source, DocumentData[] | null>>(emptyData);
  const [errors, setErrors] = useState<Partial<Record<Source, string>>>({});
  const [attempt, setAttempt] = useState(0);
  const [mapped, setMapped] = useState<MappedReport[]>([]);
  const [gisLoading, setGisLoading] = useState(true);
  const [gisNotice, setGisNotice] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayName | "all-barangays">("all-barangays");
  const [selectedType, setSelectedType] = useState("all-types");
  const [selectedPeriod, setSelectedPeriod] = useState("all-dates");
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const loading = Object.values(data).some(value => value === null);
  const dataError = Object.values(errors).filter(Boolean).join(" ") || null;
  const summary = useMemo(() => summarizeAnalytics(data.reports || [], data.events || [], data.educational_resources?.length || 0, data.schedules || [], now), [data, now]);
  const { stats, trendData, categoryData, eventData, collectionData } = summary;

  useEffect(() => {
    if (authLoading || !user || role !== "Admin") return;
    const unsubscribers = (["reports", "events", "educational_resources", "schedules"] as Source[]).map(source =>
      subscribeWithDeadline(collection(db, source), snapshot => {
        if (source === "reports") setGisLoading(true);
        setData(current => ({ ...current, [source]: snapshot.docs.map(doc => doc.data()) }));
        setErrors(current => ({ ...current, [source]: undefined }));setNow(new Date());
      }, () => setErrors(current => ({ ...current, [source]: "Unable to load " + source.replaceAll("_", " ") + ". Check your connection and retry." }))));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [user, role, authLoading, attempt]);

  useEffect(() => {
    if (!data.reports) return;
    let cancelled = false;
    void loadBaleteBoundaries().then(boundaries => {
      if (cancelled) return;
      const next = data.reports!.map(report => ({ barangay:assignReportBarangay(boundaries, report).barangay,
        type:String(report.type || report.category || "Others"), resolved:normalizeReportStatus(String(report.status)) === "Resolved", date:analyticsReportDate(report) }));
      setMapped(next);
      const missing = next.filter(report => !report.barangay).length;
      setGisNotice(missing ? missing + " reports have unassigned or unverified locations and are excluded from barangay totals. Review their coordinates." : "");
    }).catch(() => { if (!cancelled) {setMapped([]);setGisNotice("Unable to load barangay boundaries. Retry analytics to restore geographic counts.");} })
      .finally(() => {if (!cancelled) setGisLoading(false);});
    return () => {cancelled = true;};
  }, [data.reports, attempt]);

  const mapStats = useMemo(() => {
    const result = new Map<BarangayName, BarangayStat>(BALETE_BARANGAYS.map(name => [name, {name,total:0,resolved:0,pending:0,color:"bg-green-500"}]));
    const cutoff = selectedPeriod === "all-dates" ? null : now.getTime() - Number(selectedPeriod) * 86400000;
    for (const report of mapped) {
      if (!report.barangay || (selectedType !== "all-types" && report.type !== selectedType) || (cutoff !== null && (!report.date || report.date.getTime() < cutoff || report.date > now))) continue;
      const row = result.get(report.barangay)!;row.total++;if (report.resolved) row.resolved++;else row.pending++;
    }
    return [...result.values()].map(row => ({ ...row, color:row.pending >= 30 ? "bg-red-500" : row.pending >= 10 ? "bg-orange-500" : "bg-green-500" }));
  }, [mapped, selectedType, selectedPeriod, now]);
  const tableRows = mapStats.filter(row => selectedBarangay === "all-barangays" || row.name === selectedBarangay);
  const tableTotal = tableRows.reduce((sum, row) => ({ total:sum.total + row.total,resolved:sum.resolved + row.resolved,pending:sum.pending + row.pending }), {total:0,resolved:0,pending:0});
  const sections: AnalyticsPdfSection[] = [
    {title:"Report summary - all recorded reports",rows:[{name:"Total reports",value:stats.totalReports},{name:"Resolved",value:stats.resolvedReports},{name:"Pending (all unresolved stages)",value:stats.pendingReports}]},
    {title:"Waste concern trend - last six months",rows:trendData},
    {title:"Report categories (%)",rows:categoryData}, {title:"Community events",rows:eventData},
    {title:"Collection outcomes - all saved schedules",rows:collectionData},
    {title:"Barangay totals - " + selectedType + ", " + selectedPeriod,rows:tableRows.flatMap(row => [{name:row.name + ": total",value:row.total},{name:row.name + ": resolved",value:row.resolved},{name:row.name + ": pending",value:row.pending}])},
  ];
  async function exportPdf(section?: number) {
    if (exporting) return;setExporting(true);setExportError("");
    try {
      const { downloadAnalyticsPdf } = await import("@/lib/analytics-pdf");
      await downloadAnalyticsPdf(section === undefined ? sections : [sections[section]], [
        "Pending includes all reports that have not been resolved. Counts update from live records.", CALAWIT_SERVICE_NOTE,
        "Geographic filters: " + selectedBarangay + ", " + selectedType + ", " + selectedPeriod + ". Other sections include all records.",
        ...(summary.undatedReports ? [summary.undatedReports + " reports have no valid submission date and are excluded from the monthly trend."] : []),
        ...(gisNotice ? [gisNotice] : [])], section === 1 ? "Waste-Concern-Trend" : section === 4 ? "Collection-Analytics" : "Analytics");
    } catch {setExportError("The PDF could not be generated. Please try again.");} finally {setExporting(false);}
  }
  function exportCsv() {
    const rows = [["Barangay","Total reports","Resolved","Pending"], ...tableRows.map(row => [row.name,row.total,row.resolved,row.pending]), ["Total",tableTotal.total,tableTotal.resolved,tableTotal.pending]];
    const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"','""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8;"}));
    const link = document.createElement("a");link.href=url;link.download="TrashTrack-Barangay-Reports.csv";link.click();setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const metric = (value: number) => loading || dataError ? "—" : value;
  const pdfDisabled = loading || !!dataError || exporting;
  return <div className="mx-auto max-w-[1400px] space-y-6 pb-8">
    <DataState loading={loading} error={dataError} onRetry={() => {setData(emptyData);setErrors({});setGisLoading(true);setAttempt(value => value + 1);}} />
    <div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={pdfDisabled || gisLoading} onClick={() => void exportPdf()}><Download />{exporting ? "Preparing PDF…" : "Download analytics PDF"}</Button><Button variant="outline" disabled={loading || gisLoading || !!dataError} onClick={exportCsv}>Export CSV</Button></div>
    {exportError && <p role="alert" className="text-sm text-red-700">{exportError}</p>}
    <section className="tt-metric-strip" aria-label="Analytics summary">
      <KpiCard title="Total Waste Reports" value={metric(stats.totalReports)} subtitle="All recorded reports" icon={<FileText />} />
      <KpiCard title="Resolved Reports" value={metric(stats.resolvedReports)} subtitle="Collection confirmed" icon={<CheckCircle2 />} />
      <KpiCard title="Pending Reports" value={metric(stats.pendingReports)} subtitle="All unresolved stages" icon={<Clock />} />
      <KpiCard title="Community Events" value={metric(stats.totalEvents)} subtitle="All recorded events" icon={<CalendarDays />} />
    </section>
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950" role="note">{CALAWIT_SERVICE_NOTE}</p>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="tt-surface min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b p-5"><h2>GIS Waste Monitoring</h2><Button variant="ghost" size="icon" aria-label="Expand GIS map" onClick={() => setExpanded(true)}><Maximize2 /></Button></div>
        <div className="flex flex-wrap gap-2 p-4"><select aria-label="Filter by barangay" value={selectedBarangay} onChange={e => setSelectedBarangay(e.target.value as BarangayName | "all-barangays")} className={selectClass}><option value="all-barangays">All barangays</option>{BALETE_BARANGAYS.map(name => <option key={name}>{name}</option>)}</select><select aria-label="Report type" value={selectedType} onChange={e => setSelectedType(e.target.value)} className={selectClass}><option value="all-types">All types</option>{[...new Set(mapped.map(report => report.type))].sort().map(type => <option key={type}>{type}</option>)}</select><select aria-label="Date range" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className={selectClass}><option value="all-dates">All dates</option>{[7,30,90].map(days => <option key={days} value={days}>Last {days} days</option>)}</select></div>
        <div className="relative isolate h-[350px]"><MapComponent barangayStats={mapStats} selectedBarangay={selectedBarangay} /></div>
        <p className="p-4 text-xs text-muted-foreground">Map colors use unresolved reports: low 0–9, moderate 10–29, high 30+. {gisLoading ? "Loading geographic counts…" : gisNotice}</p>
      </section>
      <div className="min-w-0 space-y-3"><ReportTrendChart trendData={trendData} totalReports={stats.totalReports} resolvedReports={stats.resolvedReports} pendingReports={stats.pendingReports} /><Button variant="outline" disabled={pdfDisabled} onClick={() => void exportPdf(1)}><Download />Download trend PDF</Button></div>
    </div>
    <section className="tt-surface overflow-hidden"><div className="border-b p-5"><h2>Waste Reports by Barangay</h2><p className="mt-1 text-xs text-muted-foreground">Uses the map filters above. Pending includes all unresolved stages.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Barangay","Total Reports","Resolved","Pending"].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{tableRows.map(row => <tr key={row.name} className="border-t"><td className="p-4">{row.name}{row.name === "Calawit" && <small className="block text-muted-foreground">Relocated residents served in Makina</small>}</td><td className="p-4">{gisLoading ? "—" : row.total}</td><td className="p-4">{gisLoading ? "—" : row.resolved}</td><td className="p-4">{gisLoading ? "—" : row.pending}</td></tr>)}<tr className="border-t bg-muted/30 font-semibold"><td className="p-4">Total in this view</td><td className="p-4">{gisLoading ? "—" : tableTotal.total}</td><td className="p-4">{gisLoading ? "—" : tableTotal.resolved}</td><td className="p-4">{gisLoading ? "—" : tableTotal.pending}</td></tr></tbody></table></div></section>
    {!loading && !dataError && <Charts hideTrend trendData={trendData} categoryData={categoryData} eventData={eventData} stats={stats} />}
    <section className="tt-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2>Collection analytics</h2><p className="mt-1 text-xs text-muted-foreground">{summary.totalCollections} saved schedules · outcomes recorded by MENRO</p></div><Button variant="outline" disabled={pdfDisabled} onClick={() => void exportPdf(4)}><Download />Download collection PDF</Button></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{collectionData.map(item => <div key={item.name} className="rounded-xl border p-4"><span className="text-xs text-muted-foreground">{item.name}</span><strong className="mt-1 block text-2xl">{metric(item.value)}</strong><div className="mt-3 h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-green-700" style={{width:(summary.totalCollections ? item.value / summary.totalCollections * 100 : 0) + "%"}} /></div></div>)}</div></section>
    <p className="text-sm text-muted-foreground">{stats.totalResources} educational resources available. {summary.undatedReports > 0 && summary.undatedReports + " reports without a valid date are excluded from the monthly trend."}</p>
    <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="sm:max-w-[calc(100vw-4rem)]"><DialogTitle>GIS Waste Monitoring Map</DialogTitle><DialogDescription>Uses the selected report type and date range. Colors show unresolved waste concerns.</DialogDescription><div className="relative isolate h-[65dvh]"><MapComponent barangayStats={mapStats} selectedBarangay={selectedBarangay} /></div></DialogContent></Dialog>
  </div>;
}
