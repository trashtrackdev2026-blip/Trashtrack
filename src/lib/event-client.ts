import { auth } from "./firebase";

export async function eventRequest(path: string, body: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in again to continue.");
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken() },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "The request failed. Please try again.");
  }
  return response;
}
