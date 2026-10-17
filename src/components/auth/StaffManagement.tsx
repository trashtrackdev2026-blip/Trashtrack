"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { staffRequest } from "@/lib/staff-client";
import { STAFF_BARANGAYS, staffRole, validStaffBarangay } from "@/lib/staff-access";
import { auth } from "@/lib/firebase";
import { StaffConfirmationRequired, withRecentStaffSignIn } from "@/lib/staff-action";
import { ConfirmStaffSession } from "./ConfirmStaffSession";
type RequestItem = { id: string; name: string; email: string; position: string; contact: string; barangay: string; status: string; emailVerified: boolean; accountUnavailable: boolean };
type RegisteredAccount = { id: string; name: string; email: string; position: string; contact: string; barangay: string; role: string; accessStatus: string; emailVerified: boolean; disabled: boolean; requestStatus: string | null };
type StaffItem = { id: string; name: string; email: string; role: string; barangay: string; accessStatus: string };
type LogItem = { id: string; action: string; actor: string; target: string; at: string; role?: string; barangay?: string };
type Management = { requests: RequestItem[]; staff: StaffItem[]; logs: LogItem[] };
type Review = { action: "approve"; account: RequestItem } | { action: "assign"; account: StaffItem };
type PendingAction = { actorId: string; body: Record<string, unknown>; recovery?: boolean };
export function StaffManagement() {
  const { user, role } = useAuth();
  const [data, setData] = useState<Management | null>(null);
  const [selected, setSelected] = useState<Review | null>(null);
  const [assignedRole, setAssignedRole] = useState<"Admin" | "Semi-Admin">("Semi-Admin");
  const [officialPosition, setOfficialPosition] = useState("");
  const [barangay, setBarangay] = useState(""); const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [lookupEmail, setLookupEmail] = useState("");
  const [registered, setRegistered] = useState<RegisteredAccount | null>(null);
  const [recoveryName, setRecoveryName] = useState(""); const [recoveryPosition, setRecoveryPosition] = useState("");
  const [recoveryContact, setRecoveryContact] = useState(""); const [recoveryBarangay, setRecoveryBarangay] = useState("");
  const loadVersion = useRef(0);
  const feedback = useRef<HTMLDivElement>(null); const reviewFeedback = useRef<HTMLDivElement>(null);
  const load = useCallback(async (quiet = false) => {
    const version = ++loadVersion.current;
    if (!quiet) setLoading(true);
    try {
      const result = await staffRequest<Management>("/api/staff/manage");
      if (version === loadVersion.current) { setData(result); setLoadError(""); }
    }
    catch (failure) { if (version === loadVersion.current) setLoadError(failure instanceof Error ? failure.message : "Could not load staff."); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, []);
  useEffect(() => { if (role === "Admin") void load(); }, [role, load]);
  useEffect(() => {
    if (role !== "Admin") return;
    const refresh = () => { if (!busy && !pendingAction && document.visibilityState === "visible") void load(true); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [role, busy, pendingAction, load]);
  useEffect(() => {
    if (error || message) (selected && error ? reviewFeedback : feedback).current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [error, message, selected]);
  async function findRegistration(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); setRegistered(null);
    try {
      const result = await staffRequest<{ account: RegisteredAccount }>("/api/staff/manage?email=" + encodeURIComponent(lookupEmail.trim()));
      setRegistered(result.account); setRecoveryName(result.account.name); setRecoveryPosition(result.account.position);
      setRecoveryContact(result.account.contact); setRecoveryBarangay(result.account.barangay);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not find the registered account."); }
    finally { setBusy(false); }
  }
  async function recoverRegistration(event: React.FormEvent) {
    event.preventDefault();
    if (!registered || !user) return;
    await perform({ actorId: user.uid, recovery: true, body: { action: "recover", userId: registered.id, name: recoveryName,
      position: recoveryPosition, contact: recoveryContact, barangay: recoveryBarangay } });
  }
  async function action(action: string, userId: string) {
    if (!user) return;
    await perform({ actorId: user.uid, body: { action, userId, ...(["approve", "assign"].includes(action) ? { role: assignedRole, barangay, identityConfirmed: confirmed } : {}), ...(action === "approve" ? { position: officialPosition } : {}) } });
  }
  async function perform(value: PendingAction) {
    setBusy(true); setError(""); setMessage("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== value.actorId) throw new Error("The signed-in account changed. Review the action again.");
      await withRecentStaffSignIn(currentUser, () => staffRequest("/api/staff/manage", value.body, value.actorId));
      if (value.recovery) { setRegistered(null); setLookupEmail(""); }
      const action = String(value.body.action);
      setMessage(value.recovery ? "The official is now in pending requests. Review the request below to approve their role and barangay." : ["approve", "assign", "reactivate"].includes(action) ? "Access saved. This official must sign in again to use the approved permissions." : action === "reject" ? "Request rejected." : "Staff access suspended.");
      setSelected(null); await load();
    } catch (failure) {
      if (failure instanceof StaffConfirmationRequired) setPendingAction(value);
      else setError(failure instanceof Error ? failure.message : "Could not update access.");
    }
    finally { setBusy(false); }
  }
  function review(value: Review) {
    setSelected(value); setBarangay(value.account.barangay); setConfirmed(false); setMessage("");
    setOfficialPosition(value.action === "approve" ? value.account.position || "" : "");
    setAssignedRole(value.action === "assign" && staffRole(value.account.role) === "admin" ? "Admin" : "Semi-Admin");
  }
  if (role !== "Admin") return null;
  return <section id="staff-access" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
    <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold">Staff access · MENRO approval</h2>
      <p className="mt-1 text-sm text-slate-500">Approve verified officials for MENRO Admin access or Semi-Admin access to one barangay.</p></div>
      <button disabled={busy || loading} onClick={() => void load()} className="text-sm font-semibold text-green-800">{loading ? "Loading…" : "Refresh"}</button></div>
    {loading && <p role="status" className="text-sm text-slate-500">Loading staff requests and access…</p>}
    <div ref={feedback} className="space-y-3">
      {loadError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
      {!selected && error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    </div>
    <div className="rounded-xl border bg-slate-50 p-4">
      <h3 className="font-semibold">Barangay account coverage</h3>
      <p className="mt-1 text-sm text-slate-600">Staff registration automatically adds an approval request. Once the official verifies their email, review their access below. Multiple accounts may serve the same barangay. This list refreshes every 30 seconds and when you return to the page.</p>
      <button type="button" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/signup`).then(() => setMessage("Staff registration link copied. Share it with the barangay officials."), () => setMessage(`Staff registration: ${window.location.origin}/signup`)); }} className="mt-3 text-sm font-semibold text-green-800 underline">Copy staff registration link</button>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{STAFF_BARANGAYS.map(name => {
        const count = data?.staff.filter(item => staffRole(item.role) === "semi-admin" && item.barangay === name && item.accessStatus === "active").length;
        return <p key={name} className="flex justify-between gap-2 rounded-lg border bg-white p-2 text-sm"><span>{name}</span><span className={count ? "text-green-800" : "text-amber-700"}>{count === undefined ? "Loading…" : count ? `${count} active` : "Needs account"}</span></p>;
      })}</div>
    </div>
    <div className="space-y-4 rounded-xl border bg-slate-50 p-4">
      <div><h3 className="font-semibold">Find a missing registration</h3><p className="mt-1 text-sm text-slate-600">For an official who already registered but has no pending request, find their email and complete the official details. Adding a request keeps MENRO approval as a separate step.</p></div>
      <form onSubmit={findRegistration} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-medium">Registered official email<input type="email" required disabled={busy} value={lookupEmail} onChange={e => { setLookupEmail(e.target.value); setRegistered(null); }} className="mt-2 w-full rounded-lg border bg-white p-3" /></label>
        <button disabled={busy} className="rounded-lg border border-green-800 bg-white px-4 py-3 text-sm font-semibold text-green-800 disabled:opacity-40">Find account</button>
      </form>
      {registered && <div className="space-y-3 rounded-lg border bg-white p-4">
        <p className="break-all text-sm"><strong>{registered.email}</strong> · {registered.emailVerified ? "Email verified" : "Email not verified"}</p>
        {registered.disabled || ["suspended", "disabled", "activating"].includes(registered.accessStatus) ? <p className="text-sm text-amber-800">Resolve this account&apos;s existing staff access before adding a request.</p> :
          registered.requestStatus === "pending" ? <p className="text-sm text-green-800">This account already has a pending request. Refresh and review it below.</p> :
          staffRole(registered.role) === "admin" || (staffRole(registered.role) && registered.accessStatus === "active") ? <p className="text-sm text-green-800">This account already has staff access. Use Change access in Staff accounts.</p> :
          !registered.emailVerified ? <p className="text-sm text-amber-800">The official must verify their email before MENRO can recover and approve this registration.</p> :
          <form onSubmit={recoverRegistration} className="space-y-3">
            <label className="block text-sm font-medium">Full name<input disabled={busy} required maxLength={120} value={recoveryName} onChange={e => setRecoveryName(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label className="block text-sm font-medium">Official position<input disabled={busy} required maxLength={120} value={recoveryPosition} onChange={e => setRecoveryPosition(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
            <label className="block text-sm font-medium">Barangay<select disabled={busy} required value={recoveryBarangay} onChange={e => setRecoveryBarangay(e.target.value)} className="mt-1 w-full rounded-lg border p-3"><option value="">Select barangay</option>{STAFF_BARANGAYS.map(value => <option key={value}>{value}</option>)}</select></label>
            <label className="block text-sm font-medium">Contact number<input disabled={busy} required type="tel" maxLength={40} value={recoveryContact} onChange={e => setRecoveryContact(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
            <button disabled={busy} className="rounded-lg bg-green-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : "Add to pending requests"}</button>
          </form>}
      </div>}
    </div>
    <div className="space-y-3"><h3 className="font-semibold">Pending requests</h3>
      {data?.requests.filter(item => item.status === "pending").length === 0 && <p className="text-sm text-slate-500">No pending staff requests.</p>}
      {data?.requests.filter(item => item.status === "pending").map(item => <div key={item.id} className="flex flex-wrap justify-between gap-4 rounded-xl border p-4">
        <div><p className="font-semibold">{item.name} · {item.barangay}</p><p className="text-sm text-slate-600">{item.position || "Official position needed at review"} · {item.email} · {item.contact}</p><p className={"mt-1 text-xs " + (item.emailVerified && !item.accountUnavailable ? "text-green-800" : "text-amber-800")}>{item.accountUnavailable ? "Account unavailable · check account status" : item.emailVerified ? "Email verified · ready for MENRO review" : "Awaiting email verification"}</p></div>
        <button disabled={busy || !item.emailVerified || item.accountUnavailable} onClick={() => review({ action: "approve", account: item })} className="text-sm font-semibold text-green-800 disabled:opacity-40">Review request</button>
      </div>)}
    </div>
    {selected && <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-5">
      <h3 className="font-semibold">{selected.action === "approve" ? "Review" : "Change access for"} {selected.account.name}</h3>
      <p className="break-all text-sm text-slate-600">{selected.account.email}</p>
      {selected.action === "approve" && <label className="block text-sm font-medium">Official position<input disabled={busy} required maxLength={120} value={officialPosition} onChange={e => { setOfficialPosition(e.target.value); setConfirmed(false); }} className="mt-2 w-full rounded-lg border bg-white p-3" placeholder="Confirm the official's position" /></label>}
      <label className="block text-sm font-medium">Access role<select disabled={busy} className="mt-2 w-full rounded-lg border bg-white p-3" value={assignedRole} onChange={e => { setAssignedRole(e.target.value as "Admin" | "Semi-Admin"); setConfirmed(false); }}>
        <option value="Semi-Admin">Semi-Admin · assigned barangay</option><option value="Admin">Admin · MENRO</option>
      </select></label>
      {assignedRole === "Semi-Admin" ? <label className="block text-sm font-medium">Approved barangay<select disabled={busy} className="mt-2 w-full rounded-lg border bg-white p-3" value={barangay} onChange={e => { setBarangay(e.target.value); setConfirmed(false); }}><option value="">Select barangay</option>{STAFF_BARANGAYS.map(value => <option key={value}>{value}</option>)}</select></label> :
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Admin access includes all barangays, staff approvals and the full MENRO dashboard. Assign this only to an authorized MENRO administrator.</p>}
      <label className="flex items-start gap-3 text-sm"><input disabled={busy} type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />I verified this person&apos;s identity and official authority and authorize the selected access.</label>
      <div ref={reviewFeedback}>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div>
      <div className="flex flex-wrap gap-3"><button disabled={busy || !confirmed || (selected.action === "approve" && !officialPosition.trim()) || (assignedRole === "Semi-Admin" && !validStaffBarangay(barangay))} onClick={() => void action(selected.action, selected.account.id)} className="rounded-lg bg-green-800 px-4 py-2 text-sm text-white disabled:opacity-40">{busy ? "Saving…" : selected.action === "approve" ? "Approve " + assignedRole + " access" : "Save access"}</button>
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
    <p className="text-xs text-slate-500">Staff access changes may ask you to confirm your current MENRO password here. You stay signed in and keep your review details.</p>
    {pendingAction && user?.uid === pendingAction.actorId && <ConfirmStaffSession user={user} onCancel={() => setPendingAction(null)} onConfirmed={async () => {
      const saved = pendingAction; setPendingAction(null); await perform(saved);
    }} />}
  </section>;
}

