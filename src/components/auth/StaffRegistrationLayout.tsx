import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/layout/Brand";

export function StaffRegistrationLayout({ children }: { children: React.ReactNode }) {
  return <main className="tt-auth-page"><aside className="tt-auth-scene"><Image src="/images/balete-real-photo.webp" alt="Balete's green landscape overlooking Taal Lake" width={1672} height={941} priority sizes="(min-width:900px) 45vw, 100vw" /><div className="tt-auth-scene-content"><Link href="/login" aria-label="TrashTrack sign in"><Brand light subtitle="Balete MENRO" /></Link><div><span className="tt-auth-kicker">OUR BARANGAYS. ONE COMMUNITY.</span><h1>A little care.<br />A cleaner Balete.</h1><p>Your local workspace for reports, collection days and community action.</p></div><p className="tt-auth-trust"><ShieldCheck aria-hidden="true" /> Official access, reviewed by MENRO.</p></div></aside><section className="tt-auth-form-pane"><Link href="/login" className="tt-text-link mb-7 inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link><div className="tt-auth-card"><span className="tt-auth-kicker">BARANGAY WORKSPACE</span><h2>Join your community team.</h2><p className="tt-auth-intro">Create your official account, verify your email, then wait for MENRO approval.</p>{children}</div><p className="mt-6 text-center text-xs text-[#64736b]">TrashTrack · Municipality of Balete, Batangas</p></section></main>;
}
