"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Headset, KeyRound, Mail, MapPin } from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { passwordResetFeedback } from "@/lib/password-reset";
import styles from "./recovery.module.css";

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
    <main className={styles.page}>
      <aside className={styles.scene}>
        <Image src="/images/balete-real-photo.webp" alt="" fill sizes="(max-width: 760px) 100vw, 46vw" preload className={styles.photo} />
        <Link href="/login" className={styles.brand} aria-label="TrashTrack sign in">
          <Brand light subtitle="Balete staff workspace" />
        </Link>
        <div className={styles.sceneCopy}>
          <p className={styles.location}><MapPin size={15} aria-hidden="true" /> Balete, Batangas</p>
          <p className={styles.sceneTitle}>Let’s get you<br />back to work.</p>
        </div>
      </aside>
      <section className={styles.pane} aria-labelledby="recovery-title">
        <div className={styles.content}>
          <Link href="/login" className={styles.back}><ArrowLeft size={17} aria-hidden="true" /> Back to sign in</Link>
          <div className={styles.card}>
            <span className={styles.mark}><KeyRound size={25} aria-hidden="true" /></span>
            <p className={styles.eyebrow}>MENRO &amp; barangay staff</p>
            <h1 id="recovery-title">Reset your password</h1>
            <p className={styles.intro}>Enter the official email address you use to sign in to TrashTrack.</p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <label htmlFor="email">Official email address</label>
              <div className={styles.field}>
                <Mail size={18} aria-hidden="true" />
                <Input id="email" value={email} onChange={event => setEmail(event.target.value)}
                  autoComplete="username" type="email" placeholder="Enter your email" required />
              </div>
              {message && (
                <p role={accepted ? "status" : "alert"} className={accepted ? styles.status : styles.error}>{message}</p>
              )}
              <Button type="submit" disabled={busy || cooldown > 0} className={styles.submit}>
                {busy ? "Requesting…" : cooldown ? `Request again in ${cooldown}s` : "Send reset link"}
                {!busy && !cooldown && <ArrowRight aria-hidden="true" />}
              </Button>
            </form>
            <div className={styles.help}>
              <Headset size={19} aria-hidden="true" />
              <p><strong>Need help?</strong> Check Spam or Junk for the reset email. Contact the MENRO office if you can’t access your registered address.</p>
            </div>
          </div>
          <p className={styles.footer}>TrashTrack · Municipality of Balete, Batangas</p>
        </div>
      </section>
    </main>
  );
}
