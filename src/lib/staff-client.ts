import { auth } from "./firebase";
export async function staffRequest(path: string, body?: Record<string, unknown>) {
  // Firebase refreshes expired tokens automatically. Forcing a refresh on every
  // request adds a cloud round trip before the actual API request can start.
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to continue.");
  const response = await fetch(path, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

