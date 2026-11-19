"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { AnalyticsPoint, summarizeAnalytics } from "@/lib/analytics-data";

type Stats = ReturnType<typeof summarizeAnalytics>["stats"];
type ReportCounts = Pick<Stats, "totalReports" | "resolvedReports" | "pendingReports" | "rejectedReports">;
type Props = { categoryData: (AnalyticsPoint & { color: string })[]; eventData: AnalyticsPoint[]; stats: Pick<Stats, "totalEvents" | "eventParticipants"> };

export function ReportTrendChart({ trendData, counts }: { trendData: AnalyticsPoint[]; counts: ReportCounts }) {
  const { totalReports, resolvedReports, pendingReports, rejectedReports } = counts;
  const parts = [
    { name: "Resolved", value: resolvedReports, color: "#72ad82" },
    { name: "Pending", value: pendingReports, color: "#c5a15d" },
    { name: "Rejected", value: rejectedReports, color: "#e4a198" },
  ];
  return <section className="tt-surface tt-dark-panel min-w-0 p-5" aria-label="Report trends and resolution">
    <h2>Reports over time</h2><p className="mt-1 text-xs text-muted-foreground">Submitted reports by month</p>
    <div className="mt-5 h-64 w-full" role="img" aria-label={`Monthly report trend. ${trendData.map(point => `${point.name}: ${point.value}`).join(", ") || "No report data yet."}`}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={trendData} margin={{ top: 12, right: 12, left: -18, bottom: 5 }}><CartesianGrid vertical={false} stroke="#b6cda12b" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#c2d5b9" }} minTickGap={18} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#c2d5b9" }} /><Tooltip cursor={{ fill: "#c8ddaf15" }} contentStyle={{ background: "#edf4e2", border: "1px solid #b7cca3", borderRadius: 10, color: "#234c33", fontSize: 12 }} /><Bar isAnimationActive={false} dataKey="value" name="Reports" radius={[4,4,0,0]} maxBarSize={46}>{trendData.map((point,index) => <Cell key={point.name} fill={index === trendData.length-1 ? "#e9ba54" : "#b8d3a5"} />)}</Bar></BarChart></ResponsiveContainer>
    </div>
    <div className="mt-6 border-t pt-4">
      <h3 className="text-sm font-semibold">Resolution breakdown</h3>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {parts.map(part => <div key={part.name}>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: part.color }} />{part.name}</span>
          <strong className="mt-1 block font-outfit text-xl font-medium">{part.value}</strong>
        </div>)}
      </div>
      <div aria-hidden="true" className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#e8eddf]">
        {parts.map(part => <div key={part.name} style={{ width: `${totalReports ? part.value / totalReports * 100 : 0}%`, backgroundColor: part.color }} />)}
      </div>
    </div>
  </section>;
}

export default function AnalyticsCharts({ categoryData, eventData, stats }: Props) {
  const largestEventCount = Math.max(1, ...eventData.map(event => event.value));
  return <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
    <section className="tt-surface min-w-0 p-5"><h2>Report categories</h2><div className="mt-4 flex flex-wrap items-center gap-5"><div className="h-52 min-w-40 flex-1" role="img" aria-label={categoryData.map(item => `${item.name}: ${item.value}%`).join(", ") || "No report categories yet."}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie isAnimationActive={false} data={categoryData} innerRadius={55} outerRadius={78} paddingAngle={3} dataKey="value" nameKey="name" stroke="none">{categoryData.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={{ background: "#fffef7", borderRadius: 10, fontSize: 12 }} /></PieChart></ResponsiveContainer></div><div className="min-w-40 flex-1 space-y-4">{categoryData.map(item => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span><strong className="font-medium tabular-nums">{item.value}%</strong></div>)}</div></div></section>
    <section className="tt-surface min-w-0 p-5"><h2>Community participation</h2><div className="my-6 flex gap-8 border-b pb-5"><div><strong className="block font-outfit text-3xl font-medium">{stats.totalEvents}</strong><span className="text-xs text-muted-foreground">Community events</span></div><div><strong className="block font-outfit text-3xl font-medium">{stats.eventParticipants}</strong><span className="text-xs text-muted-foreground">Registrations</span></div></div><h3 className="mb-4 text-sm font-medium">Events by type</h3><div className="space-y-4">{eventData.map(event => <div key={event.name} className="flex items-center gap-4 text-xs"><span className="w-28 shrink-0 text-muted-foreground">{event.name}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e8eddf]"><div className="h-full rounded-full bg-[#74976a]" style={{ width: `${event.value / largestEventCount * 100}%` }} /></div><span className="w-7 text-right tabular-nums">{event.value}</span></div>)}{!eventData.length && <p className="text-sm text-muted-foreground">Event activity will appear here.</p>}</div></section>
  </div>;
}
