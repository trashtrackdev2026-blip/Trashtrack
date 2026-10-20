import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { StaffAccessError } from "../src/lib/staff-access.ts";
import { classificationText } from "../src/lib/waste-classification.ts";
const require = createRequire(import.meta.url), ts = require("typescript");
const compile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const accessCode = compile("../src/lib/ai-access.ts");
const routeCode = compile("../src/app/api/gemini/classify/route.ts");

function accessFixture({ signedOut = false, role = "Resident" } = {}) {
  let count = 15, transactions = 0, authentications = 0;
  const account = { identity: { uid: "resident" }, profile: { role }, db: {
    collection: () => ({ doc: () => ({}) }), runTransaction: async callback => {
      transactions++;
      return callback({ get: async () => ({ data: () => ({ bucket: Math.floor(Date.now() / 60_000), count }) }), set: (_, value) => { count = value.count; } });
    }
  } };
  const modules = { "server-only": {}, "firebase-admin/firestore": { Timestamp: { fromMillis: value => value } },
    "./staff-auth": { authenticatedAccount: async () => { authentications++; if (signedOut) throw new StaffAccessError("Sign in", 401); return account; } },
    "./staff-access": { StaffAccessError } };
  const api = {};
  new Function("require", "exports", accessCode)(name => modules[name] ?? require(name), api);
  return { api, counts: () => ({ count, transactions, authentications }) };
}

test("scanner accepts repeated authenticated requests even when the chat counter is already full", async () => {
  const app = accessFixture();
  for (let i = 0; i < 25; i++) await app.api.authenticatedScanner(new Request("https://example.org"));
  assert.deepEqual(app.counts(), { count: 15, transactions: 0, authentications: 25 });
  await assert.rejects(app.api.authenticatedAi(new Request("https://example.org")), error => error.status === 429);
});

test("scanning still requires a signed-in registered account", async () => {
  for (const options of [{ signedOut: true }, { role: "" }]) {
    const app = accessFixture(options);
    await assert.rejects(app.api.authenticatedScanner(new Request("https://example.org")));
    assert.equal(app.counts().transactions, 0);
  }
});

test("real classify handler uses quota-free scanner access and retains general-subject results", async () => {
  let authenticated = 0, generated = 0;
  const modules = { "next/server": { NextResponse: Response },
    "@/lib/ai-access": { authenticatedScanner: async () => { authenticated++; }, authenticatedAi: () => { throw Error("Wrong chat quota"); } },
    "@/lib/staff-auth": { staffApiError: error => Response.json({ error: error.message }, { status: error.status || 500 }) },
    "@/lib/waste-classification": { classificationText },
    "@google/genai": { Type: {}, GoogleGenAI: class { models = { generateContent: async config => {
      generated++;
      assert.ok(config.config.responseSchema.properties.type.enum.includes("Not Waste"));
      return { text: JSON.stringify({ item: "Growing tree", type: "Not Waste", confidence: 45, steps: ["A living plant"] }) };
    } }; } } };
  const route = {};
  new Function("require", "exports", routeCode)(name => modules[name] ?? require(name), route);
  const response = await route.POST(new Request("https://example.org/api/gemini/classify", { method: "POST", body: JSON.stringify({ imageBase64: "aGVsbG8=" }) }));
  assert.equal(response.status, 200);
  assert.match((await response.json()).text, /ITEM: Growing tree\nTYPE: Not Waste\nCONFIDENCE: 45%/);
  assert.equal(authenticated, 1); assert.equal(generated, 1);
});
