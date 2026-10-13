import test from "node:test";
import assert from "node:assert/strict";
import { readApiResponse } from "../src/lib/api-response.ts";
import { signInError } from "../src/lib/sign-in-errors.ts";

test("empty Vercel failures become safe actionable errors with an HTTP reference", async () => {
  for (const status of [500, 502, 504]) {
    await assert.rejects(readApiResponse(new Response(null, { status })), error => {
      assert.equal(error.code, `api/empty-response-${status}`);
      assert.doesNotMatch(error.message, /JSON|SyntaxError/);
      const detail = signInError(error);
      assert.equal(detail.reference, error.code);
      assert.equal(detail.message, error.message);
      return true;
    });
  }
});
test("HTML proxy/protection errors never expose raw response content", async () => {
  for (const status of [200, 403, 500]) {
    await assert.rejects(readApiResponse(new Response("<html>private-diagnostic-token</html>", { status })), error => {
      assert.equal(error.code, `api/invalid-response-${status}`);
      assert.doesNotMatch(error.message, /private-diagnostic-token|<html>/);
      return true;
    });
  }
});
test("valid structured success and safe server denial messages are preserved", async () => {
  const success = { profile: { role: "Semi-Admin" }, problem: null };
  assert.deepEqual(await readApiResponse(Response.json(success)), success);
  await assert.rejects(readApiResponse(Response.json({ error: "This account needs MENRO approval." }, { status: 403 })), /needs MENRO approval/);
  for (const body of ["null", "[]", "true", "17", "{\"incomplete\":"]) {
    await assert.rejects(readApiResponse(new Response(body)), /response|completed/);
  }
});
