import { staffRole } from "./staff-access.ts";

/** A newer profile, sign-out, or timeout makes an older verification unusable. */
export function createVerificationGate() {
  let version = 0;
  return {
    next: () => ++version,
    isCurrent: (request: number) => request === version,
    invalidate: () => { version++; },
  };
}

export async function staffToken<T extends { claims: Record<string, unknown> }>(
  user: { getIdTokenResult: (refresh?: boolean) => Promise<T> },
  profile: Record<string, unknown>,
): Promise<T> {
  const token = await user.getIdTokenResult();
  const role = staffRole(profile.role);
  // Approval may change custom claims during a session. Refresh only for that
  // mismatch, rather than for every cached/server profile or name update.
  if (profile.accessStatus === "active" && role &&
      (token.claims.staffRole !== role || (role === "semi-admin" && token.claims.staffBarangay !== profile.barangay))) {
    return user.getIdTokenResult(true);
  }
  return token;
}
