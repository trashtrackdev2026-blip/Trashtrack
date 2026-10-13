// Exercise the management route without Firebase writes, accounts or network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as policy from "../src/lib/staff-access.ts";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync(new URL("../src/app/api/staff/manage/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const records = new Map([
    ["users/menro", { role: "Admin", accessStatus: "active", mfaRequired: false }],
    ["users/official", { role: "Resident", barangay: "Sala", ...options.profile }],
    ["staff_requests/official", { status: "pending", name: "Test Official", contact: "09000000000" }],
  ]);
  const account = { email: "official@example.invalid", emailVerified: true, disabled: false, customClaims: { retained: true }, ...options.account };
  const identity = { uid: "menro", staffRole: "admin", email_verified: true, auth_time: now, ...options.identity };
  let sequence = 0;
  const ref = path => ({ path });
  const collection = name => ({
    doc: id => ref(name + "/" + (id || "audit-" + ++sequence)),
    where: (field, operator, value) => ({ collection: name, field, operator, value }),
  });
  function snapshot(data, target) {
    if (target.path) return { data: () => data.has(target.path) ? structuredClone(data.get(target.path)) : undefined };
    return { docs: [...data].filter(([key, value]) => key.startsWith(target.collection + "/") &&
      (target.operator === "in" ? target.value.includes(value[target.field]) : value[target.field] === target.value))
      .map(([key, value]) => ({ id: key.split("/")[1], data: () => structuredClone(value) })) };
  }
  const deleted = Symbol("delete");
  const db = {
    collection,
    async runTransaction(action) {
      const working = new Map(structuredClone([...records]));
      const set = (target, value, merge) => {
        const next = merge ? { ...working.get(target.path) } : {};
        for (const [key, item] of Object.entries(value)) {
          if (item === deleted) delete next[key]; else next[key] = item;
        }
        working.set(target.path, next);
      };
      const result = await action({ get: async target => snapshot(working, target), set: (target, value, options) => set(target, value, options?.merge),
        update: (target, value) => set(target, value, true), create: (target, value) => set(target, value, false) });
      records.clear(); for (const [key, value] of working) records.set(key, value);
      return result;
    },
  };
  const revoked = [];
  const auth = {
    getUser: async () => structuredClone(account),
    setCustomUserClaims: async (uid, claims) => {
      if (options.authFailure) throw new Error("Fixture Auth unavailable");
      account.customClaims = claims;
      if (options.actorChanged) records.get("users/menro").accessStatus = "suspended";
    },
    revokeRefreshTokens: async uid => { revoked.push(uid); },
    updateUser: async (uid, changes) => { Object.assign(account, changes); },
  };
  const staffAuth = {
    authenticatedStaff: async (request, masterOnly, recent) => {
      assert.equal(masterOnly, true, "MENRO-only server guard must run");
      assert.equal(recent, true, "Access mutations must require recent sign-in");
      if (options.signedOut) throw new policy.StaffAccessError("Sign in", 401);
      const profile = records.get("users/" + identity.uid) || {};
      if (policy.staffAccessProblem(profile, identity) || policy.staffRole(profile.role) !== "admin") throw new policy.StaffAccessError("Only MENRO");
      if (now - identity.auth_time > 300) throw new policy.StaffAccessError("Sign in again", 401);
      return { app: {}, db, identity };
    },
    requireStaffSecurity: async () => {},
    staffApiError: error => Response.json({ error: error.message }, { status: error instanceof policy.StaffAccessError ? error.status : 500 }),
  };
  const modules = { "firebase-admin/auth": { getAuth: () => auth }, "firebase-admin/firestore": { FieldValue: { serverTimestamp: () => "timestamp", delete: () => deleted } },
    "@/lib/staff-auth": staffAuth, "@/lib/staff-access": policy };
  const exported = {};
  new Function("require", "exports", compiled)(name => modules[name] || require(name), exported);
  return { records, account, revoked, now, async post(body, status = 200) {
    const response = await exported.POST(new Request("http://127.0.0.1:3000/api/staff/manage", { method: "POST", body: JSON.stringify({ userId: "official", ...body }) }));
    const result = await response.json();
    assert.equal(response.status, status, result.error || "Expected response");
    return result;
  } };
}

test("MENRO approves Admin access, saves its role and clears barangay claims", async () => {
  const app = fixture();
  await app.post({ action: "approve", role: "Admin", barangay: "Sala", identityConfirmed: true });
  const profile = app.records.get("users/official");
  assert.equal(profile.role, "Admin"); assert.equal(profile.barangay, ""); assert.equal(profile.accessStatus, "active");
  assert.equal(profile.pendingAccessOperation, undefined);
  assert.deepEqual(app.account.customClaims, { retained: true, staffRole: "admin", staffBarangay: "" });
  assert.deepEqual(app.revoked, ["official"]);
  assert.equal(app.records.get("staff_requests/official").approvedRole, "Admin");
  assert.ok([...app.records.values()].some(value => value.action === "staff.approve" && value.role === "Admin"));
});
test("Legacy approvals still grant only the selected barangay", async () => {
  const app = fixture();
  await app.post({ action: "approve", barangay: "Sala", identityConfirmed: true });
  assert.equal(app.records.get("users/official").role, "Semi-Admin");
  assert.equal(app.account.customClaims.staffRole, "semi-admin"); assert.equal(app.account.customClaims.staffBarangay, "Sala");
});
test("Unauthorized, old-session and self-access changes are blocked before writes", async () => {
  for (const [options, status] of [[{ signedOut: true }, 401], [{ identity: { staffRole: "semi-admin" } }, 403], [{ identity: { auth_time: Math.floor(Date.now() / 1000) - 301 } }, 401]]) {
    const app = fixture(options);
    await app.post({ action: "approve", role: "Admin", identityConfirmed: true }, status);
    assert.equal(app.records.get("users/official").role, "Resident"); assert.equal(app.revoked.length, 0);
  }
  const app = fixture();
  await app.post({ action: "assign", userId: "menro", role: "Semi-Admin", barangay: "Sala", identityConfirmed: true }, 409);
  assert.equal(app.records.get("users/menro").role, "Admin");
});
test("Unverified officials, invalid roles and unconfirmed assignments cannot activate", async () => {
  const unverified = fixture({ account: { emailVerified: false } });
  await unverified.post({ action: "approve", role: "Admin", identityConfirmed: true }, 409);
  for (const body of [{ role: "Resident", identityConfirmed: true }, { role: "Admin", identityConfirmed: false }, { role: "Semi-Admin", barangay: "Poblacion 2", identityConfirmed: true }]) {
    const app = fixture(); await app.post({ action: "approve", ...body }, 400);
    assert.equal(app.records.get("staff_requests/official").status, "pending"); assert.equal(app.account.customClaims.staffRole, undefined);
  }
});
test("Changing active staff access updates scope and preserves required MFA", async () => {
  const app = fixture({ profile: { role: "Semi-Admin", accessStatus: "active", barangay: "Sala", mfaRequired: true } });
  await app.post({ action: "assign", role: "Admin", identityConfirmed: true });
  assert.equal(app.account.customClaims.staffRole, "admin"); assert.equal(app.account.customClaims.staffBarangay, "");
  await app.post({ action: "assign", role: "Semi-Admin", barangay: "Solis", identityConfirmed: true });
  const profile = app.records.get("users/official");
  assert.equal(profile.role, "Semi-Admin"); assert.equal(profile.barangay, "Solis"); assert.equal(profile.mfaRequired, true);
  assert.equal(app.account.customClaims.staffRole, "semi-admin"); assert.equal(app.account.customClaims.staffBarangay, "Solis");
  assert.ok(profile.staffValidAfter >= app.now); assert.equal(app.revoked.length, 2);
  assert.equal(app.records.get("staff_requests/official").status, "pending", "Role edits do not approve unrelated requests");
});
test("Pending and suspended accounts cannot bypass approval or reactivation through role edits", async () => {
  for (const accessStatus of ["needs-review", "suspended", "activating"]) {
    const app = fixture({ profile: { role: "Semi-Admin", accessStatus } });
    await app.post({ action: "assign", role: "Admin", identityConfirmed: true }, 409);
    assert.equal(app.records.get("users/official").accessStatus, accessStatus);
  }
});
test("Cross-service failures and revoked MENRO access keep activation blocked", async () => {
  for (const [options, status] of [[{ authFailure: true }, 500], [{ actorChanged: true }, 409]]) {
    const app = fixture(options);
    await app.post({ action: "approve", role: "Admin", identityConfirmed: true }, status);
    assert.equal(app.records.get("users/official").accessStatus, "activating");
    assert.equal(app.records.get("staff_requests/official").status, "pending");
  }
});
