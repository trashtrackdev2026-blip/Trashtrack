"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Users, CalendarDays, Bell, FileText, CalendarCheck, BookOpen, ChartNoAxesCombined, Settings2, House, Send, LogOut, ShieldCheck, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";
import { staffRequest } from "@/lib/staff-client";
import { Brand } from "./Brand";
import { NavigationPending } from "./NavigationPending";

const operations = [
  { name: "Overview", href: "/", icon: House },
  { name: "Collections", href: "/schedules", icon: CalendarDays },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "User Management", href: "/users", icon: Users },
];
const community = [
  { name: "Announcements", href: "/notifications", icon: Bell },
  { name: "Events", href: "/events", icon: CalendarCheck },
  { name: "Learning Management", href: "/education", icon: BookOpen },
  { name: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
  { name: "System feedback", href: "/feedback", icon: MessageSquareText },
];
const barangayItems = [
  { name: "Community reports", href: "/reports", icon: FileText },
  { name: "Reports to MENRO", href: "/reports-to-menro", icon: Send },
];

export function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user, name, barangay } = useAuth();
  const [feedbackCount,setFeedbackCount] = useState({owner:"",count:0});
  const uid=user?.uid;
  useEffect(()=>{if(role!=="Admin"||!uid)return;let stopped=false;const load=()=>{void staffRequest<{newCount:number}>("/api/feedback?summary=1",undefined,uid).then(result=>{if(!stopped)setFeedbackCount({owner:uid,count:result.newCount});}).catch(()=>{});};load();const timer=window.setInterval(load,60_000);return()=>{stopped=true;clearInterval(timer);};},[role,uid]);
  const displayName = name || user?.email?.split("@")[0] || "MENRO Admin";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const navLink = (item: typeof operations[number]) => {
    const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
    return <li key={item.href}><Link href={item.href} onClick={onNavigate} prefetch={false}
      onMouseEnter={() => router.prefetch(item.href)} onFocus={() => router.prefetch(item.href)}
      className="tt-nav-link" aria-current={active ? "page" : undefined} title={collapsed ? item.name : undefined}>
      <item.icon aria-hidden="true" />{!collapsed && <span>{item.name}</span>}{item.href==="/feedback"&&feedbackCount.owner===uid&&feedbackCount.count>0&&<span className="ml-auto rounded-full bg-[#174c39] px-2 py-0.5 text-[10px] text-white" aria-label={`${feedbackCount.count} new feedback messages`}>{feedbackCount.count}</span>}<NavigationPending />
      {collapsed && <span className="sr-only">{item.name}</span>}
    </Link></li>;
  };
  return <aside className={`tt-sidebar${collapsed ? " is-collapsed" : ""}`}>
    <Link href={role === "Semi-Admin" ? "/reports" : "/"} onClick={onNavigate} className="tt-sidebar-brand" aria-label="TrashTrack home">
      <Brand compact={collapsed} subtitle={role === "Semi-Admin" ? barangay || "Barangay workspace" : "Balete MENRO"} />
    </Link>
    <nav className="tt-sidebar-navigation" aria-label="Main navigation">
      <ul>{(role === "Semi-Admin" ? barangayItems : operations).map(navLink)}</ul>
      {role !== "Semi-Admin" && <><p className="tt-nav-label">{collapsed ? <span className="sr-only">Community</span> : "Community"}</p><ul>{community.map(navLink)}</ul></>}
    </nav>
    <div className="tt-sidebar-footer">
      <ul>{navLink(role === "Semi-Admin" ? { name: "Account security", href: "/staff-account", icon: ShieldCheck } : { name: "Settings & security", href: "/settings", icon: Settings2 })}</ul>
      <div className="tt-sidebar-profile">
        <span className="tt-avatar" aria-hidden="true">{initials}</span>
        {!collapsed && <div><strong>{displayName}</strong><small>{role === "Semi-Admin" ? barangay || "Barangay staff" : "MENRO Admin"}</small></div>}
        <button type="button" className="tt-icon-control" onClick={() => { onNavigate?.(); router.push("/logout"); }} aria-label="Log out" title="Log out"><LogOut aria-hidden="true" /></button>
      </div>
    </div>
  </aside>;
}
