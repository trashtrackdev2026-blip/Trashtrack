"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Bell, Shield, Key, Camera, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, getMultiFactorResolver, TotpMultiFactorGenerator, type MultiFactorError } from "firebase/auth";

export default function Settings() {
  const { user, role, name, barangay, signOut } = useAuth();
  
  // Profile State
  const [profileName, setProfileName] = useState(name || "");
  const [profileContact, setProfileContact] = useState("+63 912 345 6789");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password State
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: profileName,
        contact: profileContact
      });
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !user.email) return;
    if (passwords.new !== passwords.confirm) {
      alert("New passwords do not match.");
      return;
    }
    if (passwords.new.length < 12) { alert("Use a password of at least 12 characters."); return; }
    setIsUpdatingPassword(true);
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
      alert("Password updated successfully!");
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (error: unknown) {
      console.error("Error updating password:", error);
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        alert("Incorrect current password.");
      } else {
        alert("Failed to update password. " + (error instanceof Error ? error.message : "Try again."));
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-[1200px] mx-auto pb-8">
        <div>
          <h1 className="text-2xl font-bold font-outfit text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm">Manage your profile and preferences.</p>
          <Link href="/staff-account" className="mt-3 inline-block text-sm font-semibold text-green-800 underline">Manage authenticator and account security</Link>
        </div>

        <div className="grid grid-cols-1 gap-6">
          
          {/* Profile Information */}
          <Card className="border-slate-100 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-[#1B5E20]">
                <User className="w-5 h-5" />
                <CardTitle className="text-lg">Profile Information</CardTitle>
              </div>
              <CardDescription>Update your account profile information.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700">Full Name</Label>
                  <Input id="fullName" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="bg-slate-50 border-slate-200 h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Email Address</Label>
                  <Input id="email" type="email" value={user?.email || ""} disabled className="bg-slate-50 border-slate-200 h-11 text-slate-500" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact" className="text-xs font-semibold text-slate-700">Contact Number</Label>
                  <Input id="contact" value={profileContact} onChange={(e) => setProfileContact(e.target.value)} className="bg-slate-50 border-slate-200 h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barangay" className="text-xs font-semibold text-slate-700">Barangay</Label>
                  <Input id="barangay" value={barangay || "All Barangays"} disabled className="bg-slate-50 border-slate-200 h-11 text-slate-500" />
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-green-50 relative">
                    <Image src="/images/avatar.png" alt="Profile" fill className="object-cover" />
                  </div>
                  <button onClick={() => alert("Profile picture upload coming soon!")} className="absolute bottom-0 right-0 w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 shadow-sm hover:text-[#1B5E20]">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900 text-sm">{name || "Admin"}</p>
                  <p className="text-xs text-slate-500">{role === "Semi-Admin" ? "Semi Administrator" : "System Administrator"}</p>
                </div>
                <p className="text-[10px] text-slate-400 text-center px-4">
                  You can upload a new profile picture. JPG, PNG up to 2MB.
                </p>
              </div>
              
              <div className="md:col-span-4 flex justify-end">
                <Button onClick={handleUpdateProfile} disabled={isUpdatingProfile} className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-lg px-6 h-10 font-semibold shadow-sm">
                  {isUpdatingProfile ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Change Password */}
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 text-[#1B5E20]">
                  <Key className="w-5 h-5" />
                  <CardTitle className="text-lg">Change Password</CardTitle>
                </div>
                <CardDescription>Update your password to keep your account secure.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Current Password</Label>
                  <Input type="password" value={passwords.current} onChange={(e) => setPasswords({...passwords, current: e.target.value})} placeholder="Enter current password" className="bg-slate-50 border-slate-200 h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">New Password</Label>
                  <Input type="password" value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} placeholder="Enter new password" className="bg-slate-50 border-slate-200 h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Confirm New Password</Label>
                  <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords({...passwords, confirm: e.target.value})} placeholder="Confirm new password" className="bg-slate-50 border-slate-200 h-10" />
                </div>
                <div className="pt-2 flex justify-end">
                  <Button onClick={handleUpdatePassword} disabled={isUpdatingPassword} className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-lg px-6 h-10 font-semibold shadow-sm">
                    {isUpdatingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Notification Preferences */}
              <Card className="border-slate-100 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 text-[#1B5E20]">
                    <Bell className="w-5 h-5" />
                    <CardTitle className="text-lg">Notification Preferences</CardTitle>
                  </div>
                  <CardDescription>Choose how and what notifications you want to receive.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">Email Notifications</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Receive notifications via email</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">Report Updates</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Get notified about updates to reports</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">MENRO Responses</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Get notified when MENRO responds</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="pt-2 flex justify-end">
                    <Button onClick={() => alert("Preferences saved!")} className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-lg px-6 h-10 font-semibold shadow-sm">
                      Save Preferences
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Session Management */}
              <Card className="border-slate-100 shadow-sm border-l-4 border-l-red-500">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-red-600">
                    <Shield className="w-5 h-5" />
                    <CardTitle className="text-lg text-slate-900">Session Management</CardTitle>
                  </div>
                  <CardDescription>Manage your active sessions and sign out when needed.</CardDescription>
                </CardHeader>
                <CardContent className="pt-2 flex justify-between items-center">
                  <p className="text-xs text-slate-500">You will be signed out from this device.</p>
                  <Button onClick={signOut} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold h-10">
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </Button>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
