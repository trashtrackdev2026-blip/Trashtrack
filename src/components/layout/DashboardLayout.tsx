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
      <div className="tt-admin-stage">
       <a href="#workspace-content" className="tt-skip-link">Skip to content</a>
       <div className="tt-workspace-frame">
        <div className="hidden min-h-0 md:flex"><Sidebar collapsed={collapsed} /></div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="tt-mobile-navigation data-[side=left]:w-[280px] max-w-[90vw] gap-0 p-0">
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <SheetDescription className="sr-only">Choose a TrashTrack feature.</SheetDescription>
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="tt-main-scroll">
          <Header toggleSidebar={toggleSidebar} />
          <main id="workspace-content" tabIndex={-1} className="tt-content" aria-labelledby="workspace-heading">
            <div className="tt-page-content">
              {children}
            </div>
          </main>
          <footer className="tt-workspace-footer"><span>Made for the people of Balete.</span><span>MENRO · Municipal workspace</span></footer>
        </div>
       </div>
      </div>
    </ProtectedRoute>
  );
}
