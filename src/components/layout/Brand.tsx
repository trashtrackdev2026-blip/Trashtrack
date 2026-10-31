import { Leaf } from "lucide-react";

export function Brand({ compact = false, subtitle = "Balete MENRO" }: { compact?: boolean; subtitle?: string }) {
  return <div className={`tt-brand${compact ? " tt-brand-compact" : ""}`}>
    <span className="tt-brand-mark" aria-hidden="true"><Leaf strokeWidth={1.5} /></span>
    {!compact && <span className="tt-brand-copy"><strong>TrashTrack</strong><small>{subtitle}</small></span>}
    {compact && <span className="sr-only">TrashTrack · {subtitle}</span>}
  </div>;
}
