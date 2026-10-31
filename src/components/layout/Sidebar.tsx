"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Users, CalendarDays, Bell, FileText, CalendarCheck, BookOpen, ChartNoAxesCombined, Settings2, House, Send, LogOut, ShieldCheck } from "lucide-react";
import { Brand } from "./Brand";
import { NavigationPending } from "./NavigationPending";

const operations = [
  { name: "Overview", href: "/", icon: House },
  { name: "Collections", href: "/schedules", icon: CalendarDays },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Residents & staff", href: "/users", icon: Users },
];
const community = [
  { name: "Announcements", href: "/notifications", icon: Bell },
  { name: "Events", href: "/events", icon: CalendarCheck },
  { name: "Learning library", href: "/education", icon: BookOpen },
  { name: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
];
const barangayItems = [
  { name: "Community reports", href: "/reports", icon: FileText },
  { name: "Reports to MENRO", href: "/reports-to-menro", icon: Send },
];

export function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user, name, barangay } = useAuth();
  const displayName = name || user?.email?.split("@")[0] || "MENRO Admin";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const navLink = (item: typeof operations[number]) => {
    const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
    return <li key={item.href}><Link href={item.href} onClick={onNavigate} prefetch={false}
      onMouseEnter={() => router.prefetch(item.href)} onFocus={() => router.prefetch(item.href)}
      className="tt-nav-link" aria-current={active ? "page" : undefined} title={collapsed ? item.name : undefined}>
      <item.icon aria-hidden="true" />{!collapsed && <span>{item.name}</span>}<NavigationPending />
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
