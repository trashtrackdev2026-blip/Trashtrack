import { auth } from "./firebase";
import { readApiResponse } from "./api-response";
export async function staffRequest<T = Record<string, unknown>>(path: string, body?: Record<string, unknown>): Promise<T> {
  // Firebase refreshes expired tokens automatically. Forcing a refresh on every
  // request adds a cloud round trip before the actual API request can start.
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to continue.");
  const response = await fetch(path, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(30000) });
  return readApiResponse<T>(response);
}

