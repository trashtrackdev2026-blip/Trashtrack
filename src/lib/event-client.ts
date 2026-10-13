import { auth } from "./firebase";
import { readApiResponse } from "./api-response";

export async function eventRequest(path: string, body: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in again to continue.");
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + await user.getIdToken() },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    await readApiResponse(response, "The request failed. Please try again.");
  }
  return response;
}
