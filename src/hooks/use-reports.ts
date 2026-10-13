"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDoc, query, where, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { subscribeWithDeadline } from "@/lib/live-data";
import { reportWorkflowStatus } from "@/lib/report-workflow";

export interface CommunityReport {
  id: string;
  userId: string;
  type: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  imageUrl: string;
  status: string;
  date: string;
  reporterName: string;
  remarks: string;
  reviewedByName: string;
  verifiedByName: string;
  forwardedByName: string;
  forwardedAt: string;
}

export function useReports() {
  const { user, role, barangay, loading: authLoading } = useAuth();
  const owner = !authLoading && user && (role === "Admin" || (role === "Semi-Admin" && barangay))
    ? JSON.stringify([user.uid, role, barangay]) : "";
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ owner: string; reports: CommunityReport[]; loading: boolean; error: string | null }>({
    owner: "", reports: [], loading: true, error: null,
  });
  const retry = useCallback(() => {
    setState(current => ({ ...current, loading: true, error: null }));
    setAttempt(value => value + 1);
  }, []);

  useEffect(() => {
    if (!owner) return;
    let disposed = false;
    let latest: QueryDocumentSnapshot<DocumentData>[] = [];
    const names = new Map<string, string>();
    const requested = new Set<string>();
    const publish = () => {
      if (disposed) return;
      const reports = latest.map(doc => {
            const data = doc.data();
            return {
              id: doc.id, userId: data.userId || "", type: data.type || "Unknown",
              description: data.description || "", location: data.location || "",
              latitude: data.latitude, longitude: data.longitude, imageUrl: data.imageUrl || "",
              status: reportWorkflowStatus(data), date: data.date || "",
              reporterName: data.reporterName || names.get(data.userId) || "Unknown User",
              remarks: data.remarks || "",
              reviewedByName: typeof data.reviewedByName === "string" ? data.reviewedByName : "",
              verifiedByName: typeof data.verifiedByName === "string" ? data.verifiedByName : "",
              forwardedByName: typeof data.forwardedByName === "string" ? data.forwardedByName : "",
              forwardedAt: data.forwardedAt?.toDate?.().toISOString() || "",
            } satisfies CommunityReport;
          }).sort((a, b) => b.date.localeCompare(a.date));
      setState({ owner, reports, loading: false, error: null });
    };
    const source = role === "Admin" ? collection(db, "reports")
      : query(collection(db, "reports"), where("location", "==", barangay));
    const unsubscribe = subscribeWithDeadline(source, snapshot => {
      latest = snapshot.docs;
      publish();
      // Render reports first; resolve names only for legacy reports that need it.
      const missing = [...new Set(latest.map(doc => doc.data())
        .filter(data => !data.reporterName && typeof data.userId === "string" && data.userId && !requested.has(data.userId))
        .map(data => data.userId as string))];
      missing.forEach(uid => requested.add(uid));
      void (async () => {
        for (let index = 0; index < missing.length && !disposed; index += 10) {
          await Promise.allSettled(missing.slice(index, index + 10).map(async uid => {
            const result = await getDoc(doc(db, "users", uid));
            const name = result.data()?.name;
            if (typeof name === "string") names.set(uid, name);
          }));
          publish();
        }
      })();
    }, error => {
      if (!disposed) setState({ owner, reports: [], loading: false, error: error.message.includes("taking too long") ? error.message : "Unable to load reports. Check your account permissions and connection, then retry." });
    });
    return () => { disposed = true; unsubscribe(); };
  }, [owner, role, barangay, attempt]);

  // Never expose the previous account's snapshot while a new subscription starts.
  return owner && state.owner === owner ? { ...state, retry }
    : { reports: [], loading: !!owner || authLoading, error: null, retry };
}
