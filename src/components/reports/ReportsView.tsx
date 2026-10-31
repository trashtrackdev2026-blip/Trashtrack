"use client";
import { reportBarangayLabel } from "@/lib/report-location-label";
import { BALETE_BARANGAYS } from "@/lib/barangay-geofence";
import { ReportEvidence } from "@/components/reports/ReportEvidence";

import { useState } from "react";
import { Search, FileText, Clock, CheckCircle2, AlertTriangle, Check, Send, ArrowUpRight } from "lucide-react";
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
  onUpdate: (report: CommunityReport, status: string, remarks: string, collected: boolean) => Promise<void>;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [fullPhotoUrl, setFullPhotoUrl] = useState<string | null>(null);

  // Status update states
  const [newStatus, setNewStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [collectionConfirmed, setCollectionConfirmed] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [summaryFilter, setSummaryFilter] = useState<ReportSummaryFilter>("all");

  const [search, setSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const visibleReports = filterReportSummary(reports, summaryFilter, role).filter(report =>
    (!search.trim() || [report.id, report.type, report.description, report.location, report.reporterName].some(value => value.toLowerCase().includes(search.trim().toLowerCase())))
    && (barangayFilter === "all" || reportBarangayLabel(report.location) === barangayFilter) && (typeFilter === "all" || report.type === typeFilter));
  const activeReport = visibleReports.find(report => report.id === activeReportId);
  const allowedStatuses = activeReport ? nextReportStatuses(role, activeReport.status) : [];
  const canSave = !!activeReport && canUpdateReport(role, userBarangay, activeReport, newStatus, collectionConfirmed);
  const summaryLabels = { all: "All reports", pending: role === "Semi-Admin" ? "Pending Review" : "Pending Validation",
    review: role === "Semi-Admin" ? "For MENRO Review" : "Under Review", resolved: role === "Semi-Admin" ? "Resolved" : "Resolved Reports" };
  const selectSummary = (filter: ReportSummaryFilter) => {
    if (isUpdating) return;
    setSummaryFilter(filter); setActiveReportId(null); setNewStatus(""); setRemarks(""); setCollectionConfirmed(false); setUpdateError(null);
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
      default: return "text-slate-600 bg-slate-100 border border-slate-200";
    }
  };


  const handleUpdateStatus = async () => {
    if (!activeReport || !canSave || isUpdating) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await onUpdate(activeReport, newStatus, remarks, collectionConfirmed);
      setShowConfirm(false);
      setNewStatus("");
      setRemarks("");
      setCollectionConfirmed(false);
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
            {...cardFilter("resolved")}
            title={role === "Semi-Admin" ? "Resolved" : "Resolved Reports"}
            value={filterReportSummary(reports, "resolved", role).length.toString()}
            subtitle={role === "Semi-Admin" ? "Already addressed" : "Successfully resolved"}
            icon={<CheckCircle2 className="w-7 h-7" />}
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
              ? "Review reports in your barangay, verify the location, and forward confirmed reports to MENRO."
              : "Receive verified reports from Barangay Captains, schedule collection, and resolve reports after collection."}
          </p>
          {role === "Semi-Admin" && <Link href="/reports-to-menro" className="inline-flex w-fit items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"><Send className="h-4 w-4" />Reports to MENRO</Link>}
        </div>

        <div className="min-w-0">

          {/* Main Table Area */}
          <div id="reports-table" className="min-w-0 flex-1 tt-surface flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
              <h2 className="text-sm font-semibold text-slate-900">{summaryLabels[summaryFilter]}</h2>
              {summaryFilter !== "all" && <button type="button" onClick={() => selectSummary("all")} className="rounded text-xs font-semibold text-green-800 underline focus-visible:outline-2 focus-visible:outline-green-700">Show all reports</button>}
            </div>

            <div className="tt-filter-bar mx-4 mt-4">
              <label className="relative min-w-40 flex-1"><span className="sr-only">Search reports</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><input value={search} onChange={event => { setSearch(event.target.value);setActiveReportId(null); }} placeholder="Search reports" className="h-10 w-full rounded-lg border bg-white/50 pl-9 pr-3 text-sm" /></label>
              <Select value={barangayFilter} onValueChange={value => { setBarangayFilter(value || "all");setActiveReportId(null); }}><SelectTrigger aria-label="Report barangay" className="w-40"><SelectValue>{barangayFilter === "all" ? "All barangays" : barangayFilter}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All barangays</SelectItem>{BALETE_BARANGAYS.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
              <Select value={typeFilter} onValueChange={value => { setTypeFilter(value || "all");setActiveReportId(null); }}><SelectTrigger aria-label="Report category" className="w-40"><SelectValue>{typeFilter === "all" ? "All categories" : typeFilter}</SelectValue></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{[...new Set(reports.map(report => report.type))].filter(Boolean).sort().map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="px-4 pb-2">
              {visibleReports.map(report => { const photo=report.imageUrl || report.attachments.find(item => item.type === "image")?.url;return <button key={report.id} type="button" disabled={isUpdating} className="tt-report-item" aria-pressed={activeReport?.id === report.id} onClick={() => { setActiveReportId(report.id);setNewStatus("");setRemarks("");setCollectionConfirmed(false);setUpdateError(null); }}>
                <span className="tt-report-thumbnail">{photo ? <Image src={photo} alt="Report evidence" fill sizes="93px" className="object-cover" /> : <FileText aria-hidden="true" />}</span>
                <span className="tt-report-item-copy"><strong>{report.type}</strong><small>…{report.id.slice(-6)}</small><small>{report.location} · {report.date || "Date not recorded"}</small></span><span className={"tt-status " + (report.status.toLowerCase() === "pending" ? "tt-status-pending" : "")}>{REPORT_STATUS_LABELS[report.status as keyof typeof REPORT_STATUS_LABELS] || report.status}</span><ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>;})}
              {!loading && visibleReports.length === 0 && <p className="tt-empty">No reports match this view.</p>}
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500" role="status">Showing {visibleReports.length} of {reports.length} reports</span>
            </div>
          </div>

          {/* Report details open only after a report is selected. */}
          <Dialog open={!!activeReport} onOpenChange={open => { if (!open && !isUpdating) { setActiveReportId(null);setShowConfirm(false);setNewStatus("");setRemarks(""); } }}>
          {activeReport && (
            <DialogContent key={activeReport.id} className="tt-content tt-report-dialog gap-0 p-0 sm:max-w-3xl" showCloseButton={!isUpdating}>
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

              <div className="p-5 space-y-6">

                {/* Evidence */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-3">Evidence photos and videos</h4>
                  <ReportEvidence report={activeReport} />
                </div>

                {/* Report Information */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Information</h4>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2">
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
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Description</h4>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {activeReport.description || "No description provided."}
                    </span>
                  </div>
                </div>

                {/* Location Map */}
                {(activeReport.latitude && activeReport.longitude) && (
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-3">Pinned Location</h4>
                    <div className="w-full h-48 rounded-xl overflow-hidden shadow-sm border border-slate-200">
                      <ReportMap
                        latitude={activeReport.latitude}
                        longitude={activeReport.longitude}
                        label={activeReport.location}
                      />
                    </div>
                  </div>
                )}

                {activeReport.remarks && <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-semibold mb-1">Last review remarks</p>
                  <p className="whitespace-pre-wrap">{activeReport.remarks}</p>
                </div>}
                {/* Update Status Form */}
                <div className="tt-dark-panel tt-report-review mt-2">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-4">Update Status</h4>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700">Status <span className="text-red-500">*</span></label>
                      <Select value={newStatus} disabled={allowedStatuses.length === 0} onValueChange={(val) => { setActiveReportId(activeReport.id); setNewStatus(val || ""); setCollectionConfirmed(false); }}>
                        <SelectTrigger aria-label="New report status" className="w-full h-10 bg-white border-slate-200 font-semibold">
                          <SelectValue placeholder="Select new status" />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedStatuses.map(status => (
                            <SelectItem key={status} value={status}>{REPORT_ACTION_LABELS[status]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {allowedStatuses.length === 0 && <p className="text-xs text-slate-600">
                      {role === "Semi-Admin" ? "Forwarded reports are handled by MENRO. Resolved reports remain available for reference." : "MENRO can schedule a report after the Barangay Captain verifies and forwards it."}
                    </p>}
                    {newStatus === "Resolved" && <label className="flex gap-2 items-start text-xs text-slate-700">
                      <input type="checkbox" checked={collectionConfirmed} onChange={event => setCollectionConfirmed(event.target.checked)} className="mt-0.5" />
                      I confirm the reported garbage has been collected.
                    </label>}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700">Review Remarks (Optional)</label>
                      <textarea
                        aria-label="Review remarks"
                        rows={3}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E7D32] resize-none"
                        placeholder="Add internal remarks about this update..."
                      />
                    </div>

                    <Button
                      onClick={() => { setUpdateError(null); setShowConfirm(true); }}
                      disabled={!canSave || isUpdating}
                      className="w-full h-10 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm disabled:opacity-50"
                    >
                      Update Status
                    </Button>
                  </div>
                </div>

              </div>
            </DialogContent>
          )}
          </Dialog>

        </div>

      </div>

      <Dialog open={showConfirm && !!activeReport} onOpenChange={open => { if (!isUpdating) setShowConfirm(open); }}>
        {activeReport && <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto gap-0 p-0 sm:max-w-sm" showCloseButton={!isUpdating}>
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
            <DialogDescription className="text-center text-sm text-slate-600">Are you sure you want to update this report?</DialogDescription>
            {updateError && <p role="alert" className="text-sm text-red-700">{updateError}</p>}
          </div>
          <DialogFooter className="sticky bottom-0 mx-0 mb-0 flex-row gap-3 border-t border-slate-100 bg-white p-4">
            <Button onClick={() => setShowConfirm(false)} disabled={isUpdating} variant="outline" className="h-10 flex-1 rounded-xl border-slate-200 font-semibold text-slate-600">Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={isUpdating || !canSave} className="h-10 flex-1 rounded-xl bg-[#1B5E20] font-semibold text-white hover:bg-[#2E7D32]">
              {isUpdating ? "Saving..." : <>Confirm <Check className="ml-1.5 h-4 w-4" /></>}
            </Button>
          </DialogFooter>
        </DialogContent>}
      </Dialog>

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
