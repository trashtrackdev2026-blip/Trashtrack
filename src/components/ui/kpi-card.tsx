import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  controls?: string;
}

export function KpiCard({ title, value, subtitle, icon, iconBgColor = "bg-green-50", iconColor = "text-green-600", className, onClick, selected, controls }: KpiCardProps) {
  const card = (
    <Card className={cn("border-none shadow-sm rounded-2xl overflow-hidden", onClick && "h-full", className)}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("w-14 h-14 rounded-full flex items-center justify-center shrink-0", iconBgColor, iconColor)}>
          {icon}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
          <span className="text-2xl font-bold text-slate-900 leading-tight mt-1">{value}</span>
          <span className="text-[11px] text-slate-400 mt-1">{subtitle}</span>
        </div>
      </CardContent>
    </Card>
  );
  return onClick ? <button type="button" onClick={onClick} aria-pressed={!!selected} aria-controls={controls}
    className={cn("h-full w-full cursor-pointer rounded-2xl text-left transition-shadow hover:ring-2 hover:ring-green-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2", selected && "ring-2 ring-green-700 ring-offset-2")}>
    {card}
  </button> : card;
}
