"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventRequest } from "@/lib/event-client";
import { readApiResponse } from "@/lib/api-response";

export function AttendanceQr({ eventId, method }: { eventId: string; method?: string }) {
  const [qr, setQr] = useState<{ payload: string; open: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (method === "manual") return;
    let active = true;
    eventRequest("/api/events/attendance-qr", { eventId, action: "get" })
      .then(response => readApiResponse<{ payload: string; open: boolean }>(response)).then(data => { if (active) setQr(data); })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : "QR could not be loaded."); });
    return () => { active = false; };
  }, [eventId, method, attempt]);

  const download = async () => {
    setBusy(true); setError("");
    try {
      const response = await eventRequest("/api/events/attendance-qr", { eventId, action: "download" });
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "TrashTrack-Attendance-QR-" + eventId + ".pdf";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "QR download failed."); }
    finally { setBusy(false); }
  };
  const changeOpen = async () => {
    if (!qr) return;
    setBusy(true); setError("");
    try {
      const response = await eventRequest("/api/events/attendance-qr", { eventId, action: "setOpen", open: !qr.open });
      setQr(await readApiResponse<{ payload: string; open: boolean }>(response));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Attendance status could not be saved."); }
    finally { setBusy(false); }
  };
  if (method === "manual") return <p className="text-xs text-slate-600">This event uses manual attendance. Confirm participants below.</p>;
  return <div className="space-y-3">
    <h5 className="font-bold text-sm text-slate-800">Event Attendance QR</h5>
    <p className="text-xs text-slate-600">Registered residents scan this code in TrashTrack to confirm attendance. Print the downloaded A4 PDF for the event.</p>
    {qr ? <div className="flex justify-center rounded-lg border bg-white p-3">
      <QRCodeSVG value={qr.payload} size={160} level="M" marginSize={4} title="Event attendance QR" />
    </div> : !error && <p className="text-xs text-slate-500">Preparing attendance QR…</p>}
    <Button onClick={download} disabled={busy || !qr} variant="outline" className="w-full text-green-800">
      <Download className="mr-2 h-4 w-4" />{busy ? "Please wait…" : "Download QR PDF"}
    </Button>
    {qr && <div className="rounded-lg bg-green-50 p-3 text-xs">
      <p className="font-semibold">{qr.open ? "QR attendance is open" : "QR attendance is closed"}</p>
      <p className="mt-1 text-slate-600">Close check-in when attendance is finished. Opening it also allows late confirmation for a completed event.</p>
      <Button onClick={changeOpen} disabled={busy} variant="outline" size="sm" className="mt-2">
        {qr.open ? "Close QR attendance" : "Open QR attendance"}
      </Button>
    </div>}
    {error && <div role="alert" className="text-xs text-red-700">
      <p>{error}</p>
      {!qr && <Button variant="outline" size="sm" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry</Button>}
    </div>}
  </div>;
}
