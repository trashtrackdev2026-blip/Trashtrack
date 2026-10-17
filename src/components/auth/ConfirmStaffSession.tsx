"use client";
import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, getMultiFactorResolver, TotpMultiFactorGenerator, type MultiFactorError, type MultiFactorResolver, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { signInError } from "@/lib/sign-in-errors";
import { withTimeout } from "@/lib/request-timeout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ConfirmStaffSession({ user, onCancel, onConfirmed }: { user: User; onCancel: () => void; onConfirmed: () => Promise<void> }) {
  const [password, setPassword] = useState(""); const [code, setCode] = useState("");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (!user.email || auth.currentUser?.uid !== user.uid) throw new Error("The signed-in account changed. Close this confirmation and review the action again.");
      if (resolver) {
        const factor = resolver.hints.find(item => item.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (!factor) throw new Error("Contact MENRO to recover your authenticator.");
        await withTimeout(resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factor.uid, code)), "Authenticator verification timed out. Try again.", 30000);
        setCode("");
      } else {
        const credential = EmailAuthProvider.credential(user.email, password);
        setPassword("");
        await withTimeout(reauthenticateWithCredential(user, credential), "Password confirmation timed out. Try again.", 30000);
      }
      if (auth.currentUser?.uid !== user.uid) throw new Error("The signed-in account changed. Review the action again.");
      await withTimeout(user.getIdToken(true), "Refreshing your sign-in timed out. Try again.");
      await onConfirmed();
    } catch (failure) {
      if (failure && typeof failure === "object" && "code" in failure && failure.code === "auth/multi-factor-auth-required") {
        const next = getMultiFactorResolver(auth, failure as MultiFactorError);
        if (next.hints.some(item => item.factorId === TotpMultiFactorGenerator.FACTOR_ID)) setResolver(next);
        else setError("Contact MENRO to recover your authenticator.");
      } else setError(signInError(failure).message);
    } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onCancel(); }}>
    <DialogContent showCloseButton={!busy}>
      <DialogHeader><DialogTitle>Confirm your MENRO sign-in</DialogTitle>
        <DialogDescription>Enter your current password to continue. You stay signed in and keep the details you are reviewing.</DialogDescription></DialogHeader>
      <p className="break-all text-sm text-slate-600">{user.email}</p>
      <form onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {resolver ? <label className="block text-sm font-medium">Authenticator code<input autoFocus disabled={busy} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} className="mt-2 w-full rounded-lg border p-3" /></label> :
          <label className="block text-sm font-medium">Current MENRO password<input autoFocus disabled={busy} required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label>}
        <div className="flex flex-wrap gap-3"><button disabled={busy} className="rounded-lg bg-green-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Confirming…" : "Confirm and continue"}</button>
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border px-4 py-3 text-sm">Cancel</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
