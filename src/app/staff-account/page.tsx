"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { multiFactor, TotpMultiFactorGenerator, sendEmailVerification, type TotpSecret } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { staffRequest } from "@/lib/staff-client";
import { STAFF_BARANGAYS, staffRole } from "@/lib/staff-access";
type Account = { profile: Record<string, unknown>; problem: string | null; totpEnabled: boolean };
type AccessRequest = { status: string; approvedBarangay?: string; approvedRole?: string };
export default function StaffAccountPage() {
  const { user, signOut, retry } = useAuth();
  const [loadedAccount, setAccount] = useState<(Account & { userId: string }) | null>(null);
  const account = loadedAccount?.userId === user?.uid ? loadedAccount : null;
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [name, setName] = useState(""); const [barangay, setBarangay] = useState("");
  const [position, setPosition] = useState(""); const [contact, setContact] = useState("");
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [qr, setQr] = useState(""); const [code, setCode] = useState("");
  const refresh = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setAccountLoading(true);
    try {
      await currentUser.reload();
      await currentUser.getIdToken(true);
      const [details, state] = await Promise.all([
        staffRequest<Account>("/api/staff/account?setup=1"),
        staffRequest<{ request: AccessRequest | null }>("/api/staff/requests"),
      ]);
      setAccount({ ...details, userId: currentUser.uid }); setRequest(state.request);
      setName(String(details.profile.name || "")); setBarangay(String(details.profile.barangay || ""));
      setContact(String(details.profile.contact || ""));
      retry();
    } finally { setAccountLoading(false); }
  }, [retry]);
  // Auth retry is intentionally omitted: refreshing the provider must not refetch this page in a loop.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const [details, state] = await Promise.all([
          staffRequest<Account>("/api/staff/account?setup=1"),
          staffRequest<{ request: AccessRequest | null }>("/api/staff/requests"),
        ]);
        if (cancelled) return;
        setAccount({ ...details, userId: user.uid }); setRequest(state.request);
        setName(String(details.profile.name || "")); setBarangay(String(details.profile.barangay || ""));
        setContact(String(details.profile.contact || ""));
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : "Unable to load your account."); }
      finally { if (!cancelled) setAccountLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Try again."); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => { await staffRequest("/api/staff/requests", { name, barangay, position, contact }); setMessage("Request submitted. MENRO will verify your official details."); await refresh(); });
  }
  const assignedRole = staffRole(account?.profile.role);
  const approved = account?.profile.accessStatus === "active" && assignedRole !== null;
  const field = "mt-2 w-full rounded-xl border border-slate-300 px-4 py-3";
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl space-y-6">
    <div className="flex justify-between items-center"><Link href="/login" className="font-bold text-green-800">TrashTrack · Admin</Link>{user && <button onClick={() => void signOut()} className="text-sm text-slate-600">Sign out</button>}</div>
    <section className="space-y-5 rounded-2xl border bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">Staff account</h1>
      {!user ? <p><Link href="/login" className="text-green-800 underline">Sign in</Link> to view your account.</p> : <>
        <p className="text-sm text-slate-600">{user.email}</p>
        {(accountLoading || (!account && !error)) && <p role="status" className="text-sm text-slate-500">Loading account access…</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        {account?.problem && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{account.problem}</p>}
        {!user.emailVerified && <div className="space-y-3"><p className="text-sm">Open the verification link sent to your email before submitting a request.</p>
          <button disabled={busy} onClick={() => void run(async () => { await sendEmailVerification(user); setMessage("Verification link sent. Check your inbox and spam folder."); })} className="rounded-xl bg-green-800 px-4 py-3 text-sm text-white disabled:opacity-50">Send verification email</button>
        </div>}
        <button disabled={busy} onClick={() => void run(refresh)} className="text-sm font-semibold text-green-800 underline">Refresh account status</button>
        {account && request && <p className="text-sm"><strong>Request status:</strong> {request.status}{request.approvedRole ? " · " + request.approvedRole : ""}{request.approvedBarangay ? " · " + request.approvedBarangay : ""}</p>}
        {approved && <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-green-950">{assignedRole === "admin" ? "MENRO Admin" : "Barangay Semi-Admin"}</h2>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-800">{account?.problem ? "Sign-in needs attention" : "Active access"}</span></div>
          <p className="text-sm text-green-900">{assignedRole === "admin" ? "You can review staff requests, approve Admin or Semi-Admin access, and manage all barangays." : "You can review community reports for " + String(account?.profile.barangay || "your assigned barangay") + "."}</p>
          {!account?.problem && <div className="flex flex-wrap gap-3">
            {assignedRole === "admin" && <Link href="/users#staff-access" className="rounded-xl bg-green-800 px-5 py-3 text-sm font-semibold text-white">MENRO staff approvals</Link>}
            <Link href={assignedRole === "admin" ? "/" : "/reports"} className="rounded-xl border border-green-800 bg-white px-5 py-3 text-sm font-semibold text-green-800">Open dashboard</Link>
          </div>}
        </div>}
        {account && !accountLoading && user.emailVerified && !approved && request?.status !== "pending" && <form onSubmit={submit} className="space-y-4 border-t pt-5">
          <h2 className="text-lg font-semibold">Request barangay access</h2>
          <label className="block text-sm font-medium">Full name<input className={field} value={name} onChange={e => setName(e.target.value)} required maxLength={120} /></label>
          <label className="block text-sm font-medium">Official position<input className={field} value={position} onChange={e => setPosition(e.target.value)} required maxLength={120} placeholder="Barangay official / designated staff" /></label>
          <label className="block text-sm font-medium">Barangay<select className={field} value={barangay} onChange={e => setBarangay(e.target.value)} required><option value="">Select barangay</option>{STAFF_BARANGAYS.map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="block text-sm font-medium">Contact number<input className={field} type="tel" value={contact} onChange={e => setContact(e.target.value)} required maxLength={40} /></label>
          <button disabled={busy} className="rounded-xl bg-green-800 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit for MENRO approval"}</button>
        </form>}
        {approved && account?.totpEnabled === true && <div className="space-y-4 border-t pt-5">
          <h2 className="text-lg font-semibold">Authenticator protection</h2>
          {account?.profile.mfaRequired === true ? <p className="text-sm text-green-800">Authenticator sign-in is required for this account.</p> : null}
            <p className="text-sm text-slate-600">Set up an authenticator from HTTPS or localhost on the admin PC. If you have signed in for more than five minutes, sign in again first.</p>
            {!secret && <button disabled={busy || !!multiFactor(user).enrolledFactors.length} onClick={() => void run(async () => {
              if (!window.isSecureContext) throw new Error("Open http://localhost:3000/staff-account on the admin PC, or use your HTTPS address, to enroll securely.");
              const generated = await TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession());
              setSecret(generated); setQr(generated.generateQrCodeUrl(user.email || "Staff", "TrashTrack MENRO"));
            })} className="rounded-xl border border-green-800 px-4 py-3 text-sm font-semibold text-green-800">Set up authenticator</button>}
            {secret && <div className="space-y-4 rounded-xl bg-slate-50 p-5">
              <p className="text-sm">Scan this QR code in your authenticator. Keep it private.</p><QRCodeSVG value={qr} size={192} marginSize={2} />
              <label className="block text-sm font-medium">Six-digit code<input className={field} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} /></label>
              <button disabled={busy || code.length !== 6} onClick={() => void run(async () => {
                await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code), "TrashTrack authenticator");
                await staffRequest("/api/staff/account", {});
                setSecret(null); setQr(""); setCode(""); await signOut(); window.location.assign("/login");
              })} className="rounded-xl bg-green-800 px-4 py-3 text-sm text-white disabled:opacity-50">Verify and enable protection</button>
            </div>}
            {!secret && multiFactor(user).enrolledFactors.length > 0 && account.profile.mfaRequired !== true &&
              <button disabled={busy} onClick={() => void run(async () => { await staffRequest("/api/staff/account", {}); await signOut(); window.location.assign("/login"); })} className="text-sm font-semibold text-green-800 underline">Require my enrolled authenticator</button>}
        </div>}
      </>}
    </section>
  </div></main>;
}

