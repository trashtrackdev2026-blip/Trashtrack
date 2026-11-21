"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReportInsightEvidence } from "@/lib/analytics-data";

const tooltipStyle = { background: "#fffef8", border: "1px solid #d6e2ce", borderRadius: 12, color: "#183b30", fontSize: 13 };
const count = new Intl.NumberFormat("en-PH");
const countLabel = (value: number) => `${count.format(value)} ${value === 1 ? "report" : "reports"}`;

function ReportCategoryChart({ evidence }: { evidence: ReportInsightEvidence }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [previewed, setPreviewed] = useState<string | null>(null);
  const { categories, totalReports } = evidence;
  const slices = categories.filter(point => point.value > 0);
  const active = categories.find(point => point.name === (previewed ?? selected));
  const select = (name: string) => setSelected(current => current === name ? null : name);

  return <section className="min-w-0 rounded-2xl border bg-[#edf3e8] p-4" aria-label="Report category breakdown">
    <h3 className="font-outfit text-lg font-semibold">Report categories</h3>
    {slices.length ? <>
      <div className="relative mx-auto h-[190px] w-full max-w-sm">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false}>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="88%" paddingAngle={2}
              stroke="none" isAnimationActive={false}
              onMouseEnter={(_, index) => setPreviewed(slices[index]?.name ?? null)}
              onMouseLeave={() => setPreviewed(null)}
              onClick={(_, index) => { if (slices[index]) select(slices[index].name); }}>
              {slices.map(slice => <Cell key={slice.name} fill={slice.color}
                fillOpacity={active && active.name !== slice.name ? 0.28 : 1} className="cursor-pointer motion-safe:transition-opacity" />)}
            </Pie>
            <Tooltip isAnimationActive={false} cursor={false} contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center" aria-hidden="true">
          <strong className="font-outfit text-3xl font-semibold leading-none tabular-nums">{count.format(active?.value ?? totalReports)}</strong>
          <span className="mt-1 max-w-24 text-xs leading-tight text-muted-foreground">{active?.name ?? "Total reports"}</span>
        </div>
      </div>
      <ul className="mt-1 grid gap-1">
        {categories.map(point => <li key={point.name}>
          <button type="button" aria-label={`${point.name}, ${countLabel(point.value)}`} aria-pressed={selected === point.name}
            onFocus={() => setPreviewed(point.name)} onBlur={() => setPreviewed(null)} onClick={() => select(point.name)}
            className={"flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring" + (active?.name === point.name ? " bg-white/80 font-semibold" : "")}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: point.color }} aria-hidden="true" />
            <span className="flex-1">{point.name}</span>
            <strong className="tabular-nums">{count.format(point.value)}</strong>
          </button>
        </li>)}
      </ul>
    </> : <p className="py-8 text-sm text-muted-foreground">No category data for this period.</p>}
  </section>;
}

function MonthlyInsightChart({ months, recentMonthsOnly }: { months: ReportInsightEvidence["months"]; recentMonthsOnly: boolean }) {
  return <section className="flex min-w-0 flex-col rounded-2xl border bg-[#fffef8] p-4" aria-label="Report submissions by month">
    <h3 className="font-outfit text-lg font-semibold">Monthly submissions</h3>
    {recentMonthsOnly && <p className="mt-1 text-xs text-muted-foreground">Last six months</p>}
    {months.some(month => month.value > 0) ? <>
      <div className="mt-3 h-[246px] min-w-0 sm:flex-1 sm:basis-64" aria-label="Monthly chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer data={months} margin={{ top: 8, right: 6, left: 0, bottom: 3 }} aria-label="Monthly report counts">
            <CartesianGrid vertical={false} stroke="#dae4d5" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#526d60" }} tickMargin={6} tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis width={34} tick={{ fontSize: 11, fill: "#526d60" }} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip isAnimationActive={false} contentStyle={tooltipStyle} cursor={{ fill: "#e7efdf" }} />
            <Bar dataKey="value" name="Reports" fill="#4f8167" radius={[6, 6, 0, 0]} maxBarSize={38} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Hover over a bar or use the arrow keys on the chart to see that month’s count.</p>
    </> : <p className="py-8 text-sm text-muted-foreground">No dated submissions in the chart range.</p>}
  </section>;
}

export default function ReportInsightCharts({ evidence, recentMonthsOnly }: { evidence: ReportInsightEvidence; recentMonthsOnly: boolean }) {
  return <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <ReportCategoryChart evidence={evidence} />
    <MonthlyInsightChart months={evidence.months} recentMonthsOnly={recentMonthsOnly} />
  </div>;
}
