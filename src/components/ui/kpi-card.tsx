import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string; value: string | number; subtitle: string; icon: ReactNode;
  iconBgColor?: string; iconColor?: string; className?: string;
  onClick?: () => void; selected?: boolean; controls?: string;
}

export function KpiCard({ title, value, subtitle, className, onClick, selected, controls }: KpiCardProps) {
  const content = <><strong className="tt-metric-value">{value}</strong><span className="tt-metric-label">{title}</span><small className="tt-metric-context">{subtitle}</small></>;
  return onClick ? <button type="button" onClick={onClick} aria-pressed={!!selected} aria-controls={controls} className={cn("tt-metric tt-metric-button", className)}>{content}</button>
    : <div className={cn("tt-metric", className)}>{content}</div>;
}
