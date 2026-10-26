"use client";

import { useAuth } from "@/context/AuthContext";
import { Menu, LogOut, User as UserIcon, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeWithDeadline } from "@/lib/live-data";

export function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const { user, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingDeliveries, setPendingDeliveries] = useState(0);
  useEffect(() => {
    if (role !== "Admin") return;
    return subscribeWithDeadline(collection(db, "notifications"), snapshot => {
      setPendingDeliveries(snapshot.docs.filter(doc => {
        const notice = doc.data();
        return notice.push === true && ["pending", "sending", "failed"].includes(notice.pushStatus ?? "pending");
      }).length);
    }, () => setPendingDeliveries(0));
  }, [role]);

  // Simple mapping to get page title and subtitle
  const getPageInfo = () => {
    switch (pathname) {
      case "/": return { title: "Dashboard", subtitle: "Overview of waste management operations." };
      case "/users": return { title: "User Management", subtitle: "Monitor resident and administrator accounts, account statuses, and user access privileges." };
      case "/schedules": return { title: "Collection Schedules", subtitle: "Manage and optimize waste collection routes and timings." };
      case "/reports": return { title: role === "Semi-Admin" ? "Community Reports" : "Reports Management", subtitle: role === "Semi-Admin" ? "Verify community waste reports in your assigned barangay." : "Review and resolve community waste reports and concerns." };
      case "/reports-to-menro": return { title: "Reports to MENRO", subtitle: "Forward verified reports to MENRO and track collection progress." };
      case "/analytics": return { title: "Reports & Analytics", subtitle: "Visualize waste management data and generate official reports." };
      case "/events": return { title: "Community Events", subtitle: "Manage and organize environmental events for the community." };
      case "/settings": return { title: "Settings", subtitle: "Manage your account preferences and system settings." };
      default: return { title: "TrashTrack", subtitle: "Admin Panel" };
    }
  };

  const { title, subtitle } = getPageInfo();

  return (
    <header className="h-20 md:h-24 border-b border-slate-200 bg-white flex items-center justify-between gap-3 px-4 md:px-8 shrink-0 shadow-sm z-10">
      <div className="flex min-w-0 items-center gap-3 md:gap-6">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-slate-600 hover:text-slate-900 bg-slate-100/50 hover:bg-slate-200/50 rounded-full h-10 w-10">
          <Menu className="w-5 h-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
        <div className="flex min-w-0 flex-col">
          <h1 className="text-lg md:text-[26px] font-bold text-slate-900 leading-tight">{title}</h1>
          <p className="hidden md:block text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 md:gap-6">
        <button aria-label="Open notifications" onClick={() => router.push(role === "Admin" ? "/notifications" : "/reports")} className="relative text-slate-600 hover:text-slate-900 transition-colors">
          <Bell className="w-6 h-6" />
          {role === "Admin" && pendingDeliveries > 0 && <span aria-label={`${pendingDeliveries} phone deliveries need attention`} className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 bg-green-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] text-white font-bold">{pendingDeliveries > 99 ? "99+" : pendingDeliveries}</span>}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-slate-50 rounded-full p-1.5 pr-3 transition-colors focus:outline-none cursor-pointer">
            <Avatar className="h-9 w-9 border border-slate-200">
              <AvatarImage src="/images/avatar.png" alt="Profile Avatar" className="object-cover" />
              <AvatarFallback className="bg-slate-100 text-slate-600 font-medium text-sm">
                <UserIcon className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 hidden sm:flex">
              <span className="text-sm font-semibold text-slate-800">{user?.email?.split('@')[0] || "Admin User"}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.email?.split('@')[0] || "Admin User"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/staff-account")} className="text-slate-700 cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => router.push('/logout')}
              className="text-red-600 cursor-pointer focus:text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
