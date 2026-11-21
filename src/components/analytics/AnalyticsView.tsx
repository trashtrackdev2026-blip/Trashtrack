"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { collection, type DocumentData } from "firebase/firestore";
import { Printer, Download, FileText, CheckCircle2, CircleX, Clock, CalendarDays, Maximize2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { subscribeWithDeadline } from "@/lib/live-data";
import { summarizeAnalytics, analyticsReportDate, CALAWIT_SERVICE_NOTE } from "@/lib/analytics-data";
import { analyticsPeriodLabel, analyticsPeriodRange, filterAnalyticsPeriod, analyticsRecordRows } from "@/lib/analytics-period";
import { manilaDateTime } from "@/lib/scheduling-time";
import { REPORT_CATEGORIES, reportCategory } from "@/lib/report-categories";
import { normalizeReportStatus } from "@/lib/report-workflow";
import { assignReportBarangay, BALETE_BARANGAYS, loadBaleteBoundaries, type BarangayName } from "@/lib/barangay-geofence";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataState } from "@/components/ui/data-state";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { BarangayStat } from "@/components/ui/Map";
import type { AnalyticsPdfSection } from "@/lib/analytics-pdf";
import { ReportInsights } from "@/components/analytics/ReportInsights";

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
  const [reportPeriod, setReportPeriod] = useState("");

  const [recordPage,setRecordPage]=useState(1);
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const loading = Object.values(data).some(value => value === null);
  const dataError = Object.values(errors).filter(Boolean).join(" ") || null;
  const periodReports = useMemo(() => filterAnalyticsPeriod(data.reports || [], reportPeriod), [data.reports, reportPeriod]);
  const periodEvents = useMemo(() => filterAnalyticsPeriod(data.events || [], reportPeriod, "event"), [data.events, reportPeriod]);
  const periodSchedules = useMemo(() => filterAnalyticsPeriod(data.schedules || [], reportPeriod, "schedule"), [data.schedules, reportPeriod]);
  const periodResources = useMemo(() => filterAnalyticsPeriod(data.educational_resources || [], reportPeriod, "resource"), [data.educational_resources, reportPeriod]);
  const periodLabel = analyticsPeriodLabel(reportPeriod);
  const reportPeriodMode = !reportPeriod ? "all" : reportPeriod.length === 4 ? "year" : "month";
  const trendMonths = reportPeriodMode === "year" ? 12 : reportPeriodMode === "month" ? 1 : 6;
  const summary = useMemo(() => summarizeAnalytics(periodReports, periodEvents, periodResources.length, periodSchedules,
    reportPeriod ? new Date(analyticsPeriodRange(reportPeriod).end.getTime() - 1) : now, trendMonths),
  [periodReports, periodEvents, periodResources, periodSchedules, reportPeriod, now, trendMonths]);
  const { stats, categoryData, eventData, collectionData, trendData } = summary;
  const currentYear = manilaDateTime(now.getTime()).date.slice(0, 4);
  const years = useMemo(() => {
    const formatYear = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric" });
    const observed = new Set([currentYear]);
    for (const records of Object.values(data)) for (const record of records || []) {
      const date = analyticsReportDate(record) || analyticsReportDate({ date: record.dateISO });
      if (date) observed.add(formatYear.format(date));
    }
    return [...observed].filter(year => /^\d{4}$/.test(year) && Number(year) >= 1900).sort().reverse();
  }, [currentYear, data]);
  const changeReportPeriod = (period: string) => {
    if (period === reportPeriod) return;
    setReportPeriod(period);
    setSelectedPeriod("all-dates");
    setGisLoading(true);
    setRecordPage(1);
  };
  const recordRows=useMemo(()=>analyticsRecordRows(periodReports),[periodReports]);
  const safeRecordPage=Math.min(recordPage,Math.max(1,Math.ceil(recordRows.length/20)));
  const undatedCount=(data.reports || []).filter(report=>!analyticsReportDate(report)).length;


  useEffect(() => {
    if (authLoading || !user || role !== "Admin") return;
    const unsubscribers = (["reports", "events", "educational_resources", "schedules"] as Source[]).map(source =>
      subscribeWithDeadline(collection(db, source), snapshot => {
        if (source === "reports") setGisLoading(true);
        setData(current => ({ ...current, [source]: snapshot.docs.map(doc => ({...doc.data(),id:doc.id})) }));
        setErrors(current => ({ ...current, [source]: undefined }));setNow(new Date());
      }, () => setErrors(current => ({ ...current, [source]: "Unable to load " + source.replaceAll("_", " ") + ". Check your connection and retry." }))));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [user, role, authLoading, attempt]);

  useEffect(() => {
    if (!data.reports) return;
    let cancelled = false;
    void loadBaleteBoundaries().then(boundaries => {
      if (cancelled) return;
      const next = periodReports.filter(report => normalizeReportStatus(String(report.status)) !== "Rejected").map(report => ({ barangay:assignReportBarangay(boundaries, report).barangay,
        type:reportCategory(report.type || report.category), resolved:normalizeReportStatus(String(report.status)) === "Resolved", date:analyticsReportDate(report) }));
      setMapped(next);
      const missing = next.filter(report => !report.barangay).length;
      setGisNotice(missing ? missing + " reports have unassigned or unverified locations and are excluded from barangay totals. Review their coordinates." : "");
    }).catch(() => { if (!cancelled) {setMapped([]);setGisNotice("Unable to load barangay boundaries. Retry analytics to restore geographic counts.");} })
      .finally(() => {if (!cancelled) setGisLoading(false);});
    return () => {cancelled = true;};
  }, [data.reports, periodReports, attempt]);

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
    {title:"Report summary - " + periodLabel,rows:[{name:"Total reports",value:stats.totalReports},{name:"Resolved",value:stats.resolvedReports},{name:"Rejected",value:stats.rejectedReports},{name:"Pending (all active stages)",value:stats.pendingReports}]},
    {title:reportPeriod ? "Report submissions - " + periodLabel : "Waste concern trend - last six months",rows:trendData},
    {title:"Report categories (counts)",rows:categoryData}, {title:"Community events",rows:eventData},
    {title:"Collection outcomes - " + periodLabel,rows:collectionData},
    {title:"Barangay totals - " + selectedType + ", " + selectedPeriod,rows:tableRows.flatMap(row => [{name:row.name + ": total",value:row.total},{name:row.name + ": resolved",value:row.resolved},{name:row.name + ": pending",value:row.pending}])},
    {title:"Recorded resolutions by office",rows:summary.resolutionData},
    {title:"Report records - " + periodLabel,rows:[],records:recordRows},
  ];
  async function exportPdf(section?: number,print=false) {
    if (exporting) return;setExporting(true);setExportError("");
    try {
      const { downloadAnalyticsPdf,openPrintableAnalyticsPdf } = await import("@/lib/analytics-pdf");
      const documentSections=section === undefined ? sections : [sections[section]];
      const notes=["Selected period: " + periodLabel + ".",
        "Pending includes reports awaiting review or action. Rejected and resolved reports have their own counts.", CALAWIT_SERVICE_NOTE,
        "Geographic filters apply only to barangay totals: " + selectedBarangay + ", " + selectedType + ", " + selectedPeriod + ". All sections use the selected reporting period.",
        "Reports use submission date; events use event date; collections use collection date; learning resources use publication date. Report counts reflect current saved statuses.",
        ...(summary.historicalCollections ? [summary.historicalCollections + " historical collections use retired or unrecognized statuses and are excluded from the four outcome counts."] : []),
        ...(summary.undatedReports ? [summary.undatedReports + " reports have no valid submission date and are excluded from the monthly trend."] : []),
        ...(gisNotice ? [gisNotice] : []),
        ...(reportPeriod && undatedCount ? [undatedCount+" undated reports are excluded from this period."] : [])];
      if(print)await openPrintableAnalyticsPdf(documentSections,notes);
      else await downloadAnalyticsPdf(documentSections,notes,(section===1?"Waste-Concern-Trend":section===4?"Collection-Analytics":"Analytics")+(reportPeriod?"-"+reportPeriod:"-All-Dates"));
    } catch(error) {setExportError(error instanceof Error?error.message:"The PDF could not be generated. Please try again.");} finally {setExporting(false);}
  }
  function exportCsv() {
    const rows = [["Barangay","Total reports","Resolved","Pending"], ...tableRows.map(row => [row.name,row.total,row.resolved,row.pending]), ["Total",tableTotal.total,tableTotal.resolved,tableTotal.pending]];
    const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"','""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8;"}));
    const link = document.createElement("a");link.href=url;link.download=`TrashTrack-Barangay-Reports-${reportPeriod || "All-Dates"}.csv`;link.click();setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const metric = (value: number) => loading || dataError ? "—" : value;
  const pdfDisabled = loading || !!dataError || exporting;
  return <div className="mx-auto max-w-[1400px] space-y-6 pb-8">
    <DataState loading={loading} error={dataError} onRetry={() => {setData(emptyData);setErrors({});setGisLoading(true);setAttempt(value => value + 1);}} />
    <section className="tt-surface flex flex-wrap items-end gap-4 p-5" aria-label="Analytics reporting period">
      <label className="min-w-44 text-sm font-semibold">Report period
        <select className={selectClass + " mt-2 block w-full"} value={reportPeriodMode} onChange={event => changeReportPeriod(event.target.value === "all" ? "" : event.target.value === "year" ? currentYear : manilaDateTime().date.slice(0, 7))}>
          <option value="all">All recorded dates</option><option value="year">Specific year</option><option value="month">Specific month</option>
        </select>
      </label>
      {reportPeriodMode === "year" && <label className="text-sm font-semibold">Year
        <select className={selectClass + " mt-2 block"} value={reportPeriod} onChange={event => changeReportPeriod(event.target.value)}>
          {years.map(year => <option key={year}>{year}</option>)}
        </select>
      </label>}
      {reportPeriodMode === "month" && <label className="text-sm font-semibold">Month and year
        <input type="month" min="1900-01" max="9999-12" value={reportPeriod} className={selectClass + " mt-2 block"} onChange={event => {
          if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) && Number(event.target.value.slice(0, 4)) >= 1900) changeReportPeriod(event.target.value);
        }} />
      </label>}
      <p className="flex-1 text-sm" role="status"><strong className="block">{periodLabel}</strong>All summaries, charts and exported records use this period (Philippine time).{reportPeriod && undatedCount>0 && <small className="mt-1 block">{undatedCount} undated reports excluded.</small>}</p>
    </section>
    <div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={pdfDisabled || gisLoading} onClick={()=>void exportPdf(undefined,true)}><Printer/>Open printable PDF</Button><Button variant="outline" disabled={pdfDisabled || gisLoading} onClick={() => void exportPdf()}><Download />{exporting ? "Preparing PDF…" : "Download analytics PDF"}</Button><Button variant="outline" disabled={loading || gisLoading || !!dataError} onClick={exportCsv}>Export CSV</Button></div>
    {exportError && <p role="alert" className="text-sm text-red-700">{exportError}</p>}
    <section className="tt-metric-strip tt-analytics-metrics" aria-label="Analytics summary">
      <KpiCard title="Total Waste Reports" value={metric(stats.totalReports)} subtitle={periodLabel} icon={<FileText />} />
      <KpiCard title="Resolved Reports" value={metric(stats.resolvedReports)} subtitle="Reported concerns addressed" icon={<CheckCircle2 />} />
      <KpiCard title="Pending Reports" value={metric(stats.pendingReports)} subtitle="Awaiting review or action" icon={<Clock />} />
      <KpiCard title="Rejected Reports" value={metric(stats.rejectedReports)} subtitle={periodLabel} icon={<CircleX />} />
      <KpiCard title="Community Events" value={metric(stats.totalEvents)} subtitle={periodLabel} icon={<CalendarDays />} />
    </section>
    <section aria-label="Recorded resolutions by office" className="tt-surface flex flex-wrap gap-5 p-4">{summary.resolutionData.map(row=><p key={row.name} className="text-sm"><strong>{row.name}</strong>: {metric(row.value)} resolved</p>)}</section>
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950" role="note">{CALAWIT_SERVICE_NOTE}</p>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="tt-surface min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b p-5"><h2>GIS Waste Monitoring</h2><Button variant="ghost" size="icon" aria-label="Expand GIS map" onClick={() => setExpanded(true)}><Maximize2 /></Button></div>
        <div className="flex flex-wrap gap-2 p-4"><select aria-label="Filter by barangay" value={selectedBarangay} onChange={e => setSelectedBarangay(e.target.value as BarangayName | "all-barangays")} className={selectClass}><option value="all-barangays">All barangays</option>{BALETE_BARANGAYS.map(name => <option key={name}>{name}</option>)}</select><select aria-label="Report type" value={selectedType} onChange={e => setSelectedType(e.target.value)} className={selectClass}><option value="all-types">All types</option>{REPORT_CATEGORIES.map(type => <option key={type}>{type}</option>)}</select><select aria-label="Date range" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className={selectClass}><option value="all-dates">All dates</option>{[7,30,90].map(days => <option key={days} value={days}>Last {days} days</option>)}</select></div>
        <div className="relative isolate h-[350px]"><MapComponent barangayStats={mapStats} selectedBarangay={selectedBarangay} /></div>
        <p className="p-4 text-xs text-muted-foreground">Map colors use unresolved reports: low 0–9, moderate 10–29, high 30+. {gisLoading ? "Loading geographic counts…" : gisNotice}</p>
      </section>
      <div className="min-w-0 space-y-3"><ReportTrendChart trendData={trendData} counts={stats} /><Button variant="outline" disabled={pdfDisabled} onClick={() => void exportPdf(1)}><Download />Download trend PDF</Button></div>
    </div>
    <section className="tt-surface overflow-hidden"><div className="border-b p-5"><h2>Waste Reports by Barangay</h2><p className="mt-1 text-xs text-muted-foreground">Uses the map filters above. Pending includes all unresolved stages.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Barangay","Total Reports","Resolved","Pending"].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{tableRows.map(row => <tr key={row.name} className="border-t"><td className="p-4">{row.name}{row.name === "Calawit" && <small className="block text-muted-foreground">Relocated residents served in Makina</small>}</td><td className="p-4">{gisLoading ? "—" : row.total}</td><td className="p-4">{gisLoading ? "—" : row.resolved}</td><td className="p-4">{gisLoading ? "—" : row.pending}</td></tr>)}<tr className="border-t bg-muted/30 font-semibold"><td className="p-4">Total in this view</td><td className="p-4">{gisLoading ? "—" : tableTotal.total}</td><td className="p-4">{gisLoading ? "—" : tableTotal.resolved}</td><td className="p-4">{gisLoading ? "—" : tableTotal.pending}</td></tr></tbody></table></div></section>
    {!loading && !dataError && <ReportInsights key={JSON.stringify([reportPeriod, stats.totalReports, stats.resolvedReports, stats.rejectedReports, trendData, categoryData])} period={reportPeriod} periodLabel={periodLabel}
      totalReports={stats.totalReports} categories={categoryData} months={trendData} />}
    {!loading && !dataError && <Charts categoryData={categoryData} eventData={eventData} stats={stats} />}
    <section className="tt-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2>Collection analytics</h2><p className="mt-1 text-xs text-muted-foreground">{summary.totalCollections} saved schedules · {periodLabel} · current saved outcomes</p></div><Button variant="outline" disabled={pdfDisabled} onClick={() => void exportPdf(4)}><Download />Download collection PDF</Button></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{collectionData.map(item => <div key={item.name} className="rounded-xl border p-4"><span className="text-xs text-muted-foreground">{item.name}</span><strong className="mt-1 block text-2xl">{metric(item.value)}</strong><div className="mt-3 h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-green-700" style={{width:(summary.totalCollections ? item.value / summary.totalCollections * 100 : 0) + "%"}} /></div></div>)}</div>{summary.historicalCollections>0 && <p className="mt-4 text-xs text-muted-foreground">{summary.historicalCollections} historical schedules use retired or unrecognized statuses and are excluded from these four outcome counts.</p>}</section>
    <section className="tt-surface overflow-hidden" aria-label="Report records for selected period"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2>Report records · {periodLabel}</h2><p className="mt-1 text-xs text-muted-foreground">{recordRows.length} submissions. The printable PDF includes every record in this period.</p></div><Button variant="outline" disabled={pdfDisabled} onClick={()=>void exportPdf(7,true)}><Printer/>Print report records</Button></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Submitted (PH)","Reference","Barangay","Concern","Current status"].map(label=><th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{recordRows.slice((safeRecordPage-1)*20,safeRecordPage*20).map(row=><tr key={row.reference} className="border-t"><td className="p-4">{row.date}</td><td className="max-w-48 break-all p-4">{row.reference}</td><td className="p-4">{row.barangay}</td><td className="p-4">{row.type}</td><td className="p-4">{row.status}</td></tr>)}{!loading && !recordRows.length && <tr><td colSpan={5} className="tt-empty">No report submissions for this period.</td></tr>}</tbody></table></div><div className="flex items-center justify-between gap-3 border-t p-4"><Button variant="outline" disabled={safeRecordPage===1} onClick={()=>setRecordPage(safeRecordPage-1)}>Previous</Button><span className="text-sm">Page {safeRecordPage} of {Math.max(1,Math.ceil(recordRows.length/20))}</span><Button variant="outline" disabled={safeRecordPage*20>=recordRows.length} onClick={()=>setRecordPage(safeRecordPage+1)}>Next</Button></div></section>
    <p className="text-sm text-muted-foreground">{stats.totalResources} educational resources available. {summary.undatedReports > 0 && summary.undatedReports + " reports without a valid date are excluded from the monthly trend."}</p>
    <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="sm:max-w-[calc(100vw-4rem)]"><DialogTitle>GIS Waste Monitoring Map</DialogTitle><DialogDescription>Uses the selected report type and date range. Colors show unresolved waste concerns.</DialogDescription><div className="relative isolate h-[65dvh]"><MapComponent barangayStats={mapStats} selectedBarangay={selectedBarangay} /></div></DialogContent></Dialog>
  </div>;
}
