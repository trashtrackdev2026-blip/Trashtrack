"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  Users, 
  CalendarDays, 
  Bell, 
  FileText, 
  CalendarCheck, 
  BookOpen, 
  PieChart, 
  Settings,
  Home,
  Send,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavigationPending } from "./NavigationPending";

const adminNavItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "User Management", href: "/users", icon: Users },
  { name: "Collection Schedules", href: "/schedules", icon: CalendarDays },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Reports Management", href: "/reports", icon: FileText },
  { name: "Community Events", href: "/events", icon: CalendarCheck },
  { name: "Education Resources", href: "/education", icon: BookOpen },
  { name: "Reports & Analytics", href: "/analytics", icon: PieChart },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Account security", href: "/staff-account", icon: Settings },
];

const semiAdminNavItems = [
  { name: "Community Reports", href: "/reports", icon: FileText },
  { name: "Reports to MENRO", href: "/reports-to-menro", icon: Send },
  { name: "Account security", href: "/staff-account", icon: Settings },
];

export function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user, name, barangay } = useAuth();

  const navItems = role === "Semi-Admin" ? semiAdminNavItems : adminNavItems;

  return (
    <div className={cn("bg-white border-r border-slate-200 h-dvh min-h-0 shrink-0 overflow-hidden transition-all duration-300 flex flex-col", collapsed ? "w-20" : "w-[260px]")}>
      
      {/* Logo Area */}
      <div className="pt-6 pb-4 px-6 flex items-center shrink-0">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden relative">
          <Image src="/images/logo.png" alt="TrashTrack Logo" fill sizes="40px" className="object-cover" />
        </div>
        {!collapsed && (
          <div className="ml-3 flex flex-col">
            <span className="font-outfit font-bold text-xl text-[#1B5E20] leading-none">TrashTrack</span>
            <span className="text-xs text-slate-500 font-medium mt-1">{role === "Semi-Admin" ? "Semi Admin Panel" : "Admin Panel"}</span>
          </div>
        )}
      </div>

      {/* User Profile Area */}
      {!collapsed && (
        <div className="px-6 py-4 flex items-center shrink-0 mb-2">
          <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-green-100 flex items-center justify-center bg-slate-50 relative">
            <Image src="/images/avatar.png" alt="Admin Avatar" fill sizes="48px" className="object-cover" />
          </div>
          <div className="ml-3 flex flex-col">
            <span className="font-semibold text-sm text-slate-900 leading-tight">{name || user?.email?.split('@')[0] || "Admin User"}</span>
            <span className="text-[10px] text-[#2E7D32] font-semibold mt-1">
              {role === "Semi-Admin" ? barangay || "No Barangay" : "MENRO Admin"}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-2 pb-4">
        <ul className="space-y-1.5 px-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href + "/") && item.href !== "/");
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(item.href)}
                  onFocus={() => router.prefetch(item.href)}
                  className={cn(
                    "flex items-center rounded-lg px-4 py-3 transition-colors group",
                    isActive 
                      ? "bg-[#1B5E20] text-white shadow-sm" 
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                    collapsed ? "justify-center px-0" : ""
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-white" : "text-slate-600")} strokeWidth={isActive ? 2.5 : 2} />
                  {!collapsed && <span className="ml-4 text-sm font-medium">{item.name}</span>}
                  <NavigationPending />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="px-4 mt-6">
          <button
            onClick={() => { onNavigate?.(); router.push("/logout"); }}
            className={cn(
              "flex items-center w-full text-left rounded-lg px-4 py-3 text-red-600 hover:bg-red-50 transition-colors group",
              collapsed ? "justify-center px-0" : ""
            )}
            title={collapsed ? "Log Out" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" strokeWidth={2} />
            {!collapsed && <span className="ml-4 text-sm font-medium">Log Out</span>}
          </button>
        </div>
        {/* Artwork stays in the scroll flow so every menu item remains reachable. */}
        {!collapsed && (
          <div className="mt-4 px-4 pointer-events-none" aria-hidden="true">
            <Image
              src="/images/garbage-truck.png"
              alt=""
              width={260}
              height={260}
              className="w-full h-auto opacity-90"
            />
          </div>
        )}
      </nav>
    </div>
  );
}
