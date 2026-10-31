"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Brand } from "@/components/layout/Brand";
import styles from "./logout.module.css";

export default function LogoutPage() {
  const { signOut, role } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signOut();
      router.replace("/login");
    } catch {
      setError("We couldn’t log you out. Please try again.");
      setLoading(false);
    }
  };

  const staySignedIn = () => {
    if (window.history.length > 1) router.back();
    else router.replace(role === "Semi-Admin" ? "/reports" : "/");
  };

  return <main className={styles.page}>
    <picture className={styles.backgroundPicture} aria-hidden="true">
      <source type="image/webp" srcSet="/images/balete-lakeside-1280.webp 1280w, /images/balete-lakeside-1920.webp 1920w, /images/balete-lakeside-hd.webp 2500w" sizes="(max-aspect-ratio: 500/313) 160vh, 100vw" />
      <Image src="/images/balete-lakeside-hd.webp" alt="" fill unoptimized loading="eager" fetchPriority="high" className={styles.background} />
    </picture>
    <div className={styles.shade} aria-hidden="true" />
    <div className={styles.brand}><Brand light /></div>

    <section className={styles.confirmation} aria-labelledby="logout-heading" aria-busy={loading}>
      <svg className={styles.exitIcon} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 3 5v17l9 2V3ZM12 14h11m-4-4 4 4-4 4" />
        <path d="M8.5 13h.01" strokeWidth="2" />
      </svg>
      <p className={styles.eyebrow}>Admin workspace</p>
      <h1 id="logout-heading">Ready to log out?</h1>
      <p className={styles.thanks}>Thanks for helping keep Balete clean.</p>
      <p className={styles.description}>You can sign in again whenever you’re ready.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.stayButton} onClick={staySignedIn} disabled={loading}>Stay signed in</button>
        <button type="button" className={styles.logoutButton} onClick={handleLogout} disabled={loading}>
          {loading ? <>Logging out…<LoaderCircle className={styles.spinner} aria-hidden="true" /></> : <>Log out<ArrowRight aria-hidden="true" /></>}
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <span className="sr-only" role="status" aria-live="polite">{loading ? "Logging out. Please wait." : ""}</span>
    </section>

    <p className={styles.location}>Balete, Batangas</p>
  </main>;
}
