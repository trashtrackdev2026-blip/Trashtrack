import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function commonJsRuntime(source) {
  // Vercel's instrumented loader cannot rely on Node's synchronous require(ESM).
  const result = spawnSync(process.execPath, ["--no-experimental-require-module", "-e", source], {
    cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 15000, windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
}

test("Firebase Admin server modules load without synchronous require(ESM)", () => {
  commonJsRuntime(`
    for (const module of ["app", "auth", "firestore", "messaging", "security-rules"]) {
      require("firebase-admin/" + module);
    }
  `);
});

test("the dynamic JOSE loader retrieves real signing keys and preserves signature validation", () => {
  commonJsRuntime(`
    const assert = require("node:assert/strict");
    const { createRequire } = require("node:module");
    const { generateKeyPairSync, sign, verify } = require("node:crypto");
    const adminRequire = createRequire(require.resolve("firebase-admin/auth"));
    const jwksClient = adminRequire("jwks-rsa");
    (async () => {
      const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
      const jwk = { ...publicKey.export({ format: "jwk" }), kid: "runtime-fixture", alg: "RS256", use: "sig" };
      const client = jwksClient({
        jwksUri: "https://fixture.invalid/jwks", cache: false,
        fetcher: async () => ({ keys: [jwk] }),
      });
      const key = await client.getSigningKey(jwk.kid);
      const pem = key.getPublicKey();
      assert.equal(pem.trim(), publicKey.export({ type: "spki", format: "pem" }).trim());
      const original = Buffer.from("runtime signature fixture");
      const signature = sign("RSA-SHA256", original, privateKey);
      assert.equal(verify("RSA-SHA256", original, pem, signature), true);
      assert.equal(verify("RSA-SHA256", Buffer.from("forged fixture"), pem, signature), false);
      await assert.rejects(client.getSigningKey("unknown-key"), { name: "SigningKeyNotFoundError" });
      // The package eagerly exports Passport too; verify its callback contract.
      const secretProvider = jwksClient.passportJwtSecret({
        jwksUri: "https://fixture.invalid/jwks", cache: false,
        fetcher: async () => ({ keys: [jwk] }),
      });
      const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ sub: "fixture" })).toString("base64url");
      const unsigned = header + "." + payload;
      const token = unsigned + "." + sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");
      const callbackKey = raw => new Promise((resolve, reject) => secretProvider({}, raw, (error, key) => error ? reject(error) : resolve(key)));
      assert.equal(await callbackKey(token), pem);
      assert.equal(await callbackKey("invalid-token"), null);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
});
