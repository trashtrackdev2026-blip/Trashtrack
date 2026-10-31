"use client";
import type { CommunityReport } from "@/hooks/use-reports";

export function ReportEvidence({ report }: { report: CommunityReport }) {
  const attachments = report.attachments.length ? report.attachments
    : report.imageUrl ? [{ url: report.imageUrl, type: "image" as const }] : [];
  if (!attachments.length) return <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">No evidence attached.</p>;
  return <div className="tt-report-evidence grid gap-3 sm:grid-cols-2">{attachments.map((item, index) => <div key={`${item.url}:${index}`} className="min-w-0 overflow-hidden rounded-xl border bg-slate-50">
    {item.type === "video" ? <video src={item.url} controls preload="metadata" playsInline className="h-48 w-full bg-black object-contain" />
      : <a href={item.url} target="_blank" rel="noopener noreferrer"><img src={item.url} alt={`Evidence photo ${index + 1}`} className="h-48 w-full object-contain" /></a>}
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block p-2 text-xs font-semibold text-green-800 underline">Open {item.type === "video" ? "video" : "photo"} {index + 1}</a>
  </div>)}</div>;
}
