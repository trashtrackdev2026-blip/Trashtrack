import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { formatAccountJoinDate } from "../src/lib/account-join-date.ts";
import { StaffAccessError } from "../src/lib/staff-access.ts";

test("Joined dates support stored timestamps and Firebase Auth dates in Philippine time", () => {
  const creation = new Date("2026-11-14T18:30:00Z");
  for (const value of [{ toDate: () => creation }, creation.toUTCString(), creation.toISOString(),
    creation.getTime(), String(creation.getTime()), creation.getTime() / 1000, "2026-11-15 23:30"]) {
    assert.equal(formatAccountJoinDate(value), "Nov 15, 2026");
  }
  for (const value of [null, undefined, "", "Recently", "invalid", "2026", "12", NaN, 0, { toDate: () => new Date(NaN) }]) {
    assert.equal(formatAccountJoinDate(value), null);
  }
});

const route = ts.transpileModule(readFileSync(new URL("../src/app/api/staff/join-dates/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(role) {
  const calls = [];
  const createdAt = "Sat, 14 Nov 2026 18:30:00 GMT";
  const modules = {
    "@/lib/staff-access": { StaffAccessError },
    "@/lib/staff-auth": {
      authenticatedStaff: async (_request, masterOnly) => {
        assert.equal(masterOnly, true);
        if (!role) throw new StaffAccessError("Sign in.", 401);
        if (role !== "Admin") throw new StaffAccessError("MENRO Admin required.", 403);
        return { app: {} };
      },
      requireStaffSecurity: async () => {},
      staffApiError: error => Response.json({ error: error.message }, { status: error.status || 500 }),
    },
    "firebase-admin/auth": { getAuth: () => ({
      getUsers: async ids => {
        calls.push(ids);
        return { users: [{ uid: "known", email: "fixture@example.invalid", metadata: { creationTime: createdAt } }] };
      },
    }) },
  };
  const result = {};
  new Function("require", "exports", route)(name => modules[name], result);
  return { calls, createdAt, post: ids => result.POST(new Request("https://example.invalid", {
    method: "POST", body: JSON.stringify({ ids }),
  })) };
}

test("MENRO can look up creation dates in a bounded batch without exposing account details", async () => {
  const admin = fixture("Admin");
  const success = await admin.post(["known", "missing", "known"]);
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await success.json(), { dates: [{ id: "known", createdAt: admin.createdAt }] });
  assert.deepEqual(admin.calls, [[{ uid: "known" }, { uid: "missing" }]]);
  for (const ids of [[], [" "], [42], Array.from({ length: 101 }, (_, i) => String(i))]) {
    assert.equal((await admin.post(ids)).status, 400);
  }
  assert.equal(admin.calls.length, 1);
  for (const [role, status] of [[null, 401], ["Resident", 403], ["Semi-Admin", 403]]) {
    const denied = fixture(role);
    assert.equal((await denied.post(["known"])).status, status);
    assert.deepEqual(denied.calls, []);
  }
});
