"use client";
import { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";

export function NavigationPending() {
  const { pending } = useLinkStatus();
  return pending ? <>
    <LoaderCircle className="ml-auto size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
    <span className="sr-only" role="status">Opening page…</span>
  </> : null;
}
