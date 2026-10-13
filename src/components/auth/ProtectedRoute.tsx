"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, role, loading, error, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !error) {
      if (!user) {
        router.replace("/login");
      } else if (allowedRoles && (!role || !allowedRoles.includes(role))) {
        // User is logged in but doesn't have the required role
        router.replace(role === "Semi-Admin" ? "/reports" : "/staff-account");
      }
    }
  }, [user, role, loading, error, router, pathname, allowedRoles]);

  if (error) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm text-center" role="alert">
        <h1 className="text-xl font-bold text-slate-900">Unable to connect</h1>
        <p className="mt-3 text-sm text-slate-600">{error}</p>
        <button onClick={retry} className="mt-6 rounded-lg bg-[#1B5E20] px-6 py-3 text-sm font-semibold text-white">Retry</button>
        <Link href="/login" className="ml-4 text-sm font-medium text-[#1B5E20] underline">Go to login</Link>
      </div>
    </div>;
  }

  // Show nothing while loading or if not authenticated (useEffect will redirect)
  if (loading || !user) {
    return <div className="min-h-screen bg-slate-50 flex flex-col gap-4 items-center justify-center" role="status">
      <div className="w-8 h-8 border-4 border-[#1B5E20] border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
      <p className="text-sm text-slate-600">Checking your session…</p>
    </div>;
  }

  // If roles are restricted and user doesn't have access, show nothing (useEffect will redirect)
  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return null;
  }

  return <>{children}</>;
}
