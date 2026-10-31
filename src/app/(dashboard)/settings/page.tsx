"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Shield, Key, LogOut, Loader2, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { multiFactor, EmailAuthProvider, reauthenticateWithCredential, updatePassword, getMultiFactorResolver, TotpMultiFactorGenerator, type MultiFactorError } from "firebase/auth";

export default function Settings() {
  const { user, role, name, barangay, signOut } = useAuth();

  // Profile State
  const [profileName, setProfileName] = useState(name || "");
  const [profileContact, setProfileContact] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [profileLoading,setProfileLoading]=useState(true);
  const [profileAttempt,setProfileAttempt]=useState(0);
  const [profileLoadedUid,setProfileLoadedUid]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{ if(!user)return;let cancelled=false;void getDoc(doc(db,"users",user.uid)).then(snapshot=>{if(cancelled)return;const profile=snapshot.data();setProfileName(typeof profile?.name==="string"?profile.name:name||"");setProfileContact(typeof profile?.contact==="string"?profile.contact:typeof profile?.phone==="string"?profile.phone:"");setProfileLoadedUid(user.uid);setError("");}).catch(()=>{if(!cancelled){setProfileLoadedUid(null);setError("Your profile could not be loaded. Please retry before saving.");}}).finally(()=>{if(!cancelled)setProfileLoading(false);});return()=>{cancelled=true;};},[user,name,profileAttempt]);
  const hasAuthenticator=user?multiFactor(user).enrolledFactors.length>0:false;
  // Password State
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user || profileLoadedUid !== user.uid || !profileName.trim() || profileLoading) return;
    setIsUpdatingProfile(true);setError("");setMessage("");
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: profileName.trim(),
        contact: profileContact.trim()
      });
      setMessage("Profile saved.");
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Your profile could not be saved. Please try again.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !user.email) return;
    if (passwords.new !== passwords.confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (passwords.new.length < 12) { setError("Use a password of at least 12 characters."); return; }
    setIsUpdatingPassword(true);setMessage("");setError("");
    try {
      const credential = EmailAuthProvider.credential(user.email, passwords.current);
      try { await reauthenticateWithCredential(user, credential); }
      catch (failure) {
        if (!failure || typeof failure !== "object" || !("code" in failure) || failure.code !== "auth/multi-factor-auth-required") throw failure;
        const resolver = getMultiFactorResolver(auth, failure as MultiFactorError);
        const hint = resolver.hints.find(item => item.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        const code = window.prompt("Enter the current six-digit authenticator code.");
        if (!hint || !code || !/^[0-9]{6}$/.test(code)) throw new Error("Enter a valid authenticator code.");
        await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code));
      }
      await updatePassword(user, passwords.new);
      setMessage("Password updated successfully.");
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (error: unknown) {
      console.error("Error updating password:", error);
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError("Incorrect current password.");
      } else {
        setError("Failed to update password. " + (error instanceof Error ? error.message : "Try again."));
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return <div className="space-y-5">
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={()=>{setProfileLoading(true);setProfileAttempt(value=>value+1);}} className="font-semibold underline">Reload profile</button></div>}
    <nav className="tt-tabs" aria-label="Account settings"><a href="#profile-information" aria-current="page">Profile</a><Link href="/staff-account">Account security</Link><a href="#change-password">Password</a></nav>
    <div className="tt-settings-grid">
      <div className="tt-settings-main"><Card className="tt-settings-profile" id="profile-information"><CardHeader><CardTitle>Profile information</CardTitle><CardDescription>Keep your account details up to date.</CardDescription></CardHeader><CardContent className="space-y-7">
        <div className="flex items-center gap-4"><span className="tt-avatar h-16 w-16 text-xl" aria-hidden="true">{(profileName||"Admin").split(/\s+/).filter(Boolean).slice(0,2).map(value=>value[0]).join("").toUpperCase()}</span><div><strong className="font-outfit text-lg font-medium">{name||"Admin"}</strong><p className="mt-1 text-xs text-muted-foreground">{role==="Semi-Admin"?"Barangay staff":"MENRO Admin"}</p></div></div>
        {profileLoading && <p role="status" className="text-sm text-muted-foreground">Loading your profile…</p>}
        <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="fullName">Full name</Label><Input id="fullName" value={profileName} maxLength={120} disabled={profileLoading} onChange={event=>setProfileName(event.target.value)} autoComplete="name" /></div><div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" value={user?.email||""} disabled /></div><div className="space-y-2"><Label htmlFor="contact">Contact number</Label><Input id="contact" type="tel" value={profileContact} disabled={profileLoading} onChange={event=>setProfileContact(event.target.value)} placeholder="Your contact number" autoComplete="tel" /></div><div className="space-y-2"><Label htmlFor="barangay">Barangay</Label><Input id="barangay" value={barangay||"All barangays"} disabled /></div></div>
        <p className="text-xs leading-relaxed text-muted-foreground">Your email and assigned barangay are managed through your account access.</p><Button disabled={isUpdatingProfile||profileLoading||profileLoadedUid!==user?.uid||!profileName.trim()} onClick={()=>void handleUpdateProfile()}>{isUpdatingProfile&&<Loader2 className="animate-spin" aria-hidden="true" />}{isUpdatingProfile?"Saving…":"Save changes"}</Button>
      </CardContent></Card>
      <Card id="change-password"><CardHeader><CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" aria-hidden="true" />Change password</CardTitle><CardDescription>Use at least 12 characters to keep your account secure.</CardDescription></CardHeader><CardContent><form onSubmit={event=>{event.preventDefault();void handleUpdatePassword();}} className="space-y-5"><div className="tt-password-grid"><div className="space-y-2"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" required value={passwords.current} onChange={event=>setPasswords({...passwords,current:event.target.value})} /></div><div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={passwords.new} onChange={event=>setPasswords({...passwords,new:event.target.value})} /></div><div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={passwords.confirm} onChange={event=>setPasswords({...passwords,confirm:event.target.value})} /></div></div><Button type="submit" disabled={isUpdatingPassword}>{isUpdatingPassword&&<Loader2 className="animate-spin" aria-hidden="true" />}{isUpdatingPassword?"Updating…":"Update password"}</Button></form></CardContent></Card></div>
      <Card className="tt-dark-panel"><CardHeader><CardTitle className="flex items-center gap-3"><Shield className="h-7 w-7" aria-hidden="true" />Account protection</CardTitle><CardDescription>Protect your sign-in with an authenticator.</CardDescription></CardHeader><CardContent className="space-y-7"><div><div className="mb-5 flex items-center justify-between gap-3"><span className="text-sm">Authenticator</span><span className={"tt-status"+(hasAuthenticator?"":" tt-status-pending")}>{hasAuthenticator?"Configured":"Not configured"}</span></div><Link href="/staff-account" className="tt-text-link">{hasAuthenticator?"Manage authenticator":"Set up authenticator"}<ArrowUpRight aria-hidden="true" /></Link></div><div className="space-y-4 border-t pt-6"><h2>Session</h2><p className="text-sm text-muted-foreground">Sign out of TrashTrack on this device.</p><Button variant="outline" onClick={()=>void signOut()}><LogOut aria-hidden="true" />Sign out</Button></div></CardContent></Card>
    </div>
  </div>;
}
