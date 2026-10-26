// Input: municipality-supplied shapefiles converted by convert-municipal-boundaries.py.
// Run with: node scripts/import-balete-boundaries.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { bbox, booleanPointInPolygon, centerOfMass, point, pointToPolygonDistance } from "@turf/turf";

const sourceUrl = new URL("../data/balete-municipal-source.json", import.meta.url);
const sourceBytes = readFileSync(sourceUrl);
const source = JSON.parse(sourceBytes);
const names = ["Alangilan", "Calawit", "Looc", "Magapi", "Makina", "Malabanan", "Paligawan",
  "Palsara", "Poblacion", "Sala", "Sampalocan", "Solis", "San Sebastian"];
if (source.features.length !== 13) throw new Error("Expected 13 source barangays.");
const aliases = { Sampalukan: "Sampalocan" };
const canonicalName = feature => aliases[feature.properties.BRGYName] ?? feature.properties.BRGYName;
if (new Set(source.features.map(canonicalName)).size !== 13 ||
    source.features.some(feature => !names.includes(canonicalName(feature)))) {
  throw new Error("Unexpected or duplicate municipal source barangay.");
}

function interiorLabel(feature) {
  const [west, south, east, north] = bbox(feature);
  let best = centerOfMass(feature);
  let clearance = booleanPointInPolygon(best, feature, { ignoreBoundary: true })
    ? Math.abs(pointToPolygonDistance(best, feature)) : -1;
  // Label positions only: never move, buffer, simplify or reconstruct a border.
  for (let x = 1; x < 40; x++) for (let y = 1; y < 40; y++) {
    const candidate = point([west + (east - west) * x / 40, south + (north - south) * y / 40]);
    if (!booleanPointInPolygon(candidate, feature, { ignoreBoundary: true })) continue;
    const distance = Math.abs(pointToPolygonDistance(candidate, feature));
    if (distance > clearance) { best = candidate; clearance = distance; }
  }
  if (clearance <= 0) throw new Error("No interior label point.");
  return best.geometry.coordinates;
}

const features = names.map((name, index) => {
  const psgc = `0401004${String(index + 1).padStart(3, "0")}`;
  const original = source.features.find(feature => canonicalName(feature) === name);
  if (!original) {
    throw new Error(`Missing or mismatched source: ${name}.`);
  }
  return {
    type: "Feature", id: psgc,
    properties: { id: name.toLowerCase().replaceAll(" ", "-"), name, psgc,
      municipality: "Balete", province: "Batangas", sourceName: original.properties.BRGYName,
      sourceAreaHectares: original.properties["Area (has)"], labelPoint: interiorLabel(original) },
    geometry: original.geometry,
  };
});
const output = {
  type: "FeatureCollection", name: "Balete_Batangas_Municipal_Barangay_Boundaries",
  metadata: {
    municipalityPsgc: "0401004000", coordinateSystem: "EPSG:4326",
    coordinateOrder: "longitude, latitude",
    ...source.metadata,
    nameAliases: aliases,
    psgcMapping: "Existing application barangay codes retained; municipal source identifies barangays by BRGYName.",
    extractedSourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
    limitations: "Survey date and redistribution terms were not supplied. Received date records import provenance, not a survey date. Phone GPS accuracy still affects pins near a border.",
  },
  bbox: bbox({ type: "FeatureCollection", features }), features,
};
writeFileSync(new URL("../public/geojson/balete_barangays.json", import.meta.url), JSON.stringify(output, null, 2) + "\n");
console.log(`Imported ${features.length} full-resolution barangays. Bounds: ${output.bbox.join(", ")}`);
for (const feature of features) console.log(feature.properties.name, feature.geometry.type, feature.geometry.coordinates.flat(2).length / 2);
