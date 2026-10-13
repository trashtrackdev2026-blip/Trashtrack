// Run the actual route against an in-memory transaction. No Firebase writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as policy from "../src/lib/staff-access.ts";
import * as workflow from "../src/lib/report-workflow.ts";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync(new URL("../src/app/api/reports/manage/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const profile = { role: "Semi-Admin", barangay: "Poblacion", name: "Test Official", accessStatus: "active", mfaRequired: false, ...options.profile };
  const identity = { uid: "official", email_verified: true, auth_time: now, staffRole: policy.staffRole(profile.role), staffBarangay: profile.barangay, ...options.identity };
  const records = new Map([
    ["users/official", { ...profile, ...options.currentProfile }],
    ["reports/one", { status: "UnderReview", location: "Poblacion", ...options.report }],
  ]);
  let sequence = 0;
  const db = {
    collection: name => ({ doc: id => ({ path: `${name}/${id || "audit-" + ++sequence}` }) }),
    async runTransaction(action) {
      const working = new Map(structuredClone([...records]));
      await action({ get: async ref => ({ data: () => structuredClone(working.get(ref.path)) }),
        update: (ref, values) => working.set(ref.path, { ...working.get(ref.path), ...values }),
        create: (ref, values) => working.set(ref.path, values) });
      records.clear(); for (const [key, value] of working) records.set(key, value);
    },
  };
  const modules = {
    "firebase-admin/firestore": { FieldValue: { serverTimestamp: () => "server timestamp" } },
    "@/lib/staff-auth": {
      authenticatedStaff: async () => {
        if (options.signedOut) throw new policy.StaffAccessError("Sign in", 401);
        const problem = policy.staffAccessProblem(profile, identity);
        if (problem) throw new policy.StaffAccessError(problem);
        return { db, identity, profile };
      },
      requireStaffSecurity: async () => { if (options.inactiveRules) throw new policy.StaffAccessError("Setup inactive", 503); },
      staffApiError: error => Response.json({ error: error.message }, { status: error instanceof policy.StaffAccessError ? error.status : 500 }),
    },
    "@/lib/staff-access": policy,
    "@/lib/report-workflow": workflow,
  };
  const exported = {};
  new Function("require", "exports", compiled)(name => modules[name] || require(name), exported);
  return { records, async post(body, expected = 200) {
    const response = await exported.POST(new Request("http://127.0.0.1:3000/api/reports/manage", { method: "POST", body: JSON.stringify({ reportId: "one", status: "For MENRO Review", remarks: " Verified Riverside location. ", ...body }) }));
    const result = await response.json();
    assert.equal(response.status, expected, result.error || "Expected response");
    return result;
  } };
}

test("Sending to MENRO records the authenticated official and status audit atomically", async () => {
  const app = fixture();
  await app.post({ forwardedByName: "Forged name", updatedBy: "someone-else" });
  const report = app.records.get("reports/one");
  assert.equal(report.status, "For MENRO Review");
  assert.equal(report.forwardedBy, "official"); assert.equal(report.forwardedByName, "Test Official");
  assert.equal(report.verifiedBy, "official"); assert.equal(report.forwardedAt, "server timestamp");
  assert.equal(report.remarks, "Verified Riverside location.");
  assert.ok([...app.records.values()].some(record => record.action === "report.status" && record.from === "UnderReview" && record.to === "For MENRO Review"));
  const snapshot = structuredClone([...app.records]);
  await app.post({}, 403);
  assert.deepEqual([...app.records], snapshot, "A repeated send must not duplicate or overwrite submission");
});

test("Wrong barangay, unverified reports, suspended staff and client role injection cannot forward", async () => {
  for (const options of [{ report: { location: "Sala" } }, { report: { status: "Pending" } }, { currentProfile: { accessStatus: "suspended" } }, { profile: { accessStatus: "suspended" } }, { identity: { staffBarangay: "Sala" } }, { profile: { role: "Resident" } }]) {
    const app = fixture(options);
    const snapshot = structuredClone([...app.records]);
    await app.post({ role: "Admin", barangay: "Sala" }, 403);
    assert.deepEqual([...app.records], snapshot);
  }
  await fixture({ signedOut: true }).post({}, 401);
  await fixture({ inactiveRules: true }).post({}, 503);
});

test("Only MENRO can start review, schedule collection and confirm resolution", async () => {
  const app = fixture({ profile: { role: "Admin", barangay: "" }, report: { status: "For MENRO Review" } });
  await app.post({ status: "MENRO Under Review" });
  assert.equal(app.records.get("reports/one").status, "For MENRO Review", "Existing resident apps retain a known status");
  assert.equal(app.records.get("reports/one").menroReviewedAt, "server timestamp");
  await app.post({ status: "MENRO Under Review" }, 403);
  await app.post({ status: "Endorsed" });
  await app.post({ status: "Resolved", collectionConfirmed: false }, 403);
  await app.post({ status: "Resolved", collectionConfirmed: true });
  assert.equal(app.records.get("reports/one").collectedBy, "official");
  await fixture({ report: { status: "For MENRO Review" } }).post({ status: "MENRO Under Review" }, 403);
});
