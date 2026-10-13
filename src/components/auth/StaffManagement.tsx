"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { staffRequest } from "@/lib/staff-client";
import { STAFF_BARANGAYS, staffRole, validStaffBarangay } from "@/lib/staff-access";
type RequestItem = { id: string; name: string; email: string; position: string; contact: string; barangay: string; status: string };
type StaffItem = { id: string; name: string; email: string; role: string; barangay: string; accessStatus: string };
type LogItem = { id: string; action: string; actor: string; target: string; at: string; role?: string; barangay?: string };
type Management = { requests: RequestItem[]; staff: StaffItem[]; logs: LogItem[] };
type Review = { action: "approve"; account: RequestItem } | { action: "assign"; account: StaffItem };
export function StaffManagement() {
  const { user, role } = useAuth();
  const [data, setData] = useState<Management | null>(null);
  const [selected, setSelected] = useState<Review | null>(null);
  const [assignedRole, setAssignedRole] = useState<"Admin" | "Semi-Admin">("Semi-Admin");
  const [barangay, setBarangay] = useState(""); const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await staffRequest("/api/staff/manage")); setError(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load staff."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (role === "Admin") void load(); }, [role, load]);
  async function action(action: string, userId: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      await staffRequest("/api/staff/manage", { action, userId, ...(["approve", "assign"].includes(action) ? { role: assignedRole, barangay, identityConfirmed: confirmed } : {}) });
      setMessage(["approve", "assign", "reactivate"].includes(action) ? "Access saved. This official must sign in again to use the approved permissions." : action === "reject" ? "Request rejected." : "Staff access suspended.");
      setSelected(null); await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not update access."); }
    finally { setBusy(false); }
  }
  function review(value: Review) {
    setSelected(value); setBarangay(value.account.barangay); setConfirmed(false); setMessage("");
    setAssignedRole(value.action === "assign" && staffRole(value.account.role) === "admin" ? "Admin" : "Semi-Admin");
  }
  if (role !== "Admin") return null;
  return <section id="staff-access" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold">Staff access · MENRO approval</h2>
      <p className="mt-1 text-sm text-slate-500">Approve verified officials for MENRO Admin access or Semi-Admin access to one barangay.</p></div>
      <button disabled={busy || loading} onClick={() => void load()} className="text-sm font-semibold text-green-800">{loading ? "Loading…" : "Refresh"}</button></div>
    {loading && <p role="status" className="text-sm text-slate-500">Loading staff requests and access…</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    <div className="space-y-3"><h3 className="font-semibold">Pending requests</h3>
      {data?.requests.filter(item => item.status === "pending").length === 0 && <p className="text-sm text-slate-500">No pending staff requests.</p>}
      {data?.requests.filter(item => item.status === "pending").map(item => <div key={item.id} className="flex flex-wrap justify-between gap-4 rounded-xl border p-4">
        <div><p className="font-semibold">{item.name} · {item.barangay}</p><p className="text-sm text-slate-600">{item.position} · {item.email} · {item.contact}</p></div>
        <button disabled={busy} onClick={() => review({ action: "approve", account: item })} className="text-sm font-semibold text-green-800">Review request</button>
      </div>)}
    </div>
    {selected && <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-5">
      <h3 className="font-semibold">{selected.action === "approve" ? "Review" : "Change access for"} {selected.account.name}</h3>
      <p className="break-all text-sm text-slate-600">{selected.account.email}</p>
      <label className="block text-sm font-medium">Access role<select disabled={busy} className="mt-2 w-full rounded-lg border bg-white p-3" value={assignedRole} onChange={e => { setAssignedRole(e.target.value as "Admin" | "Semi-Admin"); setConfirmed(false); }}>
        <option value="Semi-Admin">Semi-Admin · assigned barangay</option><option value="Admin">Admin · MENRO</option>
      </select></label>
      {assignedRole === "Semi-Admin" ? <label className="block text-sm font-medium">Approved barangay<select disabled={busy} className="mt-2 w-full rounded-lg border bg-white p-3" value={barangay} onChange={e => { setBarangay(e.target.value); setConfirmed(false); }}><option value="">Select barangay</option>{STAFF_BARANGAYS.map(value => <option key={value}>{value}</option>)}</select></label> :
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Admin access includes all barangays, staff approvals and the full MENRO dashboard. Assign this only to an authorized MENRO administrator.</p>}
      <label className="flex items-start gap-3 text-sm"><input disabled={busy} type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />I verified this person&apos;s identity and official authority and authorize the selected access.</label>
      <div className="flex flex-wrap gap-3"><button disabled={busy || !confirmed || (assignedRole === "Semi-Admin" && !validStaffBarangay(barangay))} onClick={() => void action(selected.action, selected.account.id)} className="rounded-lg bg-green-800 px-4 py-2 text-sm text-white disabled:opacity-40">{busy ? "Saving…" : selected.action === "approve" ? "Approve " + assignedRole + " access" : "Save access"}</button>
        {selected.action === "approve" && <button disabled={busy} onClick={() => void action("reject", selected.account.id)} className="rounded-lg border px-4 py-2 text-sm">Reject</button>}<button disabled={busy} onClick={() => setSelected(null)} className="text-sm">Cancel</button></div>
    </div>}
    <div className="overflow-x-auto"><h3 className="mb-3 font-semibold">Staff accounts</h3><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2">Official</th><th>Access</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {data?.staff.map(item => <tr key={item.id} className="border-b"><td className="py-3 pr-3"><p className="font-semibold">{item.name}</p><p className="text-xs text-slate-500">{item.email}</p></td><td className="pr-3">{staffRole(item.role) === "admin" ? "Admin · MENRO" : "Semi-Admin · " + item.barangay}</td><td className="pr-3">{item.accessStatus}</td>
        <td>{item.id === user?.uid ? <span className="text-slate-400">Your account</span> : item.accessStatus === "needs-review" ? <span className="text-xs text-amber-700">Official must verify email and submit a request</span> :
          <div className="flex flex-wrap gap-3">{item.accessStatus === "active" && <button disabled={busy} onClick={() => review({ action: "assign", account: item })} className="font-medium text-green-800">Change access</button>}
          <button disabled={busy} onClick={() => void action(item.accessStatus === "active" ? "suspend" : "reactivate", item.id)} className="font-medium text-green-800">{item.accessStatus === "active" ? "Suspend access" : "Reactivate"}</button></div>}</td></tr>)}
    </tbody></table></div>
    <details className="text-sm"><summary className="cursor-pointer font-semibold">Recent access and report audit</summary>
      <ul className="mt-3 space-y-2">{data?.logs.map(item => <li key={item.id} className="rounded-lg bg-slate-50 p-3 break-all"><strong>{item.action}</strong> · {item.at}{item.role && <p className="text-xs text-green-800">{item.role}{item.barangay ? " · " + item.barangay : " · MENRO access"}</p>}<p className="text-xs text-slate-500">Actor: {item.actor} · Target: {item.target}</p></li>)}</ul>
    </details>
    <p className="text-xs text-slate-500">Changing staff access requires a sign-in within the last five minutes. Sign out and sign in again if prompted.</p>
  </section>;
}

