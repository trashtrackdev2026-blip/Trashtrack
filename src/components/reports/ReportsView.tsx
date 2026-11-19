"use client";
import { reportBarangayLabel } from "@/lib/report-location-label";
import { BALETE_BARANGAYS } from "@/lib/barangay-geofence";
import { ReportEvidence } from "@/components/reports/ReportEvidence";

import { ReportActionFields } from "./ReportActionFields";
import { reportActionFields, type ReportActionInput } from "@/lib/report-action";
import type { ReportUpdateInput } from "@/lib/update-report";
import { isReportArchived, normalizeReportStatus } from "@/lib/report-workflow";
import { useRef, useState } from "react";
import { Search, FileText, Clock, Archive, AlertTriangle, Check, Send, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import Image from "next/image";
import dynamic from "next/dynamic";

import type { CommunityReport } from "@/hooks/use-reports";
import { DataState } from "@/components/ui/data-state";
import { nextReportStatuses, canUpdateReport, REPORT_STATUS_LABELS, REPORT_ACTION_LABELS, type ReportRole } from "@/lib/report-workflow";
import { filterReportSummary, type ReportSummaryFilter } from "@/lib/report-summary";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ReportMap = dynamic(() => import("@/components/ReportMap"), {
  ssr: false,
  loading: () => <div className="w-full h-48 bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-semibold rounded-xl animate-pulse">Loading Map...</div>
});

export function ReportsView({ reports, loading, error, retry, role, userBarangay, onUpdate }: {
  reports: CommunityReport[]; loading: boolean; error: string | null; retry: () => void;
  role: ReportRole; userBarangay: string | null;
  onUpdate: (report: CommunityReport, status: string, remarks: string, collected: boolean, details: ReportUpdateInput) => Promise<{deliveryError?:string}|void>;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [fullPhotoUrl, setFullPhotoUrl] = useState<string | null>(null);

  // Status update states
  const [newStatus, setNewStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [collectionConfirmed, setCollectionConfirmed] = useState(false);
  const [actionInput, setActionInput] = useState<ReportActionInput>({});
  const [openedVersion, setOpenedVersion] = useState({expectedStatus:"",expectedRevision:0});
  const preservedDraft = useRef<{id:string; status:string; remarks:string; confirmed:boolean; action:ReportActionInput} | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [saveMessage,setSaveMessage]=useState("");
  const [summaryFilter, setSummaryFilter] = useState<ReportSummaryFilter>("active");

  const [search, setSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const visibleReports = filterReportSummary(reports, summaryFilter, role).filter(report =>
    (!search.trim() || [report.id, report.type, report.description, report.location, report.reporterName].some(value => value.toLowerCase().includes(search.trim().toLowerCase())))
    && (barangayFilter === "all" || reportBarangayLabel(report.location) === barangayFilter) && (typeFilter === "all" || report.type === typeFilter));
  const activeReport = visibleReports.find(report => report.id === activeReportId);
  const allowedStatuses = activeReport
    ? nextReportStatuses(role, activeReport.status).filter(status => status !== "For MENRO Review")
    : [];
  const canOpenForwarding = !!activeReport && canUpdateReport(role, userBarangay, activeReport, "For MENRO Review");
  const resolvesLocally = role === "Semi-Admin" && newStatus === "Resolved";
  const actionDetails = resolvesLocally ? { ...actionInput, severity: "Minor" } : actionInput;
  let actionValid = true, actionError = "";
  try { const next=normalizeReportStatus(newStatus);if(next)reportActionFields(role,next,{...actionDetails,remarks}); } catch (failure) { actionValid=false;actionError=failure instanceof Error?failure.message:"Complete the action details."; }
  const canSave = !!activeReport && allowedStatuses.some(status => status === newStatus) && actionValid
    && canUpdateReport(role, userBarangay, activeReport, newStatus, collectionConfirmed);
  const openReport = (report: CommunityReport) => {
    const draft = preservedDraft.current?.id === report.id ? preservedDraft.current : null;
    const draftStatus = draft?.status;
    const canRestore = draftStatus && draftStatus !== "For MENRO Review"
      && nextReportStatuses(role, report.status).some(status => status === draftStatus);
    setShowConfirm(false);
    setActiveReportId(report.id);
    setNewStatus(canRestore ? draftStatus : "");
    setRemarks(draft?.remarks || "");
    setCollectionConfirmed(false);
    setActionInput(draft?.action || {});
    setOpenedVersion({ expectedStatus: report.status, expectedRevision: report.statusRevision || 0 });
    setUpdateError(null);
  };
  const summaryLabels = { all: "All reports", active: "Active reports", archived: "Archived reports", pending: role === "Semi-Admin" ? "Pending Review" : "Pending Validation",
    review: role === "Semi-Admin" ? "For MENRO Review" : "Under Review", resolved: "Archived reports", rejected: "Rejected reports" };
  const archiveSelected = summaryFilter === "archived" || summaryFilter === "resolved";
  const selectSummary = (filter: ReportSummaryFilter) => {
    if (isUpdating) return;
    setShowConfirm(false); setSummaryFilter(filter); setActiveReportId(null); setNewStatus(""); setRemarks(""); setCollectionConfirmed(false); setUpdateError(null);
  };
  const cardFilter = (filter: ReportSummaryFilter) => ({
    onClick: () => selectSummary(filter), selected: summaryFilter === filter, controls: "reports-table",
  });

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'pending': return "text-amber-600 bg-amber-50 border border-amber-100";
      case 'underreview':
      case 'under review': return "text-purple-600 bg-purple-50 border border-purple-100";
      case 'menro under review': return "text-purple-600 bg-purple-50 border border-purple-100";
      case 'formenroreview':
      case 'for menro review': return "text-red-600 bg-red-50 border border-red-100";
      case 'endorsed': return "text-orange-600 bg-orange-50 border border-orange-100";
      case 'resolved': return "text-[#2E7D32] bg-[#E8F5E9] border border-green-100";
      case 'rejected': return "text-red-800 bg-red-50 border border-red-200";
      default: return "text-slate-600 bg-slate-100 border border-slate-200";
    }
  };


  const handleUpdateStatus = async () => {
    if (!activeReport || !canSave || isUpdating) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const result=await onUpdate(activeReport, newStatus, remarks, collectionConfirmed, {...actionDetails,...openedVersion});
      const saved = normalizeReportStatus(newStatus) === "Resolved" ? "Report resolved and automatically archived. Open Archived reports to review it." : "Report update saved.";
      setSaveMessage(saved + (result?.deliveryError ? " Phone delivery is pending; resident progress notices retry when the app reconnects." : ""));
      setShowConfirm(false);
      setNewStatus("");
      setRemarks("");
      setCollectionConfirmed(false);
      preservedDraft.current=null;
      setActiveReportId(null);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="space-y-6 pb-8 relative">

        <DataState loading={loading} error={error} onRetry={retry} />
        {saveMessage&&<p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-900">{saveMessage}</p>}
        {/* Header */}


        {/* KPI Cards */}
        <div className="tt-metric-strip">
          <KpiCard
            {...cardFilter("all")}
            title="Total Reports"
            value={reports.length.toString()}
            subtitle={role === "Semi-Admin" ? "All received reports" : "All submitted reports"}
            icon={<FileText className="w-7 h-7" />}
            iconBgColor="bg-[#E8F5E9]"
            iconColor="text-[#2E7D32]"
          />
          <KpiCard
            {...cardFilter("pending")}
            title={role === "Semi-Admin" ? "Pending Review" : "Pending Validation"}
            value={filterReportSummary(reports, "pending", role).length.toString()}
            subtitle="Awaiting initial review"
            icon={<Clock className="w-7 h-7" />}
            iconBgColor="bg-amber-50"
            iconColor="text-amber-500"
          />
          {role === "Semi-Admin" ? (
            <KpiCard
              {...cardFilter("review")}
              title="For MENRO Review"
              value={filterReportSummary(reports, "review", role).length.toString()}
              subtitle="Review and send from Reports to MENRO"
              icon={<AlertTriangle className="w-7 h-7" />}
              iconBgColor="bg-red-50"
              iconColor="text-red-500"
            />
          ) : (
            <KpiCard
              {...cardFilter("review")}
              title="Under Review"
              value={filterReportSummary(reports, "review", role).length.toString()}
              subtitle="Currently being reviewed by MENRO"
              icon={<Search className="w-7 h-7" />}
              iconBgColor="bg-purple-50"
              iconColor="text-purple-500"
            />
          )}
          <KpiCard
            {...cardFilter("archived")}
            title="Archived Reports"
            value={filterReportSummary(reports, "archived", role).length.toString()}
            subtitle="Automatically archived on resolution"
            icon={<Archive className="w-7 h-7" />}
            iconBgColor="bg-[#E8F5E9]"
            iconColor="text-[#2E7D32]"
          />
        </div>

        <div className="tt-report-guidance">
          <h1 className="tt-legacy-heading text-[26px] font-bold text-slate-900 leading-tight">
            {role === "Semi-Admin" ? "Community Reports" : "Report Management"}
          </h1>
          <p className="text-sm text-slate-500">
            {role === "Semi-Admin"
              ? "Review reports in your barangay and resolve concerns within barangay capacity."
              : "Receive verified reports from Barangay Captains, schedule collection, and resolve reports after collection."}
          </p>
          {role === "Semi-Admin" && <Link href="/reports-to-menro" className="inline-flex w-fit items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"><Send className="h-4 w-4" />Reports to MENRO</Link>}
        </div>

        <div className="min-w-0">

          {/* Main Table Area */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Report storage" className="tt-tabs">
              <button type="button" aria-pressed={summaryFilter === "active"} disabled={isUpdating} onClick={() => selectSummary("active")}>Active reports ({filterReportSummary(reports, "active", role).length})</button>
              <button type="button" aria-pressed={archiveSelected} disabled={isUpdating} onClick={() => selectSummary("archived")}>Archived reports ({filterReportSummary(reports, "archived", role).length})</button>
              <button type="button" aria-pressed={summaryFilter === "rejected"} disabled={isUpdating} onClick={() => selectSummary("rejected")}>Rejected reports ({filterReportSummary(reports, "rejected", role).length})</button>
            </nav>
            <p className="text-xs text-muted-foreground">Resolved reports are archived automatically and remain available for reference.</p>
          </div>
          <div id="reports-table" className="min-w-0 flex-1 tt-surface flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
              <h2 className="text-sm font-semibold text-slate-900">{summaryLabels[summaryFilter]}</h2>
              {summaryFilter !== "active" && <button type="button" disabled={isUpdating} onClick={() => selectSummary("active")} className="rounded text-xs font-semibold text-green-800 underline focus-visible:outline-2 focus-visible:outline-green-700">Back to active reports</button>}
            </div>

            <div className="tt-filter-bar mx-4 mt-4">
              <label className="relative min-w-40 flex-1"><span className="sr-only">Search reports</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><input value={search} onChange={event => { setSearch(event.target.value);setActiveReportId(null);setShowConfirm(false); }} placeholder="Search reports" className="h-10 w-full rounded-lg border bg-white/50 pl-9 pr-3 text-sm" /></label>
              <Select value={barangayFilter} onValueChange={value => { setBarangayFilter(value || "all");setActiveReportId(null);setShowConfirm(false); }}><SelectTrigger aria-label="Report barangay" className="w-40"><SelectValue>{barangayFilter === "all" ? "All barangays" : barangayFilter}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All barangays</SelectItem>{BALETE_BARANGAYS.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
              <Select value={typeFilter} onValueChange={value => { setTypeFilter(value || "all");setActiveReportId(null);setShowConfirm(false); }}><SelectTrigger aria-label="Report category" className="w-40"><SelectValue>{typeFilter === "all" ? "All categories" : typeFilter}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{[...new Set(reports.map(report => report.type))].filter(Boolean).sort().map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="px-4 pb-2">
              {visibleReports.map(report => { const photo=report.photoReview?.status === "review" ? "" : report.imageUrl || report.attachments.find(item => item.type === "image")?.url;return <button key={report.id} type="button" disabled={isUpdating} className="tt-report-item" aria-pressed={activeReport?.id === report.id} onClick={() => openReport(report)}>
                <span className="tt-report-thumbnail">{photo ? <Image src={photo} alt="Report evidence" fill sizes="93px" className="object-cover" /> : <FileText aria-hidden="true" />}</span>
                <span className="tt-report-item-copy"><strong>{report.type}</strong><small>…{report.id.slice(-6)}{isReportArchived(report) ? " · Archived" : ""}</small><small>{report.location} · {report.date || "Date not recorded"}</small></span><span className={"tt-status " + (report.status.toLowerCase() === "pending" ? "tt-status-pending" : "")}>{REPORT_STATUS_LABELS[report.status as keyof typeof REPORT_STATUS_LABELS] || report.status}</span><ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>;})}
              {!loading && visibleReports.length === 0 && <p className="tt-empty">{archiveSelected && !search && barangayFilter === "all" && typeFilter === "all" ? "No archived reports yet. Reports appear here automatically when resolved." : "No reports match this view."}</p>}
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500" role="status">Showing {visibleReports.length} of {reports.length} reports</span>
            </div>
          </div>

          {/* Report details open only after a report is selected. */}
          <Dialog open={!!activeReport} onOpenChange={open => { if (!open && !isUpdating) { setActiveReportId(null);setShowConfirm(false);setNewStatus("");setRemarks(""); } }}>
          {activeReport && (
            <DialogContent key={activeReport.id} className="tt-content tt-report-dialog gap-0 p-0" showCloseButton={!isUpdating}>
              <DialogDescription className="sr-only">Review the submitted evidence, location and report status.</DialogDescription>
              <div className="p-5 pr-12 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex flex-col">
                  <DialogTitle className="font-bold text-slate-900">Report Details</DialogTitle>
                  <span className="text-xs font-bold text-slate-500 mt-1">ID: ...{activeReport.id.slice(-6)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold ${getStatusColor(activeReport.status)}`}>
                    {REPORT_STATUS_LABELS[activeReport.status as keyof typeof REPORT_STATUS_LABELS] || activeReport.status}
                  </span>
                </div>
              </div>

              <div className="tt-report-workspace">
                <section className="tt-report-pane" aria-label="Report evidence and information" tabIndex={0}>
                {/* Evidence */}
                <div>
                  <h4 className="tt-report-section-title">Evidence photos and videos</h4>
                  <ReportEvidence report={activeReport} />
                </div>

                {/* Report Information */}
                <div>
                  <h4 className="tt-report-section-title">Report information</h4>
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#f8faf3] p-3 sm:grid-cols-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-slate-500">Submitted By</span>
                      <span className="text-xs font-bold text-slate-900">{activeReport.reporterName}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-slate-500">Date</span>
                      <span className="text-xs font-bold text-slate-900">{activeReport.date}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-slate-500">Barangay</span>
                      <span className="text-xs font-bold text-slate-900">{activeReport.location}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-slate-500">Category</span>
                      <span className="text-xs font-bold text-slate-900">{activeReport.type}</span>
                    </div>
                  </div>
                </div>

                {/* Report Details */}
                <div>
                  <h4 className="tt-report-section-title">Description</h4>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {activeReport.description || "No description provided."}
                    </span>
                  </div>
                </div>

                {/* Location Map */}
                {(activeReport.latitude && activeReport.longitude) && (
                  <div>
                    <h4 className="tt-report-section-title">Pinned location</h4>
                    <div className="tt-report-map">
                      <ReportMap
                        latitude={activeReport.latitude}
                        longitude={activeReport.longitude}
                        label={activeReport.location}
                      />
                    </div>
                  </div>
                )}
                </section>
                <section className="tt-report-pane" aria-label="Report status and actions" tabIndex={0}>
                {activeReport.status === "Rejected" && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><p className="font-semibold">{activeReport.rejectionReason || "Report rejected"}</p><p className="whitespace-pre-wrap">{activeReport.rejectionNotes || activeReport.remarks}</p>{activeReport.rejectedByName && <p className="mt-2 text-xs">Reviewed by {activeReport.rejectedByName}</p>}</div>}
                {isReportArchived(activeReport) && <div className="flex items-start gap-3 rounded-xl border border-[#cbd9c7] bg-[#e9edd9] p-4 text-sm text-[#194f3d]">
                  <Archive className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div><p className="font-semibold">Archived report</p><p>This report was resolved and archived automatically.</p>
                    {(activeReport.archivedAt || activeReport.resolvedAt) && <p className="mt-1 text-xs">Resolved on {new Date(activeReport.archivedAt || activeReport.resolvedAt!).toLocaleString("en-PH", {timeZone:"Asia/Manila",year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</p>}
                  </div>
                </div>}
                {(activeReport.resolvedByName || activeReport.actionKind) && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
                  {activeReport.resolvedByName && <p>Resolved by {activeReport.resolvedByName} ({activeReport.resolvedByRole === "Semi-Admin" ? "Barangay" : "MENRO"})</p>}
                  {activeReport.actionKind && <><p className="font-semibold">Response: {activeReport.actionKind}</p><p>{activeReport.actionNotes}</p><p>{activeReport.actionDate} {activeReport.actionTime}</p></>}
                </div>}
                {activeReport.remarks && activeReport.status !== "Rejected" && <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-semibold mb-1">{isReportArchived(activeReport) ? "Resolution details" : "Last review remarks"}</p>
                  <p className="whitespace-pre-wrap">{activeReport.remarks}</p>
                </div>}
                {/* Update Status Form */}
                {allowedStatuses.length > 0 && <div className="tt-dark-panel tt-report-review">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-4">Update Status</h4>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700">Status <span className="text-red-500">*</span></label>
                      <Select value={newStatus} disabled={allowedStatuses.length === 0} onValueChange={(val) => { setActiveReportId(activeReport.id); setNewStatus(val || ""); setCollectionConfirmed(false);setActionInput({}); }}>
                        <SelectTrigger aria-label="New report status" className="w-full h-10 bg-white border-slate-200 font-semibold">
                          <SelectValue placeholder="Select new status" />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedStatuses.map(status => (
                            <SelectItem key={status} value={status}>{role === "Semi-Admin" && status === "Resolved" ? "Resolve minor report locally" : REPORT_ACTION_LABELS[status]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <ReportActionFields role={role} status={newStatus} value={actionInput} onChange={setActionInput} disabled={isUpdating} barangay={activeReport.location} />
                    {newStatus === "Resolved" && <label className="flex gap-2 items-start text-xs text-slate-700">
                      <input type="checkbox" checked={collectionConfirmed} onChange={event => setCollectionConfirmed(event.target.checked)} className="mt-0.5" />
                      I confirm the reported concern has been addressed and the action is complete.
                    </label>}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700">{newStatus === "Rejected" ? "Reason for the resident (required)" : newStatus === "Resolved" ? "Resolution details (required)" : "Review remarks"}</label>
                      <textarea
                        aria-label="Review remarks" maxLength={2000}
                        rows={3}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E7D32] resize-none"
                        placeholder={newStatus === "Resolved" ? "Describe the work that addressed the concern…" : "Describe your findings…"}
                      />
                    </div>
                    {newStatus && actionError && <p role="status" className="text-xs leading-relaxed">{actionError}</p>}

                    <Button
                      onClick={() => { setUpdateError(null); setShowConfirm(true); }}
                      disabled={!canSave || isUpdating}
                      className="w-full h-10 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm disabled:opacity-50"
                    >
                      {resolvesLocally ? "Resolve locally" : "Update Status"}
                    </Button>
                  </div>
                </div>}

                {canOpenForwarding && <div className="rounded-xl border border-[#cbd9c7] bg-[#e9edd9] p-4 text-sm text-[#194f3d]">
                  <p>For concerns beyond barangay capacity, continue in Reports to MENRO.</p>
                  <Link href="/reports-to-menro" className="mt-2 inline-flex min-h-9 items-center gap-2 font-semibold underline underline-offset-4">
                    Open Reports to MENRO <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>}

                {allowedStatuses.length === 0 && !isReportArchived(activeReport) && activeReport.status !== "Rejected" && <p className="text-sm text-muted-foreground">
                  {role === "Semi-Admin" ? "Forwarded reports are handled by MENRO." : "MENRO can plan a response after the barangay official verifies and forwards the report."}
                </p>}

                </section>
              </div>
      <Dialog open={showConfirm && !!newStatus && !!activeReport} onOpenChange={open => { if (!isUpdating) setShowConfirm(open); }}>
        {activeReport && <DialogContent className="z-[60] max-h-[calc(100dvh-2rem)] overflow-y-auto gap-0 p-0 sm:max-w-sm" showCloseButton={!isUpdating}>
          <DialogHeader className="sticky top-0 z-10 border-b border-slate-100 bg-white p-5 pr-12">
            <DialogTitle className="flex items-center gap-2 font-bold text-slate-900 leading-snug">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /> Confirm Status Update
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 p-5">
            <dl className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3">
              <dt className="text-xs font-semibold text-slate-500">Report ID:</dt>
              <dd className="break-all text-sm font-bold text-slate-900">...{activeReport.id.slice(-6)}</dd>
              <dt className="text-xs font-semibold text-slate-500">New Status:</dt>
              <dd><span className={`inline-block rounded-full px-2 py-1 text-xs font-bold ${getStatusColor(newStatus)}`}>{REPORT_STATUS_LABELS[newStatus as keyof typeof REPORT_STATUS_LABELS] || newStatus}</span></dd>
            </dl>
            <DialogDescription className="text-center text-sm text-slate-600">{newStatus === "Rejected" ? "Reject this report? The resident will receive your reason and the report will appear in Rejected reports." : newStatus === "Resolved" ? "Confirm resolution? The report will move to Archived reports automatically and the resident will receive the resolution update." : "Are you sure you want to update this report?"}</DialogDescription>
            {updateError && <div className="space-y-3"><p role="alert" className="text-sm text-red-700">{updateError}</p>{updateError.includes("changed") && <Button variant="outline" onClick={() => {preservedDraft.current={id:activeReport.id,status:newStatus,remarks,confirmed:collectionConfirmed,action:actionInput};setShowConfirm(false);setActiveReportId(null);retry();setSaveMessage("Reloading the latest reports. Reopen this report to review its current stage; your notes and action draft are kept. Confirm the action again after reviewing.");}}>Review latest report</Button>}</div>}
          </div>
          <DialogFooter className="sticky bottom-0 mx-0 mb-0 flex-row gap-3 border-t border-slate-100 bg-white p-4">
            <Button onClick={() => setShowConfirm(false)} disabled={isUpdating} variant="outline" className="h-10 flex-1 rounded-xl border-slate-200 font-semibold text-slate-600">Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={isUpdating || !canSave} className="h-10 flex-1 rounded-xl bg-[#1B5E20] font-semibold text-white hover:bg-[#2E7D32]">
              {isUpdating ? "Saving..." : <>Confirm <Check className="ml-1.5 h-4 w-4" /></>}
            </Button>
          </DialogFooter>
        </DialogContent>}
      </Dialog>

            </DialogContent>
          )}
          </Dialog>

        </div>

      </div>

      {/* Full Photo Modal */}
      {fullPhotoUrl && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setFullPhotoUrl(null)}
        >
          <div className="relative w-full max-w-4xl h-[85vh] rounded-lg overflow-hidden cursor-default" onClick={(e) => e.stopPropagation()}>
            <Image
              src={fullPhotoUrl}
              alt="Full Evidence"
              fill
              className="object-contain"
            />
            <button
              onClick={() => setFullPhotoUrl(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full text-white flex items-center justify-center transition-colors shadow-lg"
            >
              <span className="text-2xl leading-none">&times;</span>
            </button>
          </div>
        </div>
      )}

    </>
  );
}
