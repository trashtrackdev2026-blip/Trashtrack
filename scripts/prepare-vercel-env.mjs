import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkDeploymentEnvironment, PUBLIC_DEPLOYMENT_VARIABLES, PRIVATE_DEPLOYMENT_VARIABLES } from "../src/lib/deployment-config.ts";
import { loadDeploymentEnvironment, readDeploymentCredential } from "./deployment-env.mjs";

try {
  const local = loadDeploymentEnvironment();
  const { raw } = readDeploymentCredential(local);
  const env = Object.fromEntries([...PUBLIC_DEPLOYMENT_VARIABLES, ...PRIVATE_DEPLOYMENT_VARIABLES].map(name => [name, local[name]]));
  env.FIREBASE_SERVICE_ACCOUNT_JSON = raw;
  env.TRUST_TLS_PROXY = "true";
  const { errors } = checkDeploymentEnvironment(env, true);
  if (errors.length) throw new Error(errors.join("\n"));
  const folder = resolve("deployment-private");
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  // dotenv/Vercel import uses literal single quotes; credential JSON contains escaped \n.
  const quote = value => {
    if (value.includes("'") || /[\r\n]/.test(value)) throw new Error("A deployment value cannot be exported safely; configure that variable directly in Vercel.");
    return `'${value}'`;
  };
  const contents = [...PUBLIC_DEPLOYMENT_VARIABLES, ...PRIVATE_DEPLOYMENT_VARIABLES]
    .map(name => `${name}=${quote(env[name])}`).join("\n") + "\n";
  writeFileSync(resolve(folder, "vercel-production.env"), contents, { mode: 0o600 });
  writeFileSync(resolve(folder, "README.txt"), "Private deployment variables for Vercel's Import .env option. Contains a service-account private key and AI key. Never commit, attach, publish or place in public/. Excluded by .gitignore and .vercelignore. Delete this folder after configuring Vercel.\n", { mode: 0o600 });
  console.log("Prepared deployment-private/vercel-production.env for Vercel's environment-variable import. Values were not printed; no deployment was created.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
