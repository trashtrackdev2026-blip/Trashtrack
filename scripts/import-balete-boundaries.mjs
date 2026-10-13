// Input: original, unsimplified Balete records extracted from the source archive.
// Run with: node scripts/import-balete-boundaries.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { bbox, booleanPointInPolygon, centerOfMass, point, pointToPolygonDistance } from "@turf/turf";

const sourceUrl = new URL("../data/balete-source-full.json", import.meta.url);
const sourceBytes = readFileSync(sourceUrl);
const source = JSON.parse(sourceBytes);
const names = ["Alangilan", "Calawit", "Looc", "Magapi", "Makina", "Malabanan", "Paligawan",
  "Palsara", "Poblacion", "Sala", "Sampalocan", "Solis", "San Sebastian"];
if (source.features.length !== 13) throw new Error("Expected 13 source barangays.");

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
  const original = source.features.find(feature => String(feature.properties.adm4_psgc).padStart(10, "0") === psgc);
  if (!original || original.properties.adm4_en !== name || original.properties.adm3_psgc !== 401004000) {
    throw new Error(`Missing or mismatched source: ${name}.`);
  }
  return {
    type: "Feature", id: psgc,
    properties: { id: name.toLowerCase().replaceAll(" ", "-"), name, psgc,
      municipality: "Balete", province: "Batangas", labelPoint: interiorLabel(original) },
    geometry: original.geometry,
  };
});
const output = {
  type: "FeatureCollection", name: "Balete_Batangas_Published_Barangay_Boundaries",
  metadata: {
    municipalityPsgc: "0401004000", coordinateSystem: "EPSG:4326",
    coordinateOrder: "longitude, latitude", psgcSnapshot: "2023-12-31",
    source: "NAMRIA/PSA via OCHA HDX; PSGC-enriched archive by altcoder",
    sourceArchive: "https://github.com/altcoder/philippines-psgc-shapefiles/blob/main/dist/PH_Adm4_BgySubMuns.shp.zip",
    sourceMember: "BgySubMuns.shp.shp", sourceDataset: "https://data.humdata.org/dataset/cod-ab-phl",
    barangayList: "https://psa.gov.ph/classification/psgc/barangays/0401004000",
    license: "CC BY-IGO (upstream boundary data); MIT (repository code)",
    extractedSourceSha256: createHash("sha256").update(sourceBytes).digest("hex"),
    geometryProcessing: "Original source vertices retained; no simplification or synthetic partitioning.",
    limitations: "Published administrative reference boundaries, not a cadastral survey or legal LGU certification. PSGC dates describe code/name updates, not a new border survey.",
  },
  bbox: bbox({ type: "FeatureCollection", features }), features,
};
writeFileSync(new URL("../public/geojson/balete_barangays.json", import.meta.url), JSON.stringify(output, null, 2) + "\n");
console.log(`Imported ${features.length} full-resolution barangays. Bounds: ${output.bbox.join(", ")}`);
for (const feature of features) console.log(feature.properties.name, feature.geometry.type, feature.geometry.coordinates.flat(2).length / 2);
