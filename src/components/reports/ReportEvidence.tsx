"use client";
import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { CommunityReport } from "@/hooks/use-reports";

export function ReportEvidence({ report }: { report: CommunityReport }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(report.photoReview?.status !== "review");
  const attachments = report.attachments.length ? report.attachments
    : report.imageUrl ? [{ url: report.imageUrl, type: "image" as const }] : [];
  if (!attachments.length) return <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">No evidence attached.</p>;
  const visibleIndex = Math.min(index, attachments.length - 1);
  const item = attachments[visibleIndex];
  const label = `${item.type === "video" ? "video" : "photo"} ${visibleIndex + 1}`;
  const navigationClass = "grid size-9 place-items-center rounded-full border border-[#c8dac5] bg-white text-[#174c39] hover:bg-green-50 disabled:opacity-35";
  return <div className="overflow-hidden rounded-lg border border-[#c8dac5] bg-[#f8faf3]">
    {report.photoReview?.status === "review" && <div className="border-b border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">{["Rejected", "Resolved"].includes(report.status) ? "Evidence flagged during submission" : "Evidence needs review"}</p><p>Unclear or unchecked media may contain inappropriate content. Review the description and location along with the attachments.</p></div>}
    {!revealed ? <div className="p-4"><button type="button" onClick={() => setRevealed(true)} className="min-h-11 rounded-lg bg-[#174c39] px-4 text-sm font-semibold text-white">Review {attachments.length} attachment{attachments.length === 1 ? "" : "s"}</button></div> : <>
    {item.type === "video" ? <video key={item.url} src={item.url} controls preload="metadata" playsInline className="tt-evidence-media bg-black" />
      : <a href={item.url} target="_blank" rel="noopener noreferrer" className="block"><Image src={item.url} alt={`Evidence ${label}`} width={1000} height={700} unoptimized className="tt-evidence-media" /></a>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#c8dac5] px-2 py-1.5">
      <div className="flex items-center gap-2">
        {attachments.length > 1 && <button type="button" className={navigationClass} aria-label="Previous attachment" disabled={visibleIndex === 0} onClick={() => setIndex(visibleIndex - 1)}><ChevronLeft size={17} /></button>}
        <span aria-live="polite" className="text-xs font-medium">{visibleIndex + 1} of {attachments.length}</span>
        {attachments.length > 1 && <button type="button" className={navigationClass} aria-label="Next attachment" disabled={visibleIndex === attachments.length - 1} onClick={() => setIndex(visibleIndex + 1)}><ChevronRight size={17} /></button>}
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 px-2 text-xs font-semibold text-green-800 underline">Open {label}<ExternalLink size={13} aria-hidden="true" /></a>
    </div>
    </>}
  </div>;
}
