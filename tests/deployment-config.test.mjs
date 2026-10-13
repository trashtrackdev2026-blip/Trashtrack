import test from "node:test";
import assert from "node:assert/strict";
import { parseFirebaseAdminCredential } from "../src/lib/firebase-admin-credentials.ts";
import { checkDeploymentEnvironment, PUBLIC_DEPLOYMENT_VARIABLES } from "../src/lib/deployment-config.ts";

const account = {
  type: "service_account", project_id: "test-project", client_email: "deployment@test-project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nsynthetic-test-data\n-----END PRIVATE KEY-----\n",
};
const valid = {
  ...Object.fromEntries(PUBLIC_DEPLOYMENT_VARIABLES.map(key => [key, "configured-test-value"])),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: account.project_id, FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(account), GEMINI_API_KEY: "test-only",
  STAFF_SECURITY_RULESET: "12345678-1234-1234-1234-123456789abc", CERTIFICATE_SECURITY_RULESET: "12345678-1234-1234-1234-123456789abc", TRUST_TLS_PROXY: "true",
};
test("Vercel configuration accepts matching project and rulesets without a local credential path", () => {
  assert.deepEqual(checkDeploymentEnvironment(valid, true).errors, []);
  assert.match(checkDeploymentEnvironment({ ...valid, FIREBASE_SERVICE_ACCOUNT_JSON: undefined, GOOGLE_APPLICATION_CREDENTIALS: "C:/private/test.json" }, true).errors.join(" "), /cannot read a file/);
  assert.match(checkDeploymentEnvironment({ ...valid, GOOGLE_APPLICATION_CREDENTIALS: "C:/private/test.json" }, true).errors.join(" "), /Remove GOOGLE_APPLICATION_CREDENTIALS/);
  assert.match(checkDeploymentEnvironment({ ...valid, TRUST_TLS_PROXY: "false" }, true).errors.join(" "), /TRUST_TLS_PROXY/);
});
test("deployment fails before build for missing variables, mismatched projects/policies or public secrets", () => {
  for (const key of PUBLIC_DEPLOYMENT_VARIABLES) assert.ok(checkDeploymentEnvironment({ ...valid, [key]: "" }, true).errors.length);
  assert.match(checkDeploymentEnvironment({ ...valid, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "wrong-project" }, true).errors.join(" "), /must match/);
  assert.match(checkDeploymentEnvironment({ ...valid, CERTIFICATE_SECURITY_RULESET: "12345678-1234-1234-1234-123456789abd" }, true).errors.join(" "), /same active/);
  assert.match(checkDeploymentEnvironment({ ...valid, STAFF_SECURITY_RULESET: "invented" }, true).errors.join(" "), /ruleset UUID/);
  assert.match(checkDeploymentEnvironment({ ...valid, NEXT_PUBLIC_GEMINI_API_KEY: "should-never-appear" }, true).errors.join(" "), /must not use NEXT_PUBLIC_/);
});
test("credential parser accepts JSON newline variants and never exposes malformed credential contents", () => {
  assert.equal(parseFirebaseAdminCredential(JSON.stringify(account), account.project_id).privateKey, account.private_key);
  const escaped = { ...account, private_key: account.private_key.replaceAll("\n", "\\n") };
  assert.equal(parseFirebaseAdminCredential(JSON.stringify(escaped), account.project_id).privateKey, account.private_key);
  for (const raw of ["private-key-should-never-appear", "null", JSON.stringify({ private_key: "private-key-should-never-appear" })]) {
    assert.throws(() => parseFirebaseAdminCredential(raw, account.project_id), error => !error.message.includes("private-key-should-never-appear"));
  }
  assert.throws(() => parseFirebaseAdminCredential(JSON.stringify(account), "wrong-project"), /must match/);
});
