import Image from "next/image";

export function Brand({ compact = false, subtitle = "Balete MENRO", light = false }: { compact?: boolean; subtitle?: string; light?: boolean }) {
  return <div className={`tt-brand${compact ? " tt-brand-compact" : ""}${light ? " tt-brand-light" : ""}`}>
    <span className="tt-brand-mark" aria-hidden="true"><Image src="/images/trashtrack-brand.png" alt="" width={64} height={64} sizes="64px" loading="eager" /></span>
    {!compact && <span className="tt-brand-copy"><strong>TrashTrack</strong><small>{subtitle}</small></span>}
    {compact && <span className="sr-only">TrashTrack · {subtitle}</span>}
  </div>;
}
