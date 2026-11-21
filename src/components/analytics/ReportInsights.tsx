"use client";

import { useState } from "react";
import { Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staffRequest } from "@/lib/staff-client";
import type { AnalyticsPoint } from "@/lib/analytics-data";

function highest(points: AnalyticsPoint[]) {
  const max = Math.max(0, ...points.map(point => point.value));
  return { names: max ? points.filter(point => point.value === max).map(point => point.name) : [], max };
}

export function ReportInsights({ period, periodLabel, totalReports, categories, months }: {
  period: string; periodLabel: string; totalReports: number; categories: AnalyticsPoint[]; months: AnalyticsPoint[];
}) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const top = highest(categories);
  const peak = highest(months);

  async function interpret() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await staffRequest<{ text: string }>("/api/analytics/insights", { period });
      setText(result.text || "No report submissions are available to interpret for this period.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "AI interpretation could not be loaded.");
    } finally { setBusy(false); }
  }

  return <section className="tt-surface overflow-hidden" aria-labelledby="report-insights-title">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e6eddf] text-[#1b513d]"><TrendingUp className="size-5" aria-hidden="true" /></span>
        <div><h2 id="report-insights-title">Waste report insights</h2><p className="mt-1 text-sm text-muted-foreground">{periodLabel} · {totalReports} {totalReports === 1 ? "submission" : "submissions"}</p></div>
      </div>
      <Button variant="outline" disabled={busy || totalReports === 0} onClick={() => void interpret()}><Sparkles aria-hidden="true" />{busy ? "Reading report trends…" : text ? "Refresh AI interpretation" : "Generate AI interpretation"}</Button>
    </div>
    <div className="space-y-4 p-5 sm:p-6">
      {totalReports === 0 ? <p className="text-sm text-muted-foreground">No reports for this period.</p> : <dl className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 rounded-xl border bg-[#eef3e8] p-4 text-sm"><dt className="text-muted-foreground">Most reported {top.names.length === 1 ? "category" : "categories"}</dt><dd className="font-semibold">{top.names.join(", ")} · {top.max} {top.max === 1 ? "report" : "reports"}{top.names.length > 1 ? " each" : ""}</dd></div>
        <div className="space-y-1 rounded-xl border bg-[#eef3e8] p-4 text-sm"><dt className="text-muted-foreground">Highest count in the monthly chart</dt><dd className="font-semibold">{peak.names.length ? <>{peak.names.join(", ")} · {peak.max} {peak.max === 1 ? "report" : "reports"}{peak.names.length > 1 ? " each" : ""}</> : "No dated submissions in the chart range."}</dd></div>
      </dl>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      {text && <div className="rounded-xl border bg-[#fffef8] p-4" role="status"><h3 className="text-sm font-semibold">AI interpretation</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p></div>}
      <p className="text-xs text-muted-foreground">AI uses aggregate report counts for the selected period.</p>
    </div>
  </section>;
}
