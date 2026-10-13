"use client";

import { useCallback, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const ADMIN_ROLES = ["Admin"];
const REPORT_ROLES = ["Admin", "Semi-Admin"];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const allowedRoles = ["/reports", "/reports-to-menro"].includes(pathname) ? REPORT_ROLES : ADMIN_ROLES;

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setMobileOpen(value => !value);
    else setCollapsed(value => !value);
  }, []);

  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <div className="flex h-dvh min-h-0 bg-slate-50 overflow-hidden">
        <div className="hidden md:block"><Sidebar collapsed={collapsed} /></div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="data-[side=left]:w-[260px] max-w-[90vw] gap-0 p-0">
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <SheetDescription className="sr-only">Choose a TrashTrack feature.</SheetDescription>
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex flex-col flex-1 min-h-0 w-0">
          <Header toggleSidebar={toggleSidebar} />
          <main className="flex-1 relative isolate overflow-y-auto focus:outline-none">
            <div className="py-6 px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
