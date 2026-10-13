import test from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../src/lib/request-timeout.ts";

test("a stalled authentication request returns an actionable error", async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), "Check your internet connection and retry.", 5),
    { message: "Check your internet connection and retry." }
  );
});

test("successful requests and Firebase errors preserve their results", async () => {
  assert.deepEqual(await withTimeout(Promise.resolve({ role: "Admin" }), "Timed out", 100), { role: "Admin" });
  const networkError = new Error("Network unavailable");
  await assert.rejects(withTimeout(Promise.reject(networkError), "Timed out", 100), (error) => error === networkError);
});

test("a late profile response cannot turn a timed-out request into an approval", async () => {
  let finish;
  let approved = false;
  const request = withTimeout(new Promise((resolve) => { finish = resolve; }), "Timed out", 5)
    .then(() => { approved = true; });
  await assert.rejects(request, { message: "Timed out" });
  finish({ role: "Admin" });
  await Promise.resolve();
  assert.equal(approved, false);
});
