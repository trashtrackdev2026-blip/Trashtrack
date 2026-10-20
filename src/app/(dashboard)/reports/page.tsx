"use client";

import { ReportsView } from "@/components/reports/ReportsView";
import { useAuth } from "@/context/AuthContext";
import { useReports } from "@/hooks/use-reports";
import { updateReportStatus } from "@/lib/update-report";

export default function ReportsPage() {
  const { user, role, barangay: userBarangay } = useAuth();
  const { reports, loading, error, retry } = useReports();
  return <ReportsView reports={reports} loading={loading} error={error} retry={retry} role={role} userBarangay={userBarangay}
    onUpdate={async (report, status, remarks, collected) => {
      if (!user) throw new Error("Sign in to update reports.");
      await updateReportStatus(report.id, { uid: user.uid, role, barangay: userBarangay }, status, remarks, collected);
    }} />;
}
