"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ShieldCheck, UsersRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { staffRequest } from "@/lib/staff-client";

type Request = { id: string; name: string; barangay: string; status: string; emailVerified: boolean };

export function StaffRequestsSummary({ onReview }: { onReview: () => void }) {
  const { user, role } = useAuth();
  const [state, setState] = useState<{ owner: string; requests: Request[]; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const owner = role === "Admin" ? user?.uid : null;

  useEffect(() => {
    if (!owner) return;
    let disposed = false;
    const refresh = async () => {
      try {
        const data = await staffRequest<{ requests: Request[] }>("/api/staff/manage");
        if (!disposed) setState({ owner, requests: data.requests.filter(item => item.status.toLowerCase() === "pending"), error: "" });
      } catch {
        if (!disposed) setState({ owner, requests: [], error: "Staff requests could not be loaded." });
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { disposed = true; window.removeEventListener("focus", refresh); };
  }, [owner, attempt]);

  if (!owner) return null;
  const current = state?.owner === owner ? state : null;
  return <aside className="tt-surface tt-dark-panel tt-panel-padding tt-people-staff" aria-label="Staff access requests">
    <div className="flex items-start gap-3"><UsersRound className="mt-1 h-7 w-7 shrink-0" aria-hidden="true" /><div><h2>Staff access requests</h2><p className="mt-2 text-sm text-muted-foreground" role="status">{current ? current.error ? "Unable to check requests" : `${current.requests.length} awaiting review` : "Checking requests…"}</p></div></div>
    {current?.error && <div className="mt-5 text-sm"><p>{current.error}</p><button type="button" className="tt-text-link mt-3" onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
    {current?.requests.slice(0, 3).map(request => <div key={request.id} className="tt-staff-request">
      <strong>{request.name}</strong><p>{request.barangay || "Barangay not assigned"}</p>
      <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{request.emailVerified ? "Email verified" : "Email verification pending"}</p>
      <button type="button" className="tt-text-link" onClick={onReview}>Review request <ArrowUpRight aria-hidden="true" /></button>
    </div>)}
    {current && !current.error && !current.requests.length && <p className="py-7 text-sm text-muted-foreground">No staff requests are awaiting review.</p>}
    <div className="tt-access-links"><button type="button" className="tt-text-link" onClick={onReview}>Manage staff access <ArrowUpRight aria-hidden="true" /></button><p className="text-xs leading-relaxed text-muted-foreground">Approval, account recovery, and access audit tools.</p></div>
  </aside>;
}
