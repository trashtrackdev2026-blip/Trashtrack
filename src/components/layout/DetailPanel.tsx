"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const desktopQuery = "(min-width: 1280px)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const desktopSnapshot = () => window.matchMedia(desktopQuery).matches;
const serverSnapshot = () => false;

export function useWideWorkspace() {
  return useSyncExternalStore(subscribe, desktopSnapshot, serverSnapshot);
}

/** One detail view: beside the list on desktop, in an accessible dialog on small screens. */
export function DetailPanel({ wide, open, onOpenChange, label, children, empty, dark = false, busy = false }: {
  wide: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  children: ReactNode;
  empty?: ReactNode;
  dark?: boolean;
  busy?: boolean;
}) {
  if (wide) return <aside aria-label={label} className={cn("tt-surface tt-detail-panel", dark && "tt-dark-panel")}>
    {open ? children : empty}
  </aside>;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    {open && <DialogContent className="gap-0 p-0 sm:max-w-3xl" showCloseButton={!busy}>{children}</DialogContent>}
  </Dialog>;
}
