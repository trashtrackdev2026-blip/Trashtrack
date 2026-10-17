"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, setPersistence, browserSessionPersistence, sendEmailVerification, validatePassword, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { STAFF_BARANGAYS, requestFields } from "@/lib/staff-access";
import { staffRequest } from "@/lib/staff-client";
export default function SignupPage() {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [barangay, setBarangay] = useState("");
  const [contact, setContact] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [position, setPosition] = useState("");
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [requestSaved, setRequestSaved] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const details = requestFields({ name, position, contact, barangay });
      let user = createdUser;
      if (!user) {
        if (password.length < 12) throw new Error("Use a password of at least 12 characters.");
        if (!(await validatePassword(auth, password)).isValid) throw new Error("Choose a stronger password that meets the Firebase password policy.");
        await setPersistence(auth, browserSessionPersistence);
        user = (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
        setCreatedUser(user); setPassword("");
      }
      if (auth.currentUser?.uid !== user.uid) throw new Error("Sign in to your new account to finish the staff request.");
      if (!requestSaved) {
        await staffRequest("/api/staff/requests", details);
        setRequestSaved(true);
      }
      await sendEmailVerification(user);
      router.replace("/staff-account");
    } catch (failure) {
      const code = failure && typeof failure === "object" && "code" in failure ? String(failure.code) : "";
      setError(code.startsWith("auth/") ? "Registration could not be completed. Try signing in or resetting your password, or check your internet connection." : failure instanceof Error ? failure.message : "Try again.");
    } finally { setBusy(false); }
  }
  const inputClass = "mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-green-800";
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><form onSubmit={submit} className="mx-auto max-w-lg space-y-5 rounded-2xl border bg-white p-8 shadow-sm">
    <Link href="/login" className="font-semibold text-green-800">TrashTrack · Admin</Link>
    <h1 className="text-2xl font-bold">Barangay staff registration</h1>
    <p className="text-sm text-slate-600">Registration saves your official details in MENRO&apos;s pending requests. Verify your email next so MENRO can approve your barangay access.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {createdUser && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{requestSaved ? "Your account and approval request are saved. Send the verification email to continue." : "Your login account is created. Complete registration below to save the approval request."} <Link href="/staff-account" className="font-semibold underline">Open staff account</Link></p>}
    <fieldset disabled={busy || requestSaved} className="space-y-5 disabled:opacity-70">
    <label className="block text-sm font-medium">Full name<input className={inputClass} value={name} onChange={e => setName(e.target.value)} required maxLength={120} autoComplete="name" /></label>
    <label className="block text-sm font-medium">Official position<input className={inputClass} value={position} onChange={e => setPosition(e.target.value)} required maxLength={120} placeholder="Barangay official / designated staff" autoComplete="organization-title" /></label>
    <label className="block text-sm font-medium">Official email<input disabled={!!createdUser} className={inputClass} type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" /></label>
    {!createdUser && <label className="block text-sm font-medium">Password<input className={inputClass} type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={12} maxLength={128} autoComplete="new-password" /><span className="mt-1 block text-xs text-slate-500">Use at least 12 characters. A unique passphrase works well.</span></label>}
    <label className="block text-sm font-medium">Barangay<select className={inputClass} value={barangay} onChange={e => setBarangay(e.target.value)} required><option value="">Select your barangay</option>{STAFF_BARANGAYS.map(value => <option key={value}>{value}</option>)}</select></label>
    <label className="block text-sm font-medium">Contact number<input className={inputClass} type="tel" value={contact} onChange={e => setContact(e.target.value)} required maxLength={40} autoComplete="tel" /></label>
    </fieldset>
    <button disabled={busy} className="w-full rounded-xl bg-green-800 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving registration…" : requestSaved ? "Send verification email and continue" : createdUser ? "Finish staff registration" : "Register and request MENRO approval"}</button>
    <p className="text-sm text-slate-600">Already registered? <Link href="/login" className="font-semibold text-green-800">Sign in</Link></p>
  </form></main>;
}

