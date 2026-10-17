import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as policy from "../src/lib/staff-access.ts";
import { withRecentStaffSignIn, StaffConfirmationRequired } from "../src/lib/staff-action.ts";
import { ApiResponseError, readApiResponse } from "../src/lib/api-response.ts";
import { withTimeout } from "../src/lib/request-timeout.ts";
const now = 100000;

test("A signed-in MENRO user can confirm an old session in place and submit the preserved approval once", async () => {
  let claims = { auth_time: now - 600 };
  const user = { getIdTokenResult: async (...args) => { assert.equal(args.length, 0); return { claims }; } };
  const approval = Object.freeze({ action: "approve", userId: "official", position: "Barangay Captain", barangay: "Sala", role: "Semi-Admin", identityConfirmed: true });
  const submitted = [];
  const send = async () => { submitted.push(approval); return { saved: true }; };
  await assert.rejects(withRecentStaffSignIn(user, send, now), StaffConfirmationRequired);
  assert.equal(submitted.length, 0, "No approval is sent before confirming the old session");
  claims = { auth_time: now };
  assert.deepEqual(await withRecentStaffSignIn(user, send, now), { saved: true });
  assert.deepEqual(submitted, [approval]);
});

test("Missing, malformed, future and stale authentication times cannot bypass confirmation", async () => {
  for (const auth_time of [undefined, "100000", NaN, Infinity, now + 61, now - policy.STAFF_RECENT_SECONDS - 1]) {
    let writes = 0;
    await assert.rejects(withRecentStaffSignIn({ getIdTokenResult: async () => ({ claims: { auth_time } }) }, async () => { writes++; }, now), StaffConfirmationRequired);
    assert.equal(writes, 0);
  }
});

test("An expired server freshness window requests confirmation without retrying the approval", async () => {
  let writes = 0;
  const user = { getIdTokenResult: async () => ({ claims: { auth_time: now } }) };
  await assert.rejects(withRecentStaffSignIn(user, async () => {
    writes++;
    return readApiResponse(Response.json({ error: "Confirm your MENRO sign-in.", code: "staff/recent-sign-in-required" }, { status: 401 }));
  }, now), StaffConfirmationRequired);
  assert.equal(writes, 1);
});

test("Other server failures and token errors remain visible and never silently retry a mutation", async () => {
  for (const failure of [new ApiResponseError("Server unavailable", 500, "request-failed"), new ApiResponseError("Staff access suspended", 403, "request-failed"), new ApiResponseError("Session revoked", 401, "request-failed")]) {
    let writes = 0;
    await assert.rejects(withRecentStaffSignIn({ getIdTokenResult: async () => ({ claims: { auth_time: now } }) }, async () => { writes++; throw failure; }, now), error => error === failure);
    assert.equal(writes, 1);
  }
  const failure = new Error("Token unavailable");
  await assert.rejects(withRecentStaffSignIn({ getIdTokenResult: async () => { throw failure; } }, async () => assert.fail("No request should start"), now), error => error === failure);
});

test("The real server guard preserves recent sign-in, role and MFA requirements with a structured confirmation response", async () => {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const compiled = ts.transpileModule(fs.readFileSync(new URL("../src/lib/staff-auth.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modules = { "server-only": {}, "firebase-admin/auth": {}, "firebase-admin/firestore": {}, "firebase-admin/security-rules": {}, "./firebase-admin": {}, "./staff-access": policy };
  const exported = {};
  new Function("require", "exports", compiled)(name => modules[name] || require(name), exported);
  const current = Math.floor(Date.now() / 1000);
  const account = { profile: { role: "Admin", accessStatus: "active" }, identity: { auth_time: current - 600, email_verified: true, staffRole: "admin" } };
  const request = new Request("https://example.invalid/api/staff/manage");
  let failure;
  try { exported.requireApprovedStaff(request, account, true, true); } catch (error) { failure = error; }
  assert.equal(failure.status, 401); assert.equal(failure.code, "staff/recent-sign-in-required");
  await assert.rejects(readApiResponse(exported.staffApiError(failure)), error => error.requiresRecentSignIn === true);
  account.identity.auth_time = current;
  assert.equal(exported.requireApprovedStaff(request, account, true, true), account);
  for (const change of [{ accessStatus: "suspended" }, { role: "Resident" }, { mfaRequired: true }]) {
    assert.throws(() => exported.requireApprovedStaff(request, { ...account, profile: { ...account.profile, ...change } }, true, true), error => error.status === 403 && error.code === undefined);
  }
});

test("A saved staff action stays bound to the administrator who confirmed it", async () => {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const compiled = ts.transpileModule(fs.readFileSync(new URL("../src/lib/staff-client.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const auth = { currentUser: null };
  let changeAccount = false;
  auth.currentUser = { uid: "menro", getIdToken: async () => { if (changeAccount) auth.currentUser = { uid: "other" }; return "fixture-token"; } };
  const modules = { "./firebase": { auth }, "./api-response": { readApiResponse }, "./request-timeout": { withTimeout } };
  let sent = 0;
  const exported = {};
  new Function("require", "exports", "fetch", compiled)(name => modules[name] || require(name), exported, async () => { sent++; return Response.json({ saved: true }); });
  await assert.rejects(exported.staffRequest("/api/staff/manage", { action: "approve" }, "other"), /account changed/);
  assert.equal(sent, 0);
  assert.deepEqual(await exported.staffRequest("/api/staff/manage", { action: "approve" }, "menro"), { saved: true });
  changeAccount = true;
  await assert.rejects(exported.staffRequest("/api/staff/manage", { action: "approve" }, "menro"), /account changed/);
  assert.equal(sent, 1, "The action must not follow a switch to another account");
});
