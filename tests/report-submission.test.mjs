import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as access from "../src/lib/staff-access.ts";
import * as geofence from "../src/lib/barangay-geofence.ts";
import * as submission from "../src/lib/report-submission.ts";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(new URL("../src/app/api/reports/submit/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const data = JSON.parse(fs.readFileSync(new URL("../public/geojson/balete_barangays.json", import.meta.url)));
const [longitude, latitude] = data.features.find(item => item.properties.name === "Sala").properties.labelPoint;
const body = { requestId: "1ed8f083-0b44-4c26-bfd7-d53f6cbec171", type: "Other", description: "Uncollected waste", latitude, longitude, attachments: [] };

function fixture(options = {}) {
  const records = new Map([["users/resident", { role: "Resident", barangay: "Sala", name: "Verified resident", ...options.currentProfile }]]);
  const db = {
    collection: name => ({ doc: id => ({ path: `${name}/${id}` }) }),
    async runTransaction(action) {
      const working = new Map(structuredClone([...records]));
      const result = await action({
        get: async ref => ({ exists: working.has(ref.path), data: () => structuredClone(working.get(ref.path)) }),
        create: (ref, value) => { assert.equal(working.has(ref.path), false); working.set(ref.path, value); },
      });
      records.clear(); for (const [key, value] of working) records.set(key, value);
      return result;
    },
  };
  const modules = {
    "firebase-admin/firestore": { FieldValue: { serverTimestamp: () => "server timestamp" } },
    "@/lib/staff-auth": {
      authenticatedAccount: async () => {
        if (options.signedOut) throw new access.StaffAccessError("Sign in", 401);
        return { db, identity: { uid: "resident" }, profile: { role: "Resident", barangay: "Sala" } };
      },
      staffApiError: error => Response.json({ error: error.message }, { status: error instanceof access.StaffAccessError ? error.status : 500 }),
    },
    "@/lib/staff-access": access, "@/lib/barangay-geofence": geofence, "@/lib/report-submission": submission,
  };
  const exported = {};
  new Function("require", "exports", code)(name => modules[name] || require(name), exported);
  return { records, post: input => exported.POST(new Request("http://localhost/api/reports/submit", { method: "POST", body: JSON.stringify(input) })) };
}

test("report save retries commit exactly once and use the authenticated reporter", async () => {
  const app = fixture();
  const first = await app.post({ ...body, userId: "forged", reporterName: "Forged" });
  assert.equal(first.status, 200);
  const second = await app.post(body);
  assert.deepEqual(await first.json(), await second.json());
  const reports = [...app.records].filter(([key]) => key.startsWith("reports/"));
  assert.equal(reports.length, 1);
  assert.equal(reports[0][1].userId, "resident");
  assert.equal(reports[0][1].reporterName, "Verified resident");
});

test("report submission rereads the profile in the transaction and rejects changed or suspended accounts", async () => {
  for (const currentProfile of [{ barangay: "Malabanan" }, { accessStatus: "suspended" }, { role: "Semi-Admin" }]) {
    const app = fixture({ currentProfile });
    const response = await app.post(body);
    assert.ok([400, 403].includes(response.status));
    assert.equal([...app.records.keys()].filter(key => key.startsWith("reports/")).length, 0);
  }
});

test("signed-out requests and malformed submissions never create reports", async () => {
  assert.equal((await fixture({ signedOut: true }).post(body)).status, 401);
  for (const input of [null, { ...body, requestId: "../../other" }, { ...body, latitude: null }]) {
    const app = fixture();
    assert.equal((await app.post(input)).status, 400);
    assert.equal(app.records.size, 1);
  }
});
