import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { parsePhotoChecks } from "../src/lib/report-photo-review.ts";
import { StaffAccessError } from "../src/lib/staff-access.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync(new URL("../src/lib/report-photo-review.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(t, checks, options = {}) {
  const answer = { checks, ...options };
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only";
  const fetched = [];
  globalThis.fetch = async (url, settings) => {
    fetched.push(String(url));
    assert.equal(settings.redirect, "error");
    if (answer.photoUnavailable) return new Response(null, { status: 503 });
    return new Response(new Uint8Array([255, 216, 255]), { headers: { "Content-Type": "image/jpeg" } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  });
  const modules = {
    "@google/genai": { Type: {}, GoogleGenAI: class {
      models = { generateContent: async request => {
        assert.equal(request.config.httpOptions.retryOptions.attempts, 2);
        if (answer.unavailable) throw new Error("Provider unavailable");
        return { text: JSON.stringify({ checks: answer.checks }) };
      } };
    } },
    "./staff-access.ts": { StaffAccessError },
  };
  const exports = {};
  new Function("require", "exports", compiled)(name => modules[name] || require(name), exports);
  return { review: exports.reviewReportPhotos, fetched, answer };
}

const photo = { url: "https://res.cloudinary.com/test/image/upload/v1/waste.jpg", type: "image" };
const report = { type: "Missed Collection", description: "Collection did not arrive", attachments: [photo] };

test("related evidence is accepted while an unrelated or inappropriate attachment asks for replacement", async t => {
  const app = fixture(t, [{ attachment: 1, outcome: "accepted", reason: "relevant" }]);
  assert.equal((await app.review(report)).status, "accepted");
  assert.match(app.fetched[0], /c_limit,w_960,h_960\/f_jpg\/q_75/);
  for (const reason of ["unrelated", "inappropriate"]) {
    app.answer.checks = [{ attachment: 1, outcome: "replace", reason }];
    await assert.rejects(() => app.review(report), error => error.status === 422 && /attachment 1/.test(error.message));
  }
});

test("uncertain checked photos and videos remain available for staff review", async t => {
  const app = fixture(t, [{ attachment: 1, outcome: "review", reason: "unclear" }]);
  assert.equal((await app.review(report)).status, "review");
  assert.equal((await app.review({ ...report, attachments: [{ ...photo, type: "video" }] })).status, "review");
});

test("unchecked photos require a retry if the provider, upload, or configuration is unavailable", async t => {
  const app = fixture(t, []);
  const unavailable = { status: 503, code: "report/photo-check-unavailable" };
  app.answer.unavailable = true;
  await assert.rejects(() => app.review(report), unavailable);
  app.answer.unavailable = false;
  await assert.rejects(() => app.review(report), unavailable);
  app.answer.photoUnavailable = true;
  await assert.rejects(() => app.review(report), unavailable);
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(() => app.review(report), unavailable);
  assert.equal((await app.review({ ...report, attachments: [{ ...photo, type: "video" }] })).status, "review");
});

test("invalid model indexes or incomplete answers cannot accidentally accept an unchecked photo", () => {
  for (const checks of [[], [{ attachment: 2, outcome: "accepted", reason: "relevant" }], [{ attachment: 1, outcome: "replace", reason: "unclear" }]]) {
    assert.throws(() => parsePhotoChecks(JSON.stringify({ checks }), [1]));
  }
  assert.throws(() => parsePhotoChecks(JSON.stringify({ checks: [
    { attachment: 1, outcome: "accepted", reason: "relevant" }, { attachment: 1, outcome: "accepted", reason: "relevant" },
  ] }), [1, 2]));
});
