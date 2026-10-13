"use client";

import { useState } from "react";
import { Search, FileText, Clock, CheckCircle2, AlertTriangle, ImageIcon, Check, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import Image from "next/image";
import dynamic from "next/dynamic";

import { useAuth } from "@/context/AuthContext";
import { useReports } from "@/hooks/use-reports";
import { DataState } from "@/components/ui/data-state";
import { nextReportStatuses, canUpdateReport, REPORT_STATUS_LABELS, normalizeReportStatus } from "@/lib/report-workflow";
import { updateReportStatus } from "@/lib/update-report";

const ReportMap = dynamic(() => import("@/components/ReportMap"), {
  ssr: false,
  loading: () => <div className="w-full h-48 bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-semibold rounded-xl animate-pulse">Loading Map...</div>
});

export default function ReportsPage() {
  const { user, role, barangay: userBarangay } = useAuth();
  const { reports: allReports, loading, error, retry } = useReports();
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [fullPhotoUrl, setFullPhotoUrl] = useState<string | null>(null);
  
  // Status update states
  const [newStatus, setNewStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [collectionConfirmed, setCollectionConfirmed] = useState(false);

  const reports = allReports;
  const activeReport = activeReportId ? reports.find(report => report.id === activeReportId) : reports[0];
  const allowedStatuses = activeReport ? nextReportStatuses(role, activeReport.status) : [];
  const canSave = !!activeReport && canUpdateReport(role, userBarangay, activeReport, newStatus, collectionConfirmed);

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

  const getTypeStyle = (type: string) => {
    if (type.includes("Dump")) return { bg: "bg-red-50", text: "text-red-500" };
    if (type.includes("Garbage")) return { bg: "bg-orange-50", text: "text-orange-500" };
    if (type.includes("Bin")) return { bg: "bg-purple-50", text: "text-purple-500" };
    return { bg: "bg-blue-50", text: "text-blue-500" };
  };

  const handleUpdateStatus = async () => {
    if (!user || !activeReport || !canSave) return;
    setIsUpdating(true);
    try {
      await updateReportStatus(activeReport.id, { uid: user.uid, role, barangay: userBarangay }, newStatus, remarks, collectionConfirmed);
      setShowConfirm(false);
      setNewStatus("");
      setRemarks("");
      setCollectionConfirmed(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-[1400px] mx-auto pb-8 relative">
        
        <DataState loading={loading} error={error} onRetry={retry} />
        {/* Header */}
        <div className="flex flex-col gap-2 mb-2">
          <h1 className="text-[26px] font-bold text-slate-900 leading-tight">
            {role === "Semi-Admin" ? "Community Reports" : "Report Management"}
          </h1>
          <p className="text-sm text-slate-500">
            {role === "Semi-Admin" 
              ? "Review reports in your barangay, verify the location, and forward confirmed reports to MENRO." 
              : "Receive verified reports from Barangay Captains, schedule collection, and resolve reports after collection."}
          </p>
          {role === "Semi-Admin" && <Link href="/reports-to-menro" className="inline-flex w-fit items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"><Send className="h-4 w-4" />Reports to MENRO</Link>}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard 
            title="Total Reports" 
            value={reports.length.toString()} 
            subtitle={role === "Semi-Admin" ? "All received reports" : "All submitted reports"} 
            icon={<FileText className="w-7 h-7" />} 
            iconBgColor="bg-[#E8F5E9]" 
            iconColor="text-[#2E7D32]" 
          />
          <KpiCard 
            title={role === "Semi-Admin" ? "Pending Review" : "Pending Validation"} 
            value={reports.filter(r => r.status.toLowerCase() === 'pending').length.toString()} 
            subtitle="Awaiting initial review" 
            icon={<Clock className="w-7 h-7" />} 
            iconBgColor="bg-amber-50" 
            iconColor="text-amber-500" 
          />
          {role === "Semi-Admin" ? (
            <KpiCard 
              title="For MENRO Review" 
              value={reports.filter(r => normalizeReportStatus(r.status) === "UnderReview").length.toString()}
              subtitle="Review and send from Reports to MENRO"
              icon={<AlertTriangle className="w-7 h-7" />} 
              iconBgColor="bg-red-50" 
              iconColor="text-red-500" 
            />
          ) : (
            <KpiCard 
              title="Under Review" 
              value={reports.filter(r => normalizeReportStatus(r.status) === "MENRO Under Review").length.toString()}
              subtitle="Currently being reviewed by MENRO"
              icon={<Search className="w-7 h-7" />} 
              iconBgColor="bg-purple-50" 
              iconColor="text-purple-500" 
            />
          )}
          <KpiCard 
            title={role === "Semi-Admin" ? "Resolved" : "Resolved Reports"} 
            value={reports.filter(r => r.status.toLowerCase() === 'resolved').length.toString()} 
            subtitle={role === "Semi-Admin" ? "Already addressed" : "Successfully resolved"} 
            icon={<CheckCircle2 className="w-7 h-7" />} 
            iconBgColor="bg-[#E8F5E9]" 
            iconColor="text-[#2E7D32]" 
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Main Table Area */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
            
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="py-4 px-4 text-[11px] font-bold text-slate-700 uppercase tracking-wider">Report ID</th>
                    <th className="py-4 px-4 text-[11px] font-bold text-slate-700 uppercase tracking-wider">Category</th>
                    <th className="py-4 px-4 text-[11px] font-bold text-slate-700 uppercase tracking-wider">Barangay</th>
                    <th className="py-4 px-4 text-[11px] font-bold text-slate-700 uppercase tracking-wider">Submitted By</th>
                    <th className="py-4 px-4 text-[11px] font-bold text-slate-700 uppercase tracking-wider">Date</th>
                    <th className="py-4 px-4 text-[11px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">No reports found</td>
                    </tr>
                  )}
                  {reports.map((report) => {
                    const typeStyle = getTypeStyle(report.type);
                    return (
                      <tr 
                        key={report.id} 
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${activeReport?.id === report.id ? 'bg-slate-50' : ''}`}
                        onClick={() => { setActiveReportId(report.id); setNewStatus(""); setRemarks(""); setCollectionConfirmed(false); }}
                      >
                        <td className="py-4 px-4 font-bold text-slate-800 text-xs">...{report.id.slice(-6)}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${typeStyle.bg} ${typeStyle.text}`}>
                              <AlertTriangle className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-semibold text-slate-700">{report.type}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-xs font-semibold text-slate-700">{report.location}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-xs font-semibold text-slate-700">{report.reporterName}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-xs font-semibold text-slate-900">{report.date}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap ${getStatusColor(report.status)}`}>
                            {report.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Showing {reports.length} reports</span>
            </div>
          </div>
          
          {/* Right Panel - Report Details */}
          {activeReport && (
            <div className="w-full lg:w-[400px] shrink-0 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-max overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900">Report Details</span>
                  <span className="text-xs font-bold text-slate-500 mt-1">ID: ...{activeReport.id.slice(-6)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold ${getStatusColor(activeReport.status)}`}>
                    {activeReport.status}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-6">
                
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

                {/* Evidence */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-3">Evidence Photo</h4>
                  {activeReport.imageUrl ? (
                    <div 
                      className="relative w-full h-48 rounded-lg overflow-hidden border border-slate-200 cursor-zoom-in group"
                      onClick={() => setFullPhotoUrl(activeReport.imageUrl)}
                    >
                      <Image 
                        src={activeReport.imageUrl} 
                        alt="Evidence" 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Search className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-slate-100 rounded-lg flex flex-col items-center justify-center border border-slate-200 border-dashed">
                      <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
                      <span className="text-xs text-slate-500 font-medium">No photo uploaded</span>
                    </div>
                  )}
                </div>

                {activeReport.remarks && <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-semibold mb-1">Last review remarks</p>
                  <p className="whitespace-pre-wrap">{activeReport.remarks}</p>
                </div>}
                {/* Update Status Form */}
                <div className="border-t border-slate-100 pt-5 mt-2">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-4">Update Status</h4>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700">Status <span className="text-red-500">*</span></label>
                      <Select value={newStatus} disabled={allowedStatuses.length === 0} onValueChange={(val) => { setActiveReportId(activeReport.id); setNewStatus(val || ""); setCollectionConfirmed(false); }}>
                        <SelectTrigger className="w-full h-10 bg-white border-slate-200 font-semibold">
                          <SelectValue placeholder="Select new status" />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedStatuses.map(status => (
                            <SelectItem key={status} value={status}>{REPORT_STATUS_LABELS[status]}</SelectItem>
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
                        rows={3}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E7D32] resize-none"
                        placeholder="Add internal remarks about this update..."
                      />
                    </div>

                    <Button 
                      onClick={() => setShowConfirm(true)}
                      disabled={!canSave || isUpdating}
                      className="w-full h-10 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm disabled:opacity-50"
                    >
                      Update Status
                    </Button>
                  </div>
                </div>

              </div>
            </div>
          )}
          
        </div>

      </div>

      {/* Confirm Status Update Modal Overlay */}
      {showConfirm && activeReport && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="p-5 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Confirm Status Update
              </h2>
              <button 
                onClick={() => setShowConfirm(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4 mb-6">
                <div className="flex items-center">
                  <span className="text-[11px] font-semibold text-slate-500 w-24">Report ID:</span>
                  <span className="text-sm font-bold text-slate-900">...{activeReport.id.slice(-6)}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-[11px] font-semibold text-slate-500 w-24">New Status:</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(newStatus)}`}>{newStatus}</span>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-8 text-center">
                Are you sure you want to update this report?
              </p>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setShowConfirm(false)}
                  disabled={isUpdating}
                  variant="outline" 
                  className="flex-1 h-10 border-slate-200 text-slate-600 font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateStatus}
                  disabled={isUpdating || !canSave}
                  className="flex-1 h-10 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold rounded-xl shadow-sm"
                >
                  {isUpdating ? "Saving..." : (
                    <>Confirm <Check className="w-4 h-4 ml-1.5" /></>
                  )}
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

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
