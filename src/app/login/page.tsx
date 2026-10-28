import { LoginForm } from "@/components/auth/LoginForm";
import Image from "next/image";
import { Headset, Leaf } from "lucide-react";
import styles from "./login.module.css";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="signin-title">
        <div className={styles.brand}><span className={styles.brandMark}>T</span><span>TrashTrack</span></div>
        <div className={styles.content}>
          <h1 id="signin-title">Balete <span>MENRO</span><br />Admin sign-in</h1>
          <p className={styles.intro}>Sign in as MENRO Master Admin<br />or approved barangay staff.</p>
          <LoginForm />
          <div className={styles.support}>
            <span className={styles.supportIcon}><Headset size={25} aria-hidden="true" /></span>
            <p><strong>Need approval or account recovery?</strong><br />Contact MENRO at the municipal office.</p>
          </div>
        </div>
        <p className={styles.copyright}>&copy; {new Date().getFullYear()} Municipality of Balete, Batangas. All rights reserved.</p>
      </section>
      <section className={styles.hero} aria-label="A cleaner Balete">
        <Image src="/images/balete-municipal-signin.webp" alt="Enhanced municipal building artwork supplied for the Balete sign-in design" fill sizes="(min-width: 900px) 60vw, 0px" preload className={styles.heroImage} />
        <div className={styles.message}>
          <span className={styles.leaf}><Leaf size={30} aria-hidden="true" /></span>
          <h2>Sustainable Waste<br />Management<br />for a Cleaner Balete</h2>
          <p>Our platform provides comprehensive tools to monitor, manage, and optimize waste collection, ensuring a cleaner and healthier environment for the people of Balete, Batangas.</p>
        </div>
      </section>
    </main>
  );
}
