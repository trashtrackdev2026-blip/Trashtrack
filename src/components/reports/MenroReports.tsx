"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Eye, FileCheck2, ImageIcon, Search, Send, Truck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useReports, type CommunityReport } from "@/hooks/use-reports";
import { updateReportStatus } from "@/lib/update-report";
import { canUpdateReport, type ReportRole } from "@/lib/report-workflow";
import { filterMenroReports, MENRO_STAGES, menroStage, menroStatusLabel, reportDate, type MenroStage } from "@/lib/menro-reports";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ReportMap = dynamic(() => import("@/components/ReportMap"), { ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" aria-label="Loading report location" /> });
const PAGE_SIZE = 8;
const stageStyles: Record<MenroStage, string> = {
  ready: "bg-amber-50 text-amber-800 border-amber-100",
  submitted: "bg-blue-50 text-blue-700 border-blue-100",
  review: "bg-purple-50 text-purple-700 border-purple-100",
  collection: "bg-orange-50 text-orange-700 border-orange-100",
  resolved: "bg-green-50 text-green-800 border-green-100",
};
const stageIcons = { ready: Send, submitted: FileCheck2, review: Clock3, collection: Truck, resolved: CheckCircle2 };
const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-2 focus:outline-green-700";

function StatusBadge({ status }: { status: string }) {
  const stage = menroStage(status);
  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${stage ? stageStyles[stage] : "bg-slate-50 text-slate-600"}`}>{menroStatusLabel(status)}</span>;
}

function ReportPhoto({ report, large = false }: { report: CommunityReport; large?: boolean }) {
  return <div className={`relative shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 ${large ? "h-52 w-full" : "h-14 w-16"}`}>
    {report.imageUrl ? <Image src={report.imageUrl} alt={`Evidence for ${report.type}`} fill sizes={large ? "600px" : "64px"} unoptimized className={large ? "object-contain" : "object-cover"} />
      : <div className="flex h-full items-center justify-center text-slate-400"><ImageIcon className="h-5 w-5" aria-label="No photo uploaded" /></div>}
  </div>;
}

function DateReported({ value }: { value: string }) {
  const date = reportDate(value);
  return date ? <div className="space-y-1 whitespace-nowrap"><p>{date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })}</p><p className="text-xs text-slate-400">{date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}</p></div> : <span>{value || "Not recorded"}</span>;
}

export function MenroReports() {
  const { user, role, barangay } = useAuth();
  const { reports, loading, error, retry } = useReports();
  return <MenroReportsView reports={reports} loading={loading} error={error} retry={retry} role={role} barangay={barangay}
    onSend={async (report, remarks) => {
      if (!user) throw new Error("Sign in to forward reports.");
      await updateReportStatus(report.id, { uid: user.uid, role, barangay }, "For MENRO Review", remarks, false);
    }} />;
}

// Render offline fixtures without creating privileged accounts or live reports.
export function MenroReportsView({ reports, loading, error, retry, role, barangay, onSend }: {
  reports: CommunityReport[]; loading: boolean; error: string | null; retry: () => void;
  role: ReportRole; barangay: string | null; onSend: (report: CommunityReport, remarks: string) => Promise<void>;
}) {
  const [stage, setStage] = useState<MenroStage>(role === "Admin" ? "submitted" : "ready");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [days, setDays] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendError, setSendError] = useState("");
  const [notice, setNotice] = useState("");
  const submitting = useRef(false);
  const semiAdmin = role === "Semi-Admin";
  const scoped = semiAdmin ? reports.filter(report => !!barangay && report.location === barangay) : reports;
  const filtered = filterMenroReports(scoped, { stage, search, status: statusFilter, barangay: barangayFilter, days, assignedBarangay: semiAdmin ? barangay : null });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = scoped.find(report => report.id === selectedId);
  const canSend = !!selected && canUpdateReport(role, barangay, selected, "For MENRO Review");
  const locations = [...new Set(scoped.map(report => report.location).filter(Boolean))].sort();

  function openReport(report: CommunityReport) {
    setSelectedId(report.id); setConfirmed(false); setRemarks(report.remarks); setSendError("");
  }
  function chooseStage(next: MenroStage) { setStage(next); setStatusFilter("all"); setPage(1); }
  async function send() {
    if (!selected || !canSend || !confirmed || submitting.current || loading || error) return;
    submitting.current = true; setSaving(true); setSendError("");
    try {
      await onSend(selected, remarks);
      setSelectedId(null); setConfirmed(false); setRemarks("");
      setNotice(`${selected.type} was sent to MENRO. It is now waiting for MENRO review.`);
      chooseStage("submitted");
    } catch (failure) { setSendError(failure instanceof Error ? failure.message : "The report could not be sent. Try again."); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <section className="mx-auto max-w-[1400px] space-y-5 pb-8">
    <DataState loading={loading} error={error} onRetry={retry} />
    {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><p>{notice}</p></div>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-medium text-slate-700">{semiAdmin ? `${barangay || "Assigned barangay"} reports` : "Barangay reports"}</p><p className="mt-1 text-xs leading-5 text-slate-500">{semiAdmin ? "Review the evidence, send verified reports, and follow MENRO's response." : "Review forwarded barangay reports and monitor collection progress."}</p></div>
      <Link href="/reports" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-green-800 hover:bg-green-50"><FileCheck2 className="h-4 w-4" />{semiAdmin ? "Review community reports" : "Open report management"}</Link>
    </div>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[68.75rem]:grid-cols-5">
      {MENRO_STAGES.map(item => {
        const Icon = stageIcons[item.id];
        return <button key={item.id} type="button" onClick={() => chooseStage(item.id)} aria-pressed={stage === item.id} className={`flex min-h-28 items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-green-300 focus-visible:outline-2 focus-visible:outline-green-700 ${stage === item.id ? "border-green-500 ring-1 ring-green-100" : "border-slate-200"}`}>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${item.id === "ready" ? "bg-green-50 text-green-700" : stageStyles[item.id]}`}><Icon className="h-5 w-5" /></span>
          <span className="min-w-0"><span className="block text-[11px] font-semibold text-slate-700">{item.label}</span><span className="mt-1 block text-2xl font-bold leading-none text-slate-900">{scoped.filter(report => menroStage(report.status) === item.id).length}</span><span className="mt-2 block text-[10px] leading-4 text-slate-400">{item.description}</span></span>
        </button>;
      })}
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1.4fr)_1fr_1fr_1fr]">
      <div className="relative self-end"><label htmlFor="menro-search" className="sr-only">Search reports</label><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input id="menro-search" type="search" placeholder="Search reports…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className={`${selectClass} pl-9`} /></div>
      <div><label htmlFor="menro-status" className="mb-1 block text-xs font-semibold text-slate-600">Status</label><select id="menro-status" value={statusFilter} onChange={event => { const value = event.target.value; setStatusFilter(value); if (value !== "all") setStage(value as MenroStage); setPage(1); }} className={selectClass}><option value="all">All statuses in this tab</option>{MENRO_STAGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
      <div><label htmlFor="menro-barangay" className="mb-1 block text-xs font-semibold text-slate-600">Barangay</label><select id="menro-barangay" value={semiAdmin ? barangay || "all" : barangayFilter} disabled={semiAdmin} onChange={event => { setBarangayFilter(event.target.value); setPage(1); }} className={`${selectClass} disabled:bg-slate-50 disabled:text-slate-600`}>
        {semiAdmin ? <option value={barangay || "all"}>{barangay || "No barangay assigned"}</option> : <><option value="all">All barangays</option>{locations.map(location => <option key={location} value={location}>{location}</option>)}</>}
      </select></div>
      <div><label htmlFor="menro-date" className="mb-1 block text-xs font-semibold text-slate-600">Date range</label><select id="menro-date" value={days} onChange={event => { setDays(Number(event.target.value)); setPage(1); }} className={selectClass}><option value={0}>All time</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div>
    </div>

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <nav aria-label="Report progress" className="flex gap-5 overflow-x-auto border-b border-slate-100 px-5">
        {MENRO_STAGES.map(item => <button key={item.id} type="button" onClick={() => chooseStage(item.id)} aria-pressed={stage === item.id} className={`shrink-0 border-b-2 py-4 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-green-700 ${stage === item.id ? "border-green-700 text-green-800" : "border-transparent text-slate-500 hover:text-green-800"}`}>{item.label}</button>)}
      </nav>
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-xs">
        <caption className="sr-only">{MENRO_STAGES.find(item => item.id === stage)?.label} reports{semiAdmin ? ` in ${barangay}` : ""}</caption>
        <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] text-slate-600"><tr>{["Report details", "Barangay", "Date reported", "Endorsed by", "Status", "Action"].map(label => <th key={label} scope="col" className="px-5 py-3.5 font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(report => <tr key={report.id} className="hover:bg-slate-50/70">
            <td className="max-w-[300px] px-5 py-4"><div className="flex items-center gap-3"><ReportPhoto report={report} /><div className="min-w-0"><button onClick={() => openReport(report)} className="text-left font-semibold text-slate-900 hover:text-green-800 hover:underline">{report.type}</button><p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{report.description || "No description provided"}</p><p className="mt-1 text-[10px] text-slate-400">By {report.reporterName}</p></div></div></td>
            <td className="px-5 py-4 font-medium text-slate-700">{report.location}</td>
            <td className="px-5 py-4 text-slate-700"><DateReported value={report.date} /></td>
            <td className="px-5 py-4 text-slate-700">{report.forwardedByName || report.verifiedByName || report.reviewedByName || "Not recorded"}<p className="mt-1 text-[10px] text-slate-400">Barangay official</p></td>
            <td className="px-5 py-4"><StatusBadge status={report.status} /></td>
            <td className="px-5 py-4"><div className="flex items-center gap-2">{canUpdateReport(role, barangay, report, "For MENRO Review") && <Button onClick={() => openReport(report)} disabled={saving || loading || !!error} variant="outline" className="h-8 rounded-md border-green-200 px-2.5 text-[11px] font-semibold text-green-800 hover:bg-green-50"><Send className="h-3.5 w-3.5" />Send to MENRO</Button>}<button onClick={() => openReport(report)} aria-label={`View ${report.type} report ${report.id.slice(-6)}`} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-green-700"><Eye className="h-4 w-4" /></button></div></td>
          </tr>)}
          {!rows.length && <tr><td colSpan={6} className="px-5 py-14 text-center"><FileCheck2 className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-semibold text-slate-700">{loading ? "Loading reports…" : error ? "Reports could not be loaded" : "No reports in this view"}</p><p className="mt-2 text-xs text-slate-500">{stage === "ready" && !search && !days ? "Start reviewing a pending report in Community Reports, then return here to send it to MENRO." : "Try another status tab or adjust your filters."}</p>{stage === "ready" && <Link href="/reports" className="mt-4 inline-block font-semibold text-green-800 hover:underline">Open Community Reports</Link>}</td></tr>}
        </tbody>
      </table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500"><p>Showing {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} reports</p><div className="flex items-center gap-2"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="rounded-md bg-green-50 px-2.5 py-1.5 font-semibold text-green-800">{currentPage} / {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} aria-label="Next page" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
    </div>

    <Dialog open={selectedId !== null} onOpenChange={open => { if (!open && !submitting.current) setSelectedId(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader><DialogTitle>{canSend ? "Send report to MENRO" : "Report details"}</DialogTitle><DialogDescription>{canSend ? "Review the report and confirm its location before forwarding it to MENRO." : "Follow the report's current status and review its submitted evidence."}</DialogDescription></DialogHeader>
        {selected ? <>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{selected.type}</p><StatusBadge status={selected.status} /></div>
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-xs"><div><p className="mb-1 text-slate-500">Barangay</p><p className="font-semibold">{selected.location}</p></div><div><p className="mb-1 text-slate-500">Reported by</p><p className="font-semibold">{selected.reporterName}</p></div><div><p className="mb-1 text-slate-500">Date reported</p><DateReported value={selected.date} /></div><div><p className="mb-1 text-slate-500">Report ID</p><p className="break-all">{selected.id}</p></div></div>
          <div><p className="mb-2 text-xs font-semibold text-slate-700">Description</p><p className="whitespace-pre-wrap rounded-lg border border-slate-100 p-3 text-sm leading-6 text-slate-600">{selected.description || "No description provided."}</p></div>
          <ReportPhoto report={selected} large />
          {typeof selected.latitude === "number" && typeof selected.longitude === "number" && Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude) && <div><p className="mb-2 text-xs font-semibold text-slate-700">Pinned location</p><div className="h-[280px] min-h-[280px] w-full sm:h-[360px]"><ReportMap latitude={selected.latitude} longitude={selected.longitude} label={selected.location} /></div></div>}
          {selected.forwardedAt && <p className="text-xs text-slate-500">Forwarded {reportDate(selected.forwardedAt)?.toLocaleString("en-PH", { timeZone: "Asia/Manila" })} by {selected.forwardedByName || "the barangay official"}.</p>}
          {canSend ? <><div><label htmlFor="forward-remarks" className="mb-2 block text-xs font-semibold text-slate-700">Remarks for MENRO (optional)</label><textarea id="forward-remarks" rows={3} maxLength={2000} value={remarks} disabled={saving} onChange={event => setRemarks(event.target.value)} placeholder="Add the location details or findings MENRO should know…" className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-2 focus:outline-green-700" /></div><label className="flex items-start gap-3 rounded-lg border border-green-100 bg-green-50 p-3 text-sm leading-5 text-green-900"><input type="checkbox" checked={confirmed} disabled={saving} onChange={event => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-green-800" />I verified the report and its location in {barangay}, and confirm it is ready for MENRO review.</label></> : selected.remarks && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><p className="mb-1 font-semibold">Latest remarks</p><p className="whitespace-pre-wrap">{selected.remarks}</p></div>}
          {sendError && <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4 shrink-0" />{sendError}</p>}
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setSelectedId(null)}>{canSend ? "Cancel" : "Close"}</Button>{canSend && <Button disabled={!confirmed || saving || loading || !!error} onClick={send} className="bg-green-800 text-white hover:bg-green-900"><Send className="h-4 w-4" />{saving ? "Sending…" : "Send to MENRO"}</Button>}{role === "Admin" && <Link href="/reports" className="inline-flex items-center justify-center rounded-lg bg-green-800 px-4 py-2 font-medium text-white hover:bg-green-900">Review in report management</Link>}</DialogFooter>
        </> : <p className="py-6 text-sm text-slate-600">This report is no longer available. Close this dialog and refresh the list.</p>}
      </DialogContent>
    </Dialog>
  </section>;
}
