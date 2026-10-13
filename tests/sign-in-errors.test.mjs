import test from "node:test";
import assert from "node:assert/strict";
import { signInError } from "../src/lib/sign-in-errors.ts";

test("Credential failures remain non-enumerating while giving a recovery action", () => {
  const credential = signInError({ code: "auth/invalid-credential", message: "Private response body" });
  for (const code of ["auth/user-not-found", "auth/wrong-password", "auth/invalid-login-credentials"]) {
    assert.equal(signInError({ code }).message, credential.message);
  }
  assert.match(credential.message, /Forgot your password/);
  assert.equal(credential.reference, "auth/invalid-credential");
  assert.doesNotMatch(credential.message, /Private response/);
});
test("Connection, rate-limit, browser and suspended-account failures give distinct actions", () => {
  assert.match(signInError({ code: "auth/network-request-failed" }).message, /internet connection/);
  assert.match(signInError({ code: "auth/too-many-requests" }).message, /Wait/);
  assert.match(signInError({ code: "auth/web-storage-unsupported" }).message, /another browser/);
  assert.match(signInError({ code: "auth/user-disabled" }).message, /reactivate/);
  assert.match(signInError({ code: "auth/operation-not-allowed" }).message, /Firebase project/);
});
test("Only safe error identifiers are exposed; server access errors are preserved", () => {
  assert.equal(signInError({ code: "auth/invalid-credential?token=private" }).reference, "");
  assert.equal(signInError(new Error("This account needs MENRO approval.")).message, "This account needs MENRO approval.");
  const timeout = new Error("Private diagnostics"); timeout.name = "TimeoutError";
  assert.match(signInError(timeout).message, /timed out/);
});
