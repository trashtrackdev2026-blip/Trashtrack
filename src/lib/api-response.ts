export class ApiResponseError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, status: number, reason: string) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
    this.code = `api/${reason}-${status}`;
  }
}

/** Proxies and failed functions can return HTML or nothing, even for JSON APIs. */
export async function readApiResponse<T = Record<string, unknown>>(
  response: Response,
  fallback = "The request could not be completed.",
): Promise<T> {
  const raw = await response.text();
  const problem = response.status === 504
    ? "The server took too long to respond. Please try again."
    : response.status >= 500
      ? "The server could not complete this request. Please try again or contact MENRO."
      : response.status === 401
        ? "Your sign-in session could not be verified. Sign in again."
        : response.status === 403
          ? "This request was blocked. Contact MENRO to check the website access settings."
          : fallback;
  if (!raw.trim()) throw new ApiResponseError(problem, response.status, "empty-response");
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { throw new ApiResponseError(problem, response.status, "invalid-response"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApiResponseError("The server returned an invalid response. Please try again.", response.status, "invalid-response");
  }
  if (!response.ok) {
    const detail = (data as Record<string, unknown>).error;
    throw new ApiResponseError(typeof detail === "string" && detail.trim() ? detail : problem, response.status, "request-failed");
  }
  return data as T;
}
