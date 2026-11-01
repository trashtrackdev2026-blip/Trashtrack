"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { passwordResetFeedback } from "@/lib/password-reset";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000); return () => window.clearTimeout(timer); }, [cooldown]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || cooldown) return;
    setBusy(true); setMessage("");
    try {
      auth.languageCode = "en";
      await sendPasswordResetEmail(auth, email.trim());
      const result = passwordResetFeedback();setMessage(result.message);setAccepted(result.accepted);setCooldown(60);
    } catch (failure) { const result=passwordResetFeedback(failure);setMessage(result.message);setAccepted(result.accepted);if(result.accepted)setCooldown(60); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white relative">
      
      {/* Absolute Logo on top left */}
      <div className="absolute top-8 left-8 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#2E7D32] flex items-center justify-center">
            <span className="text-white font-bold">T</span>
          </div>
          <span className="font-outfit font-bold text-xl text-slate-900">TrashTrack</span>
        </div>
      </div>

      {/* Left Side: Illustration */}
      <div className="hidden md:flex w-full md:w-1/2 bg-slate-50/50 items-center justify-center p-12 relative min-h-screen border-r border-slate-100">
        <div className="w-full max-w-[600px] aspect-square relative mt-12">
          <Image 
            src="/images/forgot_password_illustration.png" 
            alt="Forgot Password Illustration" 
            fill
            className="object-contain mix-blend-multiply"
            priority
          />
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-24 lg:px-32 min-h-screen relative">
        <div className="w-full max-w-sm mx-auto">
          <h1 className="text-4xl md:text-[42px] font-bold text-slate-900 leading-tight mb-8">
            Forgot<br/>Your Password ?
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6 w-full">
            {message && <p role={accepted ? "status" : "alert"} className={"rounded-xl p-4 text-sm " + (accepted ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800")}>{message}</p>}
            <p className="text-sm text-slate-600">Use the same official email you registered with. If no message arrives, check Spam/Junk and ask MENRO to verify the account email and email service.</p>
            <div className="space-y-2">
              <Input
                id="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                autoComplete="username"
                type="email"
                placeholder="Email Address"
                required
                className="bg-slate-50 border-0 h-14 px-6 text-sm rounded-xl focus-visible:ring-2 focus-visible:ring-[#2E7D32]/50 font-medium text-slate-700 placeholder:text-slate-400"
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={busy || cooldown > 0}
              className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl h-14 text-sm font-bold uppercase tracking-wider transition-colors shadow-lg shadow-green-900/20" 
            >
              {busy ? "Requesting…" : cooldown ? `Request again in ${cooldown}s` : "Reset Password"}
            </Button>
            
            <div className="flex justify-center pt-2">
              <Link href="/login" className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
                Back to signin
              </Link>
            </div>
          </form>

          <div className="absolute bottom-8 left-0 right-0 text-center text-[10px] text-slate-400">
            &copy; {new Date().getFullYear()} Municipality of Balete, Batangas. All rights reserved.
          </div>
        </div>
      </div>

    </div>
  );
}
