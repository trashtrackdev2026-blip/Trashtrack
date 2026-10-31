import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as policy from "../src/lib/staff-access.ts";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync(new URL("../src/app/api/staff/requests/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const details = { name: "Barangay Official", position: "Barangay secretary", contact: "09000000000", barangay: "Solis" };

function fixture(options = {}) {
  const records = new Map();
  if (options.profile) records.set("users/applicant", structuredClone(options.profile));
  if (options.request) records.set("staff_requests/applicant", structuredClone(options.request));
  const identity = { uid: "applicant", email: "applicant@example.invalid", email_verified: false, ...options.identity };
  let sequence = 0;
  const snapshot = (data, target) => ({ data: () => data.has(target.path) ? structuredClone(data.get(target.path)) : undefined });
  const db = {
    collection: name => ({ doc: id => {
      const target = { path: name + "/" + (id || "audit-" + ++sequence) };
      return { ...target, get: async () => snapshot(records, target) };
    } }),
    async runTransaction(action) {
      if (options.profileChanged) records.set("users/applicant", options.profileChanged);
      const working = new Map(structuredClone([...records]));
      await action({ get: async target => snapshot(working, target),
        set: (target, value) => { working.set(target.path, structuredClone(value)); },
        create: (target, value) => { assert.equal(working.has(target.path), false); working.set(target.path, structuredClone(value)); } });
      records.clear(); for (const [key, value] of working) records.set(key, value);
    },
  };
  const modules = {
    "firebase-admin/firestore": { FieldValue: { serverTimestamp: () => "timestamp" } },
    "@/lib/staff-access": policy,
    "@/lib/staff-auth": {
      authenticatedAccount: async () => {
        if (options.signedOut) throw new policy.StaffAccessError("Sign in", 401);
        return { db, identity, profile: records.get("users/applicant") || {} };
      },
      requireStaffSecurity: async () => { if (options.securityUnavailable) throw new policy.StaffAccessError("Staff setup unavailable", 503); },
      staffApiError: error => Response.json({ error: error.message }, { status: error instanceof policy.StaffAccessError ? error.status : 500 }),
    },
  };
  const exported = {};
  new Function("require", "exports", compiled)(name => modules[name] || require(name), exported);
  return { records, identity, async post(body = details, status = 200) {
    const response = await exported.POST(new Request("http://localhost/api/staff/requests", { method: "POST", body: JSON.stringify(body) }));
    const result = await response.json();
    assert.equal(response.status, status, result.error || "Expected response");
    return result;
  }, async get() {
    const response = await exported.GET(new Request("http://localhost/api/staff/requests"));
    assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    return (await response.json()).request;
  } };
}

test("Registration saves an unverified applicant and pending request atomically without granting staff access", async () => {
  const app = fixture();
  await app.post({ ...details, role: "Admin", accessStatus: "active", userId: "someone-else", email: "forged@example.invalid" });
  const profile = app.records.get("users/applicant");
  assert.equal(profile.role, "Semi-Admin"); assert.equal(profile.points, 0); assert.equal(profile.accessStatus, "needs-review");
  const pending = await app.get();
  assert.equal(pending.status, "pending"); assert.equal(pending.userId, "applicant");
  assert.equal(pending.email, app.identity.email); assert.equal(pending.barangay, "Solis");
  assert.ok([...app.records.values()].some(item => item.action === "staff.request"));
});

test("Resident accounts must use a separate email for staff registration", async () => {
  const app = fixture({ identity: { email_verified: true }, profile: { role: "Resident", points: 83, barangay: "Sala", name: "Saved name" } });
  await app.post(details,409);
  assert.equal(await app.get(),null);
  assert.deepEqual(app.records.get("users/applicant"), { role: "Resident", points: 83, barangay: "Sala", name: "Saved name" });
});

test("All thirteen barangays can queue separate staff registrations", async () => {
  for (const barangay of policy.STAFF_BARANGAYS) {
    const app = fixture();
    await app.post({ ...details, barangay });
    assert.equal((await app.get()).barangay, barangay);
  }
});

test("Retrying registration after a lost response does not duplicate or change a pending request", async () => {
  const app = fixture();
  await app.post();
  const original = structuredClone([...app.records]);
  await app.post();
  assert.deepEqual([...app.records], original);
  await app.post({ ...details, barangay: "Sala" }, 409);
  assert.deepEqual([...app.records], original);
});

test("Invalid details, missing authentication and inactive staff setup leave no partial profile or request", async () => {
  for (const [options, body, status] of [
    [{}, { ...details, position: "" }, 400], [{}, { ...details, barangay: "Other barangay" }, 400],
    [{ identity: { email: undefined } }, details, 400], [{ signedOut: true }, details, 401], [{ securityUnavailable: true }, details, 503],
  ]) {
    const app = fixture(options); await app.post(body, status); assert.equal(app.records.size, 0);
  }
});

test("Access changes during submission are checked again inside the transaction", async () => {
  for (const profileChanged of [
    { role: "Semi-Admin", accessStatus: "active" }, { role: "Admin", accessStatus: "active" },
    { role: "Semi-Admin", accessStatus: "suspended" }, { role: "Resident", accessStatus: "activating" },
  ]) {
    const app = fixture({ profile: { role: "Resident" }, profileChanged });
    await app.post(details, 409);
    assert.equal(app.records.has("staff_requests/applicant"), false);
    assert.equal(app.records.size, 1);
  }
});
