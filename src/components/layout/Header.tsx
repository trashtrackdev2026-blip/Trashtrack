"use client";

import { useAuth } from "@/context/AuthContext";
import { Menu, LogOut, UserRound, Bell, ChevronRight, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeWithDeadline } from "@/lib/live-data";

type PageInfo = { title: string; subtitle: string; section: string; action?: { href: string; label: string } };
const pages: Record<string, PageInfo> = {
  "/": { section: "Overview", title: "A cleaner Balete, together.", subtitle: "Here’s what needs your attention today." },
  "/schedules": { section: "Collections", title: "Collection schedules", subtitle: "A clear plan for every barangay.", action: { href: "/schedules/create", label: "New schedule" } },
  "/users": { section: "Residents & staff", title: "Residents & staff", subtitle: "People at the heart of a cleaner Balete." },
  "/reports": { section: "Reports", title: "Community reports", subtitle: "Listen, validate, and help resolve local concerns." },
  "/reports-to-menro": { section: "Reports to MENRO", title: "Reports to MENRO", subtitle: "Forward verified concerns and follow their progress." },
  "/notifications": { section: "Announcements", title: "Announcements", subtitle: "Keep residents informed, wherever they are.", action: { href: "/notifications/create", label: "Create notification" } },
  "/events": { section: "Events", title: "Community events", subtitle: "Bring people together for a healthier community.", action: { href: "/events/create", label: "Create event" } },
  "/education": { section: "Learning Management", title: "Learning Management", subtitle: "Useful knowledge for everyday environmental care.", action: { href: "/education/create", label: "Add resource" } },
  "/analytics": { section: "Analytics", title: "Reports & analytics", subtitle: "See patterns. Focus care where it matters." },
  "/settings": { section: "Settings", title: "Settings & security", subtitle: "A comfortable workspace. An account you can trust." },
};
const creationPages: Record<string, PageInfo> = {
  "/schedules/create": { section: "Collections", title: "Plan a collection", subtitle: "Set the details, review, and share with your barangay." },
  "/events/create": { section: "Events", title: "Create a community event", subtitle: "Make room for your community to come together." },
  "/notifications/create": { section: "Announcements", title: "Create a notification", subtitle: "A clear message, delivered to the right community." },
  "/education/create": { section: "Learning Management", title: "Add a learning resource", subtitle: "Share something useful with your community." },
};

export function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const { user, name, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingDeliveries, setPendingDeliveries] = useState(0);
  useEffect(() => {
    if (role !== "Admin") return;
    return subscribeWithDeadline(collection(db, "notifications"), snapshot => {
      setPendingDeliveries(snapshot.docs.filter(doc => { const notice = doc.data(); return notice.push === true && ["pending", "sending", "failed"].includes(notice.pushStatus ?? "pending"); }).length);
    }, () => setPendingDeliveries(0));
  }, [role]);
  const page = pages[pathname] || creationPages[pathname] || { section: "Workspace", title: "TrashTrack", subtitle: "Care for your community." };
  const displayName = name || user?.email?.split("@")[0] || "MENRO Admin";
  const date = new Intl.DateTimeFormat("en-PH", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Manila" }).format(new Date());
  return <header className={`tt-page-header${pathname === "/" ? " tt-page-header-home" : ""}`}>
    <div className="tt-topbar">
      <div className="tt-topbar-start"><button type="button" onClick={toggleSidebar} className="tt-icon-control" aria-label="Toggle navigation"><Menu aria-hidden="true" /></button>
        <nav className="tt-breadcrumb" aria-label="Breadcrumb"><Link href={role === "Semi-Admin" ? "/reports" : "/"}>Workspace</Link><ChevronRight aria-hidden="true" /><span aria-current="page">{page.section}</span></nav>
      </div>
      <div className="tt-topbar-actions"><time suppressHydrationWarning>{date}</time>
        <button type="button" className="tt-icon-control tt-notification-control" aria-label={pendingDeliveries ? `${pendingDeliveries} phone deliveries need attention` : "Open notifications"} onClick={() => router.push(role === "Admin" ? "/notifications" : "/reports")}><Bell aria-hidden="true" />{role === "Admin" && pendingDeliveries > 0 && <span className="tt-notification-dot" />}</button>
        <DropdownMenu><DropdownMenuTrigger className="tt-icon-control" aria-label="Account menu"><UserRound aria-hidden="true" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60"><DropdownMenuGroup><DropdownMenuLabel>{displayName}<span className="mt-1 block break-all text-xs font-normal text-muted-foreground">{user?.email}</span></DropdownMenuLabel></DropdownMenuGroup>
            <DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem onClick={() => router.push("/staff-account")}><ShieldCheck />Account security</DropdownMenuItem>{role === "Admin" && <DropdownMenuItem onClick={() => router.push("/settings")}><UserRound />Profile settings</DropdownMenuItem>}</DropdownMenuGroup>
            <DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem onClick={() => router.push("/logout")}><LogOut />Log out</DropdownMenuItem></DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    <div className="tt-page-heading"><div><h1 id="workspace-heading">{page.title}</h1><p>{page.subtitle}</p></div>
      {page.action && role === "Admin" && <Link href={page.action.href} className="tt-primary-link"><Plus aria-hidden="true" />{page.action.label}</Link>}
    </div>
  </header>;
}
