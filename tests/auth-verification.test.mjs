import test from "node:test";
import assert from "node:assert/strict";
import { createVerificationGate, staffToken } from "../src/lib/auth-verification.ts";

test("routine profile reads reuse a valid token without a refresh round trip", async () => {
  const calls = [];
  const user = { getIdTokenResult: async refresh => { calls.push(refresh); return { claims: { staffRole: "semi-admin", staffBarangay: "Sala" } }; } };
  await staffToken(user, { role: "Semi-Admin", barangay: "Sala", accessStatus: "active", name: "Updated name" });
  assert.deepEqual(calls, [undefined]);
});

test("newly approved permissions refresh once and never fabricate claims", async () => {
  const calls = [];
  const user = { getIdTokenResult: async refresh => { calls.push(refresh); return { claims: refresh ? { staffRole: "semi-admin", staffBarangay: "Sala" } : {} }; } };
  const token = await staffToken(user, { role: "Semi-Admin", barangay: "Sala", accessStatus: "active" });
  assert.equal(token.claims.staffBarangay, "Sala");
  assert.deepEqual(calls, [undefined, true]);
});

test("a slow older approval cannot overwrite a newer suspension or a timeout", async () => {
  const gate = createVerificationGate();
  const older = gate.next();
  const suspended = gate.next();
  assert.equal(gate.isCurrent(older), false);
  assert.equal(gate.isCurrent(suspended), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(suspended), false);
});
