"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { eventRequest } from "@/lib/event-client";

export function CertificatePreview({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false, objectUrl = "";
    eventRequest("/api/certificates/preview", data).then(response => response.blob()).then(blob => {
      if (!disposed) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(error => { if (!disposed) setError(error.message || "Preview could not be loaded."); });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [data]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-5xl">
      <DialogHeader><DialogTitle>Certificate preview</DialogTitle></DialogHeader>
      <p className="text-sm text-slate-600">The participant name changes for each confirmed attendee.</p>
      {error ? <p role="alert" className="text-red-700">{error}</p> : url ?
        <iframe title="Certificate of Appreciation preview" src={url} className="h-[65vh] w-full rounded-lg border" /> :
        <p className="py-12 text-center">Preparing preview…</p>}
      {url && <a href={url} download="TrashTrack-certificate-preview.pdf" className="font-semibold text-green-800">Download preview PDF</a>}
    </DialogContent>
  </Dialog>;
}
