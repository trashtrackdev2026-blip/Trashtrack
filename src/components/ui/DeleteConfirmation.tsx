"use client";

import { Trash2, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./dialog";

export function DeleteConfirmation({ open, title, description, busy, error, onCancel, onConfirm }: {
  open: boolean; title: string; description: string; busy: boolean; error: string;
  onCancel: () => void; onConfirm: () => void;
}) {
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onCancel(); }}>
    <DialogContent className="tt-themed-dialog sm:max-w-md" showCloseButton={!busy}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-800"><Trash2 aria-hidden="true" /></span>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription className="break-words leading-relaxed">{description}</DialogDescription></DialogHeader>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <DialogFooter className="mt-2 gap-3"><Button variant="outline" disabled={busy} onClick={onCancel}>Keep it</Button><Button className="bg-red-800 text-white hover:bg-red-900" disabled={busy} onClick={onConfirm}>{busy && <Loader2 className="animate-spin" />}{busy ? "Removing…" : "Delete"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
