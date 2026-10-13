export function signInError(failure: unknown) {
  const rawCode = failure && typeof failure === "object" && "code" in failure ? failure.code : null;
  // Expose only an error identifier, never Firebase response bodies or tokens.
  const reference = typeof rawCode === "string" && /^(auth|api)\/[a-z0-9-]+$/.test(rawCode) ? rawCode : "";
  let message: string;
  switch (reference) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      message = "Firebase did not accept the email or password. Check the spelling and password, or use Forgot your password to set a new one.";
      break;
    case "auth/user-disabled":
      message = "This account is disabled. Ask MENRO to reactivate staff access.";
      break;
    case "auth/too-many-requests":
      message = "Firebase temporarily blocked sign-in after repeated attempts. Wait before trying again, or use Forgot your password.";
      break;
    case "auth/network-request-failed":
      message = "Cannot connect to Firebase. Check your internet connection and try again.";
      break;
    case "auth/web-storage-unsupported":
    case "auth/unsupported-persistence-type":
      message = "This browser cannot store the sign-in session. Allow site storage or try another browser.";
      break;
    case "auth/operation-not-allowed":
      message = "Email and password sign-in is unavailable for this Firebase project. Contact MENRO.";
      break;
    case "auth/invalid-api-key":
    case "auth/app-not-authorized":
    case "auth/unauthorized-domain":
      message = "Firebase rejected this app's sign-in configuration. Contact MENRO with the error reference below.";
      break;
    case "auth/invalid-email":
      message = "Enter a valid email address.";
      break;
    case "auth/invalid-verification-code":
    case "auth/code-expired":
      message = "The authenticator code is invalid or expired. Enter the current code.";
      break;
    case "auth/user-token-expired":
    case "auth/id-token-expired":
      message = "This sign-in session expired after an account change. Sign in again.";
      break;
    case "auth/password-does-not-meet-requirements":
      message = "This password no longer meets the account policy. Use Forgot your password to choose a new password.";
      break;
    default:
      message = reference.startsWith("api/") && failure instanceof Error ? failure.message :
        reference ? "Sign-in could not be completed. Contact MENRO with the error reference below." :
        failure instanceof Error && failure.name === "TimeoutError" ? "The account check timed out. Check your internet connection and try again." :
        failure instanceof Error ? failure.message : "Sign-in failed. Try again.";
  }
  return { message, reference };
}
