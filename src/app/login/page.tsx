import { LoginForm } from "@/components/auth/LoginForm";
import { Brand } from "@/components/layout/Brand";
import Image from "next/image";
import { Headset } from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  return <main className={styles.page}>
    <Image src="/images/balete-lakeside.webp" alt="The real lakeside view of Balete, Batangas at sunset" fill sizes="100vw" preload className={styles.background} />
    <div className={styles.shade} aria-hidden="true" />
    <div className={styles.brand}><Brand /></div>
    <section className={styles.message} aria-label="A cleaner Balete"><h2>A cleaner Balete<br />starts with us.</h2><p>One community. A little care, every day.</p></section>
    <section className={styles.panel} aria-labelledby="signin-title">
      <span className={styles.eyebrow}>Admin workspace</span>
      <h1 id="signin-title">Welcome back</h1>
      <p className={styles.intro}>Sign in to your MENRO workspace.</p>
      <LoginForm />
      <div className={styles.support}><Headset size={16} aria-hidden="true" /><p>Need help? Contact the MENRO office<br /><span>for account approval or recovery.</span></p></div>
    </section>
    <p className={styles.copyright}>Municipality of Balete, Batangas<span>© {new Date().getFullYear()} TrashTrack</span></p>
  </main>;
}
