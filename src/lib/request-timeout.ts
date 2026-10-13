export const AUTH_TIMEOUT_MS = 10_000;

export async function withTimeout<T>(
  request: Promise<T>,
  message: string,
  timeoutMs = AUTH_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
