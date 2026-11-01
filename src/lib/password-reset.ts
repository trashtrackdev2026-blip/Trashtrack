export function passwordResetFeedback(error?: unknown): { message: string; accepted: boolean } {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (!error || code === "auth/user-not-found") return { accepted: true, message: "If this email has an account, a reset link will arrive shortly. Check Spam or Junk and use the latest message. A successful request does not confirm inbox delivery." };
  const message = code === "auth/invalid-email" ? "Enter the official email address used when registering."
    : code === "auth/too-many-requests" ? "Too many reset requests. Wait a few minutes before requesting another link."
    : code === "auth/network-request-failed" ? "The reset request could not reach the email service. Check your connection and try again."
    : ["auth/invalid-continue-uri", "auth/unauthorized-continue-uri", "auth/operation-not-allowed"].includes(code) ? "Password reset is unavailable for this dashboard configuration. Contact MENRO and include reference " + code + "."
    : "The reset request could not be confirmed. Try again, or contact MENRO with reference " + (code || "reset/request-failed") + ".";
  return { accepted: false, message };
}
