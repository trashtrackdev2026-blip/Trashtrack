"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LoaderCircle, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { staffRequest } from "@/lib/staff-client";
import type { AnalyticsPoint, ReportInsightEvidence } from "@/lib/analytics-data";

const ReportInsightCharts = dynamic(() => import("./ReportInsightCharts"), {
  ssr: false,
  loading: () => <p className="py-6 text-sm text-muted-foreground" role="status">Loading charts…</p>,
});
type Interpretation = { text: string; evidence: ReportInsightEvidence };

function highest(points: AnalyticsPoint[]) {
  const max = Math.max(0, ...points.map(point => point.value));
  return { names: max ? points.filter(point => point.value === max).map(point => point.name) : [], max };
}

export function ReportInsights({ period, periodLabel, totalReports, categories, months }: ReportInsightEvidence & {
  period: string; periodLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Interpretation | null>(null);
  const [error, setError] = useState("");
  const top = highest(categories);
  const peak = highest(months);

  async function interpret() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const interpretation = await staffRequest<Interpretation>("/api/analytics/insights", { period });
      setResult(interpretation);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "AI interpretation could not be loaded.");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={next => {
      setOpen(next);
      if (next && !result && !error) void interpret();
    }}>
      <section className="tt-surface overflow-hidden" aria-labelledby="report-insights-title">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e6eddf] text-[#1b513d]"><TrendingUp className="size-5" aria-hidden="true" /></span>
            <div><h2 id="report-insights-title">Waste report insights</h2><p className="mt-1 text-sm text-muted-foreground">{periodLabel} · {totalReports} {totalReports === 1 ? "submission" : "submissions"}</p></div>
          </div>
          <DialogTrigger disabled={totalReports === 0} render={<Button variant="outline" />}>
            <Sparkles aria-hidden="true" />{result ? "View AI interpretation" : "Generate AI interpretation"}
          </DialogTrigger>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {totalReports === 0 ? <p className="text-sm text-muted-foreground">No reports for this period.</p> : <dl className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 rounded-xl border bg-[#eef3e8] p-4 text-sm"><dt className="text-muted-foreground">Most reported {top.names.length === 1 ? "category" : "categories"}</dt><dd className="font-semibold">{top.names.join(", ")} · {top.max} {top.max === 1 ? "report" : "reports"}{top.names.length > 1 ? " each" : ""}</dd></div>
            <div className="space-y-1 rounded-xl border bg-[#eef3e8] p-4 text-sm"><dt className="text-muted-foreground">Highest count in the monthly chart</dt><dd className="font-semibold">{peak.names.length ? <>{peak.names.join(", ")} · {peak.max} {peak.max === 1 ? "report" : "reports"}{peak.names.length > 1 ? " each" : ""}</> : "No dated submissions in the chart range."}</dd></div>
          </dl>}
        </div>
      </section>
      <DialogContent className="tt-themed-dialog gap-0 p-0 sm:max-w-[940px]">
        <div>
          <DialogHeader className="border-b bg-[#edf3e8] p-5 pr-12 sm:px-7 sm:pr-14">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1b513d] text-[#fffef7]"><Sparkles className="size-5" aria-hidden="true" /></span>
              <div><DialogTitle>AI interpretation</DialogTitle><DialogDescription>{periodLabel}</DialogDescription></div>
            </div>
          </DialogHeader>
          <div className="space-y-4 p-4 sm:p-6">
            <section aria-label="AI answer" className="space-y-3 rounded-2xl border bg-[#fffef8] p-4 sm:p-5">
              {busy && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />{result ? "Refreshing interpretation…" : "Reading report trends…"}
              </p>}
              {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
              {result && <p role="status" className="whitespace-pre-wrap break-words text-sm leading-relaxed">{result.text || "No report submissions are available to interpret for this period."}</p>}
              {!busy && (result || error) && <Button type="button" variant="outline" size="sm" onClick={() => void interpret()}>
                <RefreshCw aria-hidden="true" />{error ? "Try again" : "Regenerate interpretation"}
              </Button>}
            </section>
            <ReportInsightCharts evidence={result?.evidence ?? { totalReports, categories, months }} recentMonthsOnly={!period} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
