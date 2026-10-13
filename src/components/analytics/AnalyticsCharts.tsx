"use client";
import { BookOpen, Search } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
type Props = {
  trendData: { name: string; value: number }[];
  categoryData: { name: string; value: number; color: string }[];
  eventData: { name: string; value: number }[];
  stats: { totalReports: number; totalEvents: number; eventParticipants: number };
};
export default function AnalyticsCharts({ trendData, categoryData, eventData, stats }: Props) {
  return <>
        {/* Third Row: Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Line Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-[#2E7D32]" /> Waste Concern Trends
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Monthly Waste Reports</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#2E7D32" strokeWidth={2} dot={{ r: 4, fill: '#2E7D32', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Monthly Waste Reports" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-[#2E7D32]"></div>
              <span className="text-[10px] font-semibold text-slate-600">Monthly Waste Reports</span>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
             <h3 className="font-bold text-slate-900 mb-4">Waste Concern Categories</h3>
             <div className="flex h-[200px] items-center">
               <div className="w-1/2 h-full relative flex items-center justify-center">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-slate-900 leading-none">{stats.totalReports}</span>
                    <span className="text-[8px] text-slate-500 font-semibold uppercase">Total Reports</span>
                 </div>
               </div>
               <div className="w-1/2 flex flex-col justify-center gap-3 pl-2">
                 {categoryData.map((item, i) => (
                   <div key={i} className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                       <span className="text-[10px] font-semibold text-slate-700">{item.name}</span>
                     </div>
                     <span className="text-[10px] font-bold text-slate-500">{item.value}%</span>
                   </div>
                 ))}
               </div>
             </div>
          </div>

          {/* Event Analytics */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
             <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-[#2E7D32]" /> Community Event Analytics
             </h3>
             
             <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-semibold text-slate-500 leading-tight mb-1">Total Events</span>
                  <span className="text-xl font-bold text-slate-900">{stats.totalEvents}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-semibold text-slate-500 leading-tight mb-1">Participants</span>
                  <span className="text-xl font-bold text-slate-900">{stats.eventParticipants}</span>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] font-semibold text-slate-500 leading-tight mb-1">Certificates Issued</span>
                  <span className="text-xl font-bold text-slate-900">{stats.eventParticipants}</span>
                </div>
             </div>

             <div className="space-y-3">
               <span className="text-[11px] font-bold text-slate-600 mb-2 block">Events by Type</span>
               {eventData.map((event, i) => (
                 <div key={i} className="flex items-center justify-between">
                   <span className="text-[10px] font-medium text-slate-600 w-24">{event.name}</span>
                   <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden mx-2">
                     <div className="h-full bg-[#2E7D32] rounded-full" style={{ width: `${(event.value / 6) * 100}%` }}></div>
                   </div>
                   <span className="text-[10px] font-bold text-slate-900 w-4 text-right">{event.value}</span>
                 </div>
               ))}
             </div>
          </div>
          
        </div>


  </>;
}
