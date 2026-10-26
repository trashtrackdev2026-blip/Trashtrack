import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";

const base = resolve(".next/server/app");
const required = ["appreciation-v1.png", "GreatVibes-Regular.ttf", "GreatVibes-OFL.txt"].map(name => resolve("assets/certificates", name));
const errors = [];
for (const route of ["api/certificates", "api/certificates/preview"]) {
  const file = resolve(base, route, "route.js.nft.json");
  try {
    const trace = JSON.parse(readFileSync(file, "utf8"));
    const bundled = new Set(trace.files.map(path => resolve(dirname(file), path)));
    for (const asset of required) if (!bundled.has(asset)) errors.push(`${route}: missing ${relative(process.cwd(), asset)} in function bundle.`);
  } catch { errors.push(`Build trace is missing for ${route}. Run npm run build first.`); }
}
const reportRoute = resolve(base, "api/reports/submit/route.js.nft.json");
try {
  const trace = JSON.parse(readFileSync(reportRoute, "utf8"));
  const boundaryAsset = resolve("public/geojson/balete_barangays.json");
  if (!trace.files.some(path => resolve(dirname(reportRoute), path) === boundaryAsset)) {
    errors.push("api/reports/submit: missing barangay boundaries in function bundle.");
  }
} catch { errors.push("Build trace is missing for api/reports/submit. Run npm run build first."); }
function inspect(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const file = resolve(folder, entry.name);
    if (entry.isDirectory()) inspect(file);
    else if (entry.name.endsWith(".nft.json")) {
      const trace = JSON.parse(readFileSync(file, "utf8"));
      for (const path of trace.files) {
        const normalized = relative(process.cwd(), resolve(dirname(file), path)).replaceAll("\\", "/");
        if (/(^|\/)\.env(\.|$)|(^|\/)(deployment-private|secrets)\/|firebase-adminsdk.*\.json$|service-account.*\.json$/i.test(normalized)) {
          errors.push(`A private configuration file was included in a function trace: ${relative(process.cwd(), file)}.`);
        }
      }
    }
  }
}
try { if (statSync(base).isDirectory()) inspect(base); }
catch { errors.push("The production server build is missing."); }
if (errors.length) { for (const error of new Set(errors)) console.error(error); process.exitCode = 1; }
else console.log("Function bundle check passed: report boundaries and certificate assets included, private configuration excluded.");
