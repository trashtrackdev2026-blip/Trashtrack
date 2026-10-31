import test from "node:test";
import assert from "node:assert/strict";
import { STAFF_BARANGAYS, STAFF_SESSION_SECONDS, staffAccessProblem, requestFields, staffAssignmentFields } from "../src/lib/staff-access.ts";
const now = 100000;
const master = { role: "Admin", accessStatus: "active" };
const claims = { staffRole: "admin", email_verified: true, auth_time: now };
test("Access requires server claims, verified email and active approval", () => {
  assert.equal(staffAccessProblem(master, claims, now), null);
  for (const change of [{ accessStatus: "suspended" }, { accessStatus: "activating" }, { accessStatus: "needs-review" }, { role: "Resident" }]) assert.ok(staffAccessProblem({ ...master, ...change }, claims, now));
  for (const change of [{ staffRole: undefined }, { staffRole: "semi-admin" }, { email_verified: false }]) assert.ok(staffAccessProblem(master, { ...claims, ...change }, now));
});
test("All 13 barangay scopes require exact agreement between approval and claims", () => {
  assert.equal(new Set(STAFF_BARANGAYS).size, 13);
  for (const barangay of STAFF_BARANGAYS) {
    const profile = { role: "Semi-Admin", accessStatus: "active", barangay };
    const scoped = { ...claims, staffRole: "semi-admin", staffBarangay: barangay };
    assert.equal(staffAccessProblem(profile, scoped, now), null);
    assert.ok(staffAccessProblem(profile, { ...scoped, staffBarangay: "Poblacion 2" }, now));
  }
  assert.ok(staffAccessProblem({ role: "Semi-Admin", accessStatus: "active", barangay: "Poblacion 2" }, { ...claims, staffRole: "semi-admin", staffBarangay: "Poblacion 2" }, now));
});
test("Staff sessions expire and revoked permissions cannot be reused", () => {
  assert.ok(staffAccessProblem(master, { ...claims, auth_time: now - STAFF_SESSION_SECONDS - 1 }, now));
  assert.ok(staffAccessProblem(master, { ...claims, auth_time: now + 61 }, now));
  assert.ok(staffAccessProblem({ ...master, staffValidAfter: now }, claims, now));
  assert.equal(staffAccessProblem({ ...master, staffValidAfter: now - 1 }, claims, now), null);
});
test("Required authenticator cannot be bypassed by a password-only or phone challenge", () => {
  const profile = { ...master, mfaRequired: true };
  assert.ok(staffAccessProblem(profile, claims, now));
  assert.ok(staffAccessProblem(profile, { ...claims, firebase: { sign_in_second_factor: "phone" } }, now));
  assert.equal(staffAccessProblem(profile, { ...claims, firebase: { sign_in_second_factor: "totp" } }, now), null);
});
test("Public requests cannot select a master role or inject security fields", () => {
  const input = { name: "  Juan   dela Cruz ", barangay: "Sala", position: "Official", contact: "09123456789", role: "Admin", mfaRequired: false, accessStatus: "active" };
  assert.deepEqual(requestFields(input), { name: "Juan dela Cruz", barangay: "Sala", position: "Official", contact: "09123456789" });
  assert.throws(() => requestFields({ ...input, barangay: "Poblacion 2" }));
  assert.throws(() => requestFields({ ...input, position: "" }));
});
test("MENRO role assignment validates authority and isolates barangay scope", () => {
  assert.throws(() => staffAssignmentFields({ role: "Admin", barangay: "Sala", identityConfirmed: true }), /Semi-Admin access only/);
  for (const barangay of STAFF_BARANGAYS) assert.deepEqual(staffAssignmentFields({ role: "Semi-Admin", barangay, identityConfirmed: true }), { role: "Semi-Admin", barangay });
  assert.deepEqual(staffAssignmentFields({ barangay: "Sala", identityConfirmed: true }), { role: "Semi-Admin", barangay: "Sala" });
  for (const body of [
    { role: "Resident", barangay: "Sala", identityConfirmed: true },
    { role: "Admin", identityConfirmed: false },
    { role: "Admin", identityConfirmed: "true" },
    { role: "Semi-Admin", barangay: "Poblacion 2", identityConfirmed: true },
    { role: "Semi-Admin", identityConfirmed: true },
  ]) assert.throws(() => staffAssignmentFields(body));
});
