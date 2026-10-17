import { auth } from "./firebase";
import { readApiResponse } from "./api-response";
import { withTimeout } from "./request-timeout";
export async function staffRequest<T = Record<string, unknown>>(path: string, body?: Record<string, unknown>, expectedUserId?: string): Promise<T> {
  // Firebase refreshes expired tokens automatically. Forcing a refresh on every
  // request adds a cloud round trip before the actual API request can start.
  const user = auth.currentUser;
  if (expectedUserId && user?.uid !== expectedUserId) throw new Error("The signed-in account changed. Review the action again.");
  const token = await withTimeout(user?.getIdToken() || Promise.resolve(null), "Your sign-in check timed out. Check your connection and try again.");
  if (!token) throw new Error("Sign in to continue.");
  if (auth.currentUser?.uid !== user?.uid) throw new Error("The signed-in account changed. Review the action again.");
  const response = await fetch(path, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(30000) });
  return readApiResponse<T>(response);
}

