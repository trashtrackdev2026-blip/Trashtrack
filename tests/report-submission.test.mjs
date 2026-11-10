import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as access from "../src/lib/staff-access.ts";
import * as geofence from "../src/lib/barangay-geofence.ts";
import * as submission from "../src/lib/report-submission.ts";
import { manilaDateTime } from "../src/lib/scheduling-time.ts";
import { analyticsReportDate } from "../src/lib/analytics-data.ts";
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
  let now = Date.parse("2026-11-10T15:59:59Z");
  let pending = Promise.resolve();
  const db = {
    collection: name => ({
      doc: id => ({ path: `${name}/${id}`, id }),
      where: (field, op, value) => ({ select: (...fields) => ({ name, field, value, fields }) }),
    }),
    runTransaction(action) {
      const done = pending.then(async () => {
        const working = new Map(structuredClone([...records]));
        const result = await action({
          get: async ref => ref.fields ? {
            docs: [...working].filter(([key, data]) => key.startsWith(`${ref.name}/`) && data[ref.field] === ref.value)
              .map(([, data]) => ({ data: () => Object.fromEntries(ref.fields.map(field => [field, data[field]])) })),
          } : { exists: working.has(ref.path), data: () => structuredClone(working.get(ref.path)) },
          create: (ref, value) => { assert.equal(working.has(ref.path), false); working.set(ref.path, value); },
          set: (ref, value) => { working.set(ref.path, value); },
        });
        records.clear(); for (const [key, value] of working) records.set(key, value);
        return result;
      });
      pending = done.catch(() => {});
      return done;
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
    "@/lib/scheduling-time": { manilaDateTime: (time = now) => manilaDateTime(time) }, "@/lib/analytics-data": { analyticsReportDate },
  };
  const exported = {};
  new Function("require", "exports", code)(name => modules[name] || require(name), exported);
  return { records, setNow: time => { now = Date.parse(time); }, post: input => exported.POST(new Request("http://localhost/api/reports/submit", { method: "POST", body: JSON.stringify(input) })) };
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

test("the sixth report waits until Manila midnight while a saved submission can be retried", async () => {
  const app = fixture();
  const submission = index => ({ ...body, requestId: `${body.requestId.slice(0, -1)}${index}` });
  for (let index = 1; index <= 4; index++) assert.equal((await app.post(submission(index))).status, 200);
  const remaining = await Promise.all([app.post(submission(5)), app.post(submission(6))]);
  const rejected = remaining.findIndex(response => response.status === 429);
  assert.deepEqual(remaining.map(response => response.status).sort(), [200, 429]);
  assert.match((await remaining[rejected].json()).error, /limit of 5 reports/);
  assert.equal((await app.post(submission(1))).status, 200);
  assert.deepEqual(app.records.get("resident_report_quota/resident"), { day: "2026-11-10", count: 5 });
  app.setNow("2026-11-10T16:00:00Z");
  assert.equal((await app.post(submission(5 + rejected))).status, 200);
  assert.deepEqual(app.records.get("resident_report_quota/resident"), { day: "2026-11-11", count: 1 });
});

test("the first quota includes legacy reports submitted that day by the same resident", async () => {
  const app = fixture();
  app.records.set("reports/legacy", { userId: "resident", timestamp: Date.parse("2026-11-09T16:00:00Z") });
  app.records.set("reports/earlier", { userId: "resident", date: "2026-11-09 23:59" });
  app.records.set("reports/other", { userId: "another", date: "2026-11-10 08:00" });
  assert.equal((await app.post(body)).status, 200);
  assert.deepEqual(app.records.get("resident_report_quota/resident"), { day: "2026-11-10", count: 2 });
});
