"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AUTH_TIMEOUT_MS } from "@/lib/request-timeout";
import { staffAccessProblem, staffRole, STAFF_IDLE_MS, STAFF_SESSION_SECONDS } from "@/lib/staff-access";
import { createVerificationGate, staffToken } from "@/lib/auth-verification";
export type UserRole = "Admin" | "Semi-Admin" | "Resident" | null;
interface AuthContextType {
  user: User | null; role: UserRole; barangay: string | null; name: string | null;
  loading: boolean; error: string | null; accessProblem: string | null;
  retry: () => void; signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType>({
  user: null, role: null, barangay: null, name: null, loading: true, error: null, accessProblem: null,
  retry: () => {}, signOut: async () => {},
});
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [barangay, setBarangay] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessProblem, setAccessProblem] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  useEffect(() => {
    let version = 0;
    let initialTimedOut = false;
    const verification = createVerificationGate();
    let stopProfile = () => {};
    let profileTimer: ReturnType<typeof setTimeout> | undefined;
    const initialTimer = setTimeout(() => { initialTimedOut = true; verification.invalidate(); setError("Sign-in could not connect. Check your internet connection."); setLoading(false); }, AUTH_TIMEOUT_MS);
    const stopAuth = onAuthStateChanged(auth, firebaseUser => {
      if (initialTimedOut) return;
      clearTimeout(initialTimer); clearTimeout(profileTimer); stopProfile();
      verification.invalidate();
      const current = ++version;
      setUser(firebaseUser); setRole(null); setBarangay(null); setName(null); setError(null); setAccessProblem(null);
      setLoading(!!firebaseUser);
      if (!firebaseUser) return;
      let permissionKey = "";
      const startDeadline = () => {
        clearTimeout(profileTimer);
        profileTimer = setTimeout(() => { if (current === version) { version++; verification.invalidate(); stopProfile(); setRole(null); setError("Your account could not be verified. Check your internet connection and retry."); setLoading(false); } }, AUTH_TIMEOUT_MS);
      };
      startDeadline();
      stopProfile = onSnapshot(doc(db, "users", firebaseUser.uid), { includeMetadataChanges: true }, async snapshot => {
        // Cached staff approval must be confirmed by the server before access.
        if (snapshot.metadata.fromCache || current !== version) return;
        const check = verification.next();
        const profile = snapshot.data() || {};
        if (profile.accessStatus !== "active" || !staffRole(profile.role)) {
          clearTimeout(profileTimer); setRole("Resident"); setAccessProblem("This staff account needs MENRO approval or has been suspended."); setError(null); setLoading(false);
          return;
        }
        const nextKey = JSON.stringify([profile.role, profile.accessStatus, profile.barangay, profile.staffValidAfter, profile.mfaRequired]);
        if (permissionKey !== nextKey) {
          // Close protected screens while a changed permission is verified.
          permissionKey = nextKey;
          setRole(null); setLoading(true); startDeadline();
        }
        try {
          const token = await staffToken(firebaseUser, profile);
          if (current !== version || !verification.isCurrent(check)) return;
          const problem = staffAccessProblem(profile, token.claims);
          setAccessProblem(problem);
          const assigned = staffRole(profile.role);
          setRole(problem ? "Resident" : assigned === "admin" ? "Admin" : "Semi-Admin");
          setBarangay(typeof profile.barangay === "string" ? profile.barangay : null);
          setName(typeof profile.name === "string" ? profile.name : null);
          setError(null);
        } catch {
          if (current !== version || !verification.isCurrent(check)) return;
          setRole(null); setError("Your session could not be verified. Sign in again.");
        } finally { if (current === version && verification.isCurrent(check)) { clearTimeout(profileTimer); setLoading(false); } }
      }, () => {
        if (current !== version) return;
        verification.invalidate();
        clearTimeout(profileTimer); setRole(null); setLoading(false); setError("Your account could not be verified. Sign in again or check your connection.");
      });
    });
    return () => { version++; verification.invalidate(); clearTimeout(initialTimer); clearTimeout(profileTimer); stopProfile(); stopAuth(); };
  }, [retryAttempt]);
  useEffect(() => {
    if (!user || !["Admin", "Semi-Admin"].includes(role || "")) return;
    let idle: ReturnType<typeof setTimeout>;
    const expire = () => { void firebaseSignOut(auth); };
    let lastActivity = 0;
    const resetIdle = () => {
      const now = Date.now();
      if (now - lastActivity < 1000) return;
      lastActivity = now;
      clearTimeout(idle); idle = setTimeout(expire, STAFF_IDLE_MS);
    };
    resetIdle();
    const events = ["pointerdown", "keydown", "mousemove", "touchstart"];
    events.forEach(event => window.addEventListener(event, resetIdle, { passive: true }));
    const maximum = setInterval(() => {
      void user.getIdTokenResult().then(token => {
        if (Date.now() / 1000 - Number(token.claims.auth_time) > STAFF_SESSION_SECONDS) expire();
      }).catch(expire);
    }, 30000);
    return () => { clearTimeout(idle); clearInterval(maximum); events.forEach(event => window.removeEventListener(event, resetIdle)); };
  }, [user, role]);
  const retry = useCallback(() => { setLoading(true); setError(null); setRetryAttempt(value => value + 1); }, []);
  const signOut = useCallback(async () => { await firebaseSignOut(auth); setRole(null); setUser(null); setBarangay(null); setName(null); setError(null); setAccessProblem(null); }, []);
  const value = useMemo(() => ({ user, role, barangay, name, loading, error, accessProblem, retry, signOut }), [user, role, barangay, name, loading, error, accessProblem, retry, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

