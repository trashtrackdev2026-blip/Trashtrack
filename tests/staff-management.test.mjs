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
    ["staff_requests/official", { status: "pending", name: "Test Official", contact: "09000000000", position: "Barangay staff", barangay: "Sala", ...options.request }],
  ]);
  if (options.noRequest) records.delete("staff_requests/official");
  if (options.noProfile) records.delete("users/official");
  for (const [path, data] of options.extraRecords || []) records.set(path, data);
  const account = { uid: "official", email: "official@example.invalid", emailVerified: true, disabled: false, customClaims: { retained: true }, ...options.account };
  const identity = { uid: "menro", staffRole: "admin", email_verified: true, auth_time: now, ...options.identity };
  let sequence = 0;
  const ref = path => ({ path, get: async () => snapshot(records, { path }) });
  const query = target => ({ ...target, get: async () => snapshot(records, target), limit: () => query(target) });
  const collection = name => ({
    doc: id => ref(name + "/" + (id || "audit-" + ++sequence)),
    get: async () => snapshot(records, { collection: name }),
    where: (field, operator, value) => query({ collection: name, field, operator, value }),
    orderBy: () => query({ collection: name }),
  });
  function snapshot(data, target) {
    if (target.path) return { data: () => data.has(target.path) ? structuredClone(data.get(target.path)) : undefined };
    return { docs: [...data].filter(([key, value]) => key.startsWith(target.collection + "/") &&
      (!target.field || (target.operator === "in" ? target.value.includes(value[target.field]) : value[target.field] === target.value)))
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
  const batches = [];
  const auth = {
    getUser: async () => structuredClone(account),
    getUserByEmail: async email => {
      if (email.toLowerCase() === account.email.toLowerCase()) return structuredClone(account);
      throw Object.assign(new Error("Not found"), { code: "auth/user-not-found" });
    },
    getUsers: async identifiers => {
      assert.ok(identifiers.length <= 100, "Auth batch lookup supports at most 100 accounts");
      batches.push(identifiers.map(item => item.uid));
      return { users: identifiers.filter(item => !(options.accountMissing && item.uid === "official")).map(item => item.uid === "official" ? structuredClone(account) : { uid: item.uid, emailVerified: true, disabled: false }) };
    },
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
      assert.equal(recent, request.method === "POST" ? true : undefined, "Access mutations must require recent sign-in");
      if (options.signedOut) throw new policy.StaffAccessError("Sign in", 401);
      const profile = records.get("users/" + identity.uid) || {};
      if (policy.staffAccessProblem(profile, identity) || policy.staffRole(profile.role) !== "admin") throw new policy.StaffAccessError("Only MENRO");
      if (recent && now - identity.auth_time > 300) throw new policy.StaffAccessError("Sign in again", 401);
      return { app: {}, db, identity };
    },
    requireStaffSecurity: async () => {},
    staffApiError: error => Response.json({ error: error.message }, { status: error instanceof policy.StaffAccessError ? error.status : 500 }),
  };
  const modules = { "firebase-admin/auth": { getAuth: () => auth }, "firebase-admin/firestore": { FieldValue: { serverTimestamp: () => "timestamp", delete: () => deleted } },
    "@/lib/staff-auth": staffAuth, "@/lib/staff-access": policy };
  const exported = {};
  new Function("require", "exports", compiled)(name => modules[name] || require(name), exported);
  return { records, account, revoked, batches, now, async get(email, status = 200) {
    const response = await exported.GET(new Request("http://127.0.0.1:3000/api/staff/manage" + (email === undefined ? "" : "?email=" + encodeURIComponent(email))));
    const result = await response.json();
    assert.equal(response.status, status, result.error || "Expected response");
    assert.equal(response.headers.get("Cache-Control"), status === 200 ? "private, no-store" : null);
    return result;
  }, async post(body, status = 200) {
    const response = await exported.POST(new Request("http://127.0.0.1:3000/api/staff/manage", { method: "POST", body: JSON.stringify({ userId: "official", ...body }) }));
    const result = await response.json();
    assert.equal(response.status, status, result.error || "Expected response");
    return result;
  } };
}

test("MENRO cannot promote a barangay account to Admin", async () => {
  for (const action of ["approve", "assign"]) {
    const app = fixture({ profile:{role:"Semi-Admin",accessStatus:"active"} });
    await app.post({action,role:"Admin",identityConfirmed:true},400);
    assert.equal(app.records.get("users/official").role,"Semi-Admin");
    assert.equal(app.account.customClaims.staffRole,undefined);
  }
});

test("Barangay access editor cannot demote an existing MENRO Admin", async () => {
  const app=fixture({profile:{role:"Admin",accessStatus:"active"}});
  await app.post({action:"assign",role:"Semi-Admin",barangay:"Sala",identityConfirmed:true},403);
  assert.equal(app.records.get("users/official").role,"Admin");assert.equal(app.revoked.length,0);
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
    await app.post({ action: "approve", role: "Semi-Admin", barangay: "Sala", identityConfirmed: true }, status);
    assert.equal(app.records.get("users/official").role, "Resident"); assert.equal(app.revoked.length, 0);
  }
  const app = fixture();
  await app.post({ action: "assign", userId: "menro", role: "Semi-Admin", barangay: "Sala", identityConfirmed: true }, 409);
  assert.equal(app.records.get("users/menro").role, "Admin");
});
test("Unverified officials, invalid roles and unconfirmed assignments cannot activate", async () => {
  const unverified = fixture({ account: { emailVerified: false } });
  await unverified.post({ action: "approve", role: "Semi-Admin", barangay: "Sala", identityConfirmed: true }, 409);
  for (const body of [{ role: "Resident", identityConfirmed: true }, { role: "Admin", identityConfirmed: false }, { role: "Semi-Admin", barangay: "Poblacion 2", identityConfirmed: true }]) {
    const app = fixture(); await app.post({ action: "approve", ...body }, 400);
    assert.equal(app.records.get("staff_requests/official").status, "pending"); assert.equal(app.account.customClaims.staffRole, undefined);
  }
});
test("Changing active staff access updates scope and preserves required MFA", async () => {
  const app = fixture({ profile: { role: "Semi-Admin", accessStatus: "active", barangay: "Sala", mfaRequired: true } });
  await app.post({ action: "assign", role: "Semi-Admin", barangay: "Solis", identityConfirmed: true });
  const profile = app.records.get("users/official");
  assert.equal(profile.role, "Semi-Admin"); assert.equal(profile.barangay, "Solis"); assert.equal(profile.mfaRequired, true);
  assert.equal(app.account.customClaims.staffRole, "semi-admin"); assert.equal(app.account.customClaims.staffBarangay, "Solis");
  assert.ok(profile.staffValidAfter >= app.now); assert.equal(app.revoked.length, 1);
  assert.equal(app.records.get("staff_requests/official").status, "pending", "Role edits do not approve unrelated requests");
});
test("Pending and suspended accounts cannot bypass approval or reactivation through role edits", async () => {
  for (const accessStatus of ["needs-review", "suspended", "activating"]) {
    const app = fixture({ profile: { role: "Semi-Admin", accessStatus } });
    await app.post({ action: "assign", role: "Semi-Admin", barangay: "Sala", identityConfirmed: true }, 409);
    assert.equal(app.records.get("users/official").accessStatus, accessStatus);
  }
});
test("Cross-service failures and revoked MENRO access keep activation blocked", async () => {
  for (const [options, status] of [[{ authFailure: true }, 500], [{ actorChanged: true }, 409]]) {
    const app = fixture(options);
    await app.post({ action: "approve", role: "Semi-Admin", barangay: "Sala", identityConfirmed: true }, status);
    assert.equal(app.records.get("users/official").accessStatus, "activating");
    assert.equal(app.records.get("staff_requests/official").status, "pending");
  }
});

test("Pending requests across barangays use current Auth verification without another applicant sign-in", async () => {
  const app = fixture({ account: { emailVerified: false }, extraRecords: policy.STAFF_BARANGAYS.map((barangay, index) => [
    "staff_requests/official-" + index, { name: barangay + " official", barangay, status: "pending" },
  ]) });
  let list = await app.get();
  assert.equal(list.requests.length, 14);
  assert.equal(list.requests.find(item => item.id === "official").emailVerified, false);
  assert.deepEqual(list.requests.filter(item => item.id !== "official").map(item => item.barangay), [...policy.STAFF_BARANGAYS]);
  app.account.emailVerified = true;
  app.account.email = "verified-address@example.invalid";
  list = await app.get();
  const official = list.requests.find(item => item.id === "official");
  assert.equal(official.emailVerified, true); assert.equal(official.email, app.account.email);
  assert.equal(official.accountUnavailable, false);
});

test("Deleted or disabled Auth accounts remain visible but unavailable for review", async () => {
  for (const options of [{ accountMissing: true }, { account: { disabled: true } }]) {
    const app = fixture(options);
    const list = await app.get();
    assert.equal(list.requests.length, 1);
    assert.equal(list.requests[0].accountUnavailable, true);
  }
});

test("Large pending lists stay within Firebase Auth's batch limit", async () => {
  const app = fixture({ extraRecords: Array.from({ length: 200 }, (_, index) => ["staff_requests/extra-" + index, { status: "pending" }]) });
  const list = await app.get();
  assert.equal(list.requests.length, 201); assert.deepEqual(app.batches.map(batch => batch.length), [100, 100, 1]);
});

test("MENRO can find a verified registration with no request without listing unrelated residents", async () => {
  const app = fixture({ noRequest: true, profile: { name: "Existing Official", contact: "09000000000" } });
  assert.equal((await app.get()).requests.length, 0);
  const found = (await app.get("official@example.invalid")).account;
  assert.equal(found.emailVerified, true); assert.equal(found.requestStatus, null);
  assert.equal(found.name, "Existing Official"); assert.equal(found.barangay, "Sala");
  await app.get("missing@example.invalid", 404);
  for (const options of [{ signedOut: true }, { identity: { staffRole: "semi-admin" } }]) {
    await fixture(options).get("official@example.invalid", options.signedOut ? 401 : 403);
  }
});

test("Recovering a staff registration queues approval without granting permissions", async () => {
  const app = fixture({ noRequest: true, profile: { role:"Semi-Admin", accessStatus:"needs-review", points: 57 } });
  await app.post({ action: "recover", name: "Existing Official", position: "Barangay secretary", contact: "09000000000", barangay: "Solis", role: "Admin" });
  const pending = app.records.get("staff_requests/official");
  assert.equal(pending.status, "pending"); assert.equal(pending.barangay, "Solis");
  assert.equal(app.records.get("users/official").role, "Semi-Admin");
  assert.equal(app.records.get("users/official").points, 57);
  assert.equal(app.account.customClaims.staffRole, undefined); assert.equal(app.revoked.length, 0);
  assert.ok([...app.records.values()].some(item => item.action === "staff.request.recovered" && item.actor === "menro"));
  await app.post({ action: "approve", barangay: "Solis", identityConfirmed: true });
  assert.equal(app.account.customClaims.staffRole, "semi-admin"); assert.equal(app.account.customClaims.staffBarangay, "Solis");
});

test("Recovery cannot bypass pending requests, verification, suspension or active access", async () => {
  const details = { action: "recover", name: "Official", position: "Barangay secretary", contact: "09000000000", barangay: "Solis" };
  for (const options of [{}, { noRequest: true, account: { emailVerified: false } }, { noRequest: true, account: { disabled: true } },
    { noRequest: true, profile: { accessStatus: "suspended" } }, { noRequest: true, profile: { role: "Semi-Admin", accessStatus: "active" } }]) {
    const app = fixture(options);
    await app.post(details, 409);
    assert.equal(app.account.customClaims.staffRole, undefined);
  }
});

test("An incomplete recovered request requires official details before approval", async () => {
  const app = fixture({ request: { position: "", needsOfficialDetails: true } });
  await app.post({ action: "approve", barangay: "Sala", identityConfirmed: true }, 400);
  assert.equal(app.records.get("users/official").role, "Resident");
  await app.post({ action: "approve", position: "Barangay secretary", barangay: "Sala", identityConfirmed: true });
  assert.equal(app.records.get("users/official").position, "Barangay secretary");
  assert.equal(app.records.get("staff_requests/official").needsOfficialDetails, false);
});

test("Resident email cannot be recovered into staff access", async () => {
  const app=fixture({noRequest:true});
  await app.post({action:"recover",name:"Official",position:"Secretary",contact:"09000000000",barangay:"Sala"},409);
  assert.equal(app.records.get("users/official").role,"Resident");assert.equal(app.records.has("staff_requests/official"),false);
});
