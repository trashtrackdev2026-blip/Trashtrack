import { STAFF_RECENT_SECONDS } from "./staff-access.ts";
import { ApiResponseError } from "./api-response.ts";
import { withTimeout } from "./request-timeout.ts";

export class StaffConfirmationRequired extends Error {
  constructor() { super("Confirm your MENRO sign-in to continue without logging out."); }
}

export async function withRecentStaffSignIn<T>(
  user: { getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }> },
  action: () => Promise<T>,
  now = Date.now() / 1000,
): Promise<T> {
  const token = await withTimeout(user.getIdTokenResult(), "Your sign-in check timed out. Check your connection and try again.");
  const signedInAt = token.claims.auth_time;
  if (typeof signedInAt !== "number" || !Number.isFinite(signedInAt) || signedInAt > now + 60 || now - signedInAt > STAFF_RECENT_SECONDS) throw new StaffConfirmationRequired();
  try { return await action(); }
  catch (error) {
    // The server remains authoritative if the freshness window expires while
    // the request is in flight. Other failures must never retry a mutation.
    if (error instanceof ApiResponseError && error.requiresRecentSignIn) throw new StaffConfirmationRequired();
    throw error;
  }
}
