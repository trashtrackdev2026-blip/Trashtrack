import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import * as periods from "../src/lib/analytics-period.ts";
import * as analytics from "../src/lib/analytics-data.ts";
import * as staff from "../src/lib/staff-access.ts";
import * as time from "../src/lib/scheduling-time.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(new URL("../src/app/api/analytics/insights/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test("MENRO analytics sends only scoped counts to Gemini", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "fixture";
  const records = [
    { date: "2025-01-02 08:00", type: "Other", status: "Pending", subject: "private subject", location: "private pin" },
    { date: "2025-03-02 08:00", type: "Illegal Dumping", status: "Resolved", description: "private description", imageUrl: "private URL" },
    { date: "2026-03-02 08:00", type: "Missed Collection", status: "Pending" },
  ];
  const db = { collection(name) {
    assert.equal(name, "reports");
    return { select(...fields) {
      assert.deepEqual(fields, ["type", "category", "status", "date", "createdAt", "timestamp"]);
      return { get: async () => ({ docs: records.map(record => ({ data: () => record })) }) };
    } };
  } };
  const calls = [];
  const modules = {
    "@/lib/staff-auth": {
      authenticatedStaff: async (_request, masterOnly) => {
        assert.equal(masterOnly, true);
        return { db };
      },
      requireStaffSecurity: async () => {},
      staffApiError: error => Response.json({ error: error.message }, { status: error.status || 500 }),
    },
    "@/lib/ai-access": { limitAiRequests: async (_account, scope) => assert.equal(scope, "analytics") },
    "@/lib/staff-access": staff,
    "@/lib/analytics-period": periods,
    "@/lib/analytics-data": analytics,
    "@/lib/scheduling-time": time,
    "@google/genai": { GoogleGenAI: class {
      models = { generateContent: async request => {
        calls.push(request.contents);
        return { text: "Two concerns were reported in the selected year." };
      } };
    } },
  };

  try {
    const route = {};
    new Function("require", "exports", compiled)(name => modules[name] || require(name), route);
    const post = period => route.POST(new Request("https://test.invalid/api/analytics/insights", {
      method: "POST", body: JSON.stringify({ period }),
    }));
    assert.equal((await post("2025-13")).status, 400);
    const response = await post("2025");
    assert.equal(response.status, 200);
    const { text, evidence } = await response.json();
    assert.equal(text, "Two concerns were reported in the selected year.");
    assert.equal(calls.length, 1);
    assert.doesNotMatch(calls[0], /private|subject|location|description|imageUrl/);
    const context = JSON.parse(calls[0]);
    assert.equal(context.totalReports, 2);
    assert.equal(context.resolvedReports, 1);
    assert.equal(context.months.length, 12);
    assert.deepEqual(context.months.map(month => month.reports), [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(context.categories.find(category => category.name === "Missed Collection").reports, 0);
    assert.equal(evidence.totalReports, context.totalReports);
    assert.deepEqual(evidence.categories.map(({ name, value }) => ({ name, reports: value })), context.categories);
    assert.deepEqual(evidence.months.map(({ name, value }) => ({ name, reports: value })),
      context.months.map(({ name, reports }) => ({ name, reports })));
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
