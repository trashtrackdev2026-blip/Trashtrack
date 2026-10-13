"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signInError } from "@/lib/sign-in-errors";
import { staffRole } from "@/lib/staff-access";
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence, getMultiFactorResolver, TotpMultiFactorGenerator, type MultiFactorError, type MultiFactorResolver, type User } from "firebase/auth";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [error, setError] = useState("");
  const [errorReference, setErrorReference] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function complete(user: User) {
    setPassword(""); setCode("");
    const response = await fetch("/api/staff/account", { headers: { Authorization: "Bearer " + await user.getIdToken() }, cache: "no-store", signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Your account could not be verified.");
    router.replace(data.problem ? "/staff-account" : staffRole(data.profile.role) === "admin" ? "/" : "/reports");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setErrorReference(""); setLoading(true);
    try {
      if (resolver) {
        const factor = resolver.hints.find(hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (!factor) throw new Error("Contact MENRO to recover your authenticator.");
        const result = await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factor.uid, code));
        await complete(result.user);
      } else {
        await setPersistence(auth, browserSessionPersistence);
        await complete((await signInWithEmailAndPassword(auth, email.trim(), password)).user);
      }
    } catch (failure) {
      const code = failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      if (code === "auth/multi-factor-auth-required") {
        setResolver(getMultiFactorResolver(auth, failure as MultiFactorError)); setPassword("");
      } else {
        const detail = signInError(failure);
        setError(detail.message); setErrorReference(detail.reference);
      }
    } finally { setLoading(false); }
  }
  return <form onSubmit={submit} className="space-y-4 w-full">
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p>{error}</p>{errorReference && <p className="mt-2 break-all text-xs">Error reference: {errorReference}</p>}</div>}
    {resolver ? <div className="space-y-2">
      <label htmlFor="totp" className="text-sm font-medium">Authenticator code</label>
      <Input id="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} required />
      <p className="text-xs text-slate-500">Enter the six-digit code from your authenticator app.</p>
    </div> : <>
      <div className="space-y-2"><label htmlFor="email" className="text-sm font-medium">Email address</label>
        <Input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required className="h-11 rounded-xl" />
      </div>
      <div className="space-y-2"><label htmlFor="password" className="text-sm font-medium">Password</label>
        <div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => setCapsLock(event.getModifierState("CapsLock"))} onKeyUp={event => setCapsLock(event.getModifierState("CapsLock"))} required className="h-11 rounded-xl pr-12" />
          <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute right-1 top-1 flex h-9 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-green-800">{showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>
        </div>
        {capsLock && <p role="status" className="text-xs text-amber-700">Caps Lock is on.</p>}
      </div>
      <Link href="/forgot-password" className="text-sm text-green-800 hover:underline">Forgot your password?</Link>
    </>}
    <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl bg-green-800 hover:bg-green-900">{loading ? "Checking account…" : resolver ? "Verify and sign in" : "Sign in"}</Button>
    {resolver ? <button type="button" onClick={() => { setResolver(null); setCode(""); setError(""); setErrorReference(""); }} className="text-sm text-green-800">Use another account</button> :
      <p className="text-sm text-slate-600">Barangay official? <Link href="/signup" className="font-semibold text-green-800 hover:underline">Request staff access</Link></p>}
  </form>;
}

