import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// jwks-rsa 4.1.0 synchronously requires ESM-only jose 6. Vercel's function
// instrumentation rejects require(ESM), even on supported Node 24 versions.
// Keep the maintained JOSE version and change only its module-loading boundary.
const projectRequire = createRequire(import.meta.url);
const adminRequire = createRequire(projectRequire.resolve("firebase-admin/auth"));
const directory = dirname(dirname(adminRequire.resolve("jwks-rsa")));
const manifest = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
if (manifest.version !== "4.1.0") throw new Error("Review the JWKS runtime patch before changing jwks-rsa versions.");
const originalLoader = "const jose = require('jose');";
const dynamicLoader = "let josePromise;\nconst loadJose = () => (josePromise ??= import('jose'));";
const patches = [
  {
    path: "src/utils.js", hash: "c535773fd798202296e846e7c057f96f631148686194ff2990f0729fa4c1b7af",
    replacements: [
      [originalLoader, dynamicLoader],
      ["async function retrieveSigningKeys(jwks) {", "async function retrieveSigningKeys(jwks) {\n  const jose = await loadJose();"],
    ],
  },
  {
    path: "src/integrations/passport.js", hash: "03557fac70296dda6d19872b1702d2b8f1d4c50d22d3fbcf1fb65f9afa7ddcbb",
    replacements: [
      [originalLoader, dynamicLoader],
      ["return function secretProvider(req, rawJwtToken, cb) {", "return async function secretProvider(req, rawJwtToken, cb) {"],
      ["    try {\n      decoded = {", "    try {\n      const jose = await loadJose();\n      decoded = {"],
    ],
  },
];
// Re-running postinstall is safe. Validate every original file before writing
// anything, so an unexpected upstream change fails installation for review.
const changes = patches.map(({ path, hash, replacements }) => {
  const file = resolve(directory, path);
  const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
  const restored = replacements.reduce((value, [original, patched]) => value.replace(patched, original), source);
  if (createHash("sha256").update(restored).digest("hex") !== hash) {
    throw new Error(`Unexpected jwks-rsa source (${path}); the runtime patch was not applied.`);
  }
  const patched = replacements.reduce((value, [original, patch]) => value.replace(original, patch), restored);
  return { file, source, patched };
});
for (const { file, source, patched } of changes) {
  if (source !== patched) writeFileSync(file, patched, "utf8");
}
console.log("JWKS runtime compatibility patch applied: JOSE loads with dynamic import.");
