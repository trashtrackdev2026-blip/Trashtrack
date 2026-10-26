import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { area, difference, featureCollection, intersect, kinks, union } from "@turf/turf";
import { BALETE_BARANGAYS, validateBaleteBoundaries, locateBarangay, assignReportBarangay } from "../src/lib/barangay-geofence.ts";

const data = JSON.parse(readFileSync(new URL("../public/geojson/balete_barangays.json", import.meta.url)));
const sourceBytes = readFileSync(new URL("../data/balete-municipal-source.json", import.meta.url));
const source = JSON.parse(sourceBytes);
const outline = JSON.parse(readFileSync(new URL("../data/balete-municipal-outline.json", import.meta.url)));
const boundaries = validateBaleteBoundaries(data);

test("all 13 barangays use municipality-supplied geometry and retain the application PSGC", () => {
  assert.deepEqual(boundaries.features.map(feature => feature.properties.name), [...BALETE_BARANGAYS]);
  for (const feature of boundaries.features) {
    const original = source.features.find(item => item.properties.BRGYName === feature.properties.sourceName);
    assert.equal(feature.properties.psgc, `0401004${String(BALETE_BARANGAYS.indexOf(feature.properties.name) + 1).padStart(3, "0")}`);
    assert.deepEqual(feature.geometry, original.geometry);
    const [lng, lat] = feature.properties.labelPoint;
    assert.equal(locateBarangay(boundaries, lat, lng).barangay, feature.properties.name);
  }
  assert.equal(boundaries.features.some(feature => feature.properties.name === "Kinalaglagan"), false);
  assert.equal(boundaries.features.find(feature => feature.properties.name === "Sampalocan").properties.sourceName, "Sampalukan");
  assert.equal(data.metadata.extractedSourceSha256, createHash("sha256").update(sourceBytes).digest("hex"));
  assert.equal(data.metadata.sourceCrs, "EPSG:32651");
});

test("archived municipality shapefile components match their provenance checksums", () => {
  for (const collection of [source, outline]) for (const [filename, checksum] of Object.entries(collection.metadata.sourceFiles)) {
    const bytes = readFileSync(new URL(`../data/municipality-2026-10-26/${filename}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), checksum, filename);
  }
});

test("the barangay union covers the supplied municipal outline, including Calawit", () => {
  const merged = union(boundaries);
  const municipal = outline.features[0];
  for (const [a, b] of [[merged, municipal], [municipal, merged]]) {
    const remainder = difference(featureCollection([a, b]));
    assert.ok(!remainder || area(remainder) < 0.001, "Municipal coverage differs");
  }
  assert.equal(municipal.geometry.type, "MultiPolygon");
  assert.equal(municipal.geometry.coordinates.length, 2);
});

test("source polygons have no self-intersections or overlapping interiors", () => {
  for (const feature of boundaries.features) assert.equal(kinks(feature).features.length, 0, feature.properties.name);
  for (let i = 0; i < 13; i++) for (let j = i + 1; j < 13; j++) {
    const overlap = intersect(featureCollection([boundaries.features[i], boundaries.features[j]]));
    assert.ok(!overlap || area(overlap) < 0.001, `${i}/${j} overlap`);
  }
});

test("municipal corrections classify mainland pins correctly and keep Calawit on Volcano Island", () => {
  assert.equal(locateBarangay(boundaries, 14.006, 121.010).barangay, "Calawit");
  assert.equal(locateBarangay(boundaries, 14.0262, 121.0642).barangay, "San Sebastian");
  assert.equal(locateBarangay(boundaries, 14.019, 121.098).barangay, "Makina");
  assert.equal(locateBarangay(boundaries, 14.028, 121.120).barangay, "Malabanan");
  assert.equal(locateBarangay(boundaries, 14.0044, 121.1147).barangay, "Alangilan");
  assert.equal(locateBarangay(boundaries, 14.03865, 121.10361).barangay, "Solis");
  assert.equal(locateBarangay(boundaries, 14.01187, 121.10181).barangay, "Palsara");
  assert.equal(locateBarangay(boundaries, 14.03338, 121.09381).barangay, "Sampalocan");
  assert.equal(locateBarangay(boundaries, 13.995, 121.102).status, "outside");
});

test("a supplied shared vertex remains a boundary requiring review", () => {
  const makina = boundaries.features.find(feature => feature.properties.name === "Makina");
  const poblacion = boundaries.features.find(feature => feature.properties.name === "Poblacion");
  const shared = makina.geometry.coordinates[0].find(xy => poblacion.geometry.coordinates[0].some(other => xy[0] === other[0] && xy[1] === other[1]));
  assert.ok(shared);
  const result = locateBarangay(boundaries, shared[1], shared[0]);
  assert.equal(result.status, "boundary");
  assert.ok(result.barangays.includes("Makina") && result.barangays.includes("Poblacion"));
});

test("lake and neighboring towns stay outside, and swapped/invalid GPS is rejected", () => {
  assert.equal(locateBarangay(boundaries, 14.005, 121.06).status, "outside");
  assert.equal(locateBarangay(boundaries, 14.04, 121.092).status, "outside");
  for (const gps of [[121.01, 14.006], [NaN, 121], [14, Infinity], [undefined, 121], ["14.006", "121.010"]]) {
    assert.equal(locateBarangay(boundaries, ...gps).status, "invalid");
  }
});

test("GPS overrides a conflicting address; outside/invalid GPS never gets a nearest barangay", () => {
  assert.deepEqual(assignReportBarangay(boundaries, { latitude: 14.006, longitude: 121.010, location: "Poblacion" }),
    { barangay: "Calawit", method: "gps" });
  assert.deepEqual(assignReportBarangay(boundaries, { latitude: 14.005, longitude: 121.06, location: "Poblacion" }),
    { barangay: null, method: "outside" });
  assert.deepEqual(assignReportBarangay(boundaries, { latitude: 14, location: "Poblacion" }),
    { barangay: null, method: "invalid" });
  assert.deepEqual(assignReportBarangay(boundaries, { latitude: 0, longitude: 0, location: "Brgy. Palsara, Balete, Batangas" }),
    { barangay: "Palsara", method: "address" });
  assert.equal(assignReportBarangay(boundaries, { location: "Palsara" }).barangay, "Palsara");
  assert.equal(assignReportBarangay(boundaries, { location: "Other Poblacion" }).barangay, null);
  assert.equal(assignReportBarangay(boundaries, { location: "Poblacion, Malvar, Batangas" }).barangay, null);
});

test("polygon holes, detached multipolygons, and exact shared borders are handled", () => {
  const feature = (name, geometry) => ({ type: "Feature", properties: { name, psgc: name }, geometry });
  const square = (x, y, size) => [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
  const fixtures = { type: "FeatureCollection", features: [
    feature("Alangilan", { type: "Polygon", coordinates: [square(121, 14, .02), square(121.005, 14.005, .005)] }),
    feature("Calawit", { type: "MultiPolygon", coordinates: [[square(121.02, 14, .02)], [square(121.06, 14, .01)]] }),
  ] };
  assert.equal(locateBarangay(fixtures, 14.007, 121.007).status, "outside");
  assert.equal(locateBarangay(fixtures, 14.004, 121.064).barangay, "Calawit");
  const edge = locateBarangay(fixtures, 14.01, 121.02);
  assert.equal(edge.status, "boundary");
  assert.deepEqual(edge.barangays, ["Alangilan", "Calawit"]);
  assert.deepEqual(assignReportBarangay(fixtures, { latitude: 14.01, longitude: 121.02, location: "Alangilan" }),
    { barangay: null, method: "boundary" });
  assert.equal(locateBarangay(fixtures, 14, 121).status, "boundary");
});

test("an incomplete, wrong-town or lat/lng-swapped boundary file cannot silently load", () => {
  assert.throws(() => validateBaleteBoundaries({ ...data, features: data.features.slice(1) }));
  const wrong = structuredClone(data);
  wrong.features[0].properties.psgc = "0401005001";
  assert.throws(() => validateBaleteBoundaries(wrong));
  const swapped = structuredClone(data);
  swapped.features[0].geometry.coordinates = swapped.features[0].geometry.coordinates.map(ring => ring.map(([lng,lat]) => [lat,lng]));
  assert.throws(() => validateBaleteBoundaries(swapped));
});
