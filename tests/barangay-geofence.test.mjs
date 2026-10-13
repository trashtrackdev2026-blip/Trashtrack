import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { area, featureCollection, intersect, kinks } from "@turf/turf";
import { BALETE_BARANGAYS, validateBaleteBoundaries, locateBarangay, assignReportBarangay } from "../src/lib/barangay-geofence.ts";

const data = JSON.parse(readFileSync(new URL("../public/geojson/balete_barangays.json", import.meta.url)));
const source = JSON.parse(readFileSync(new URL("../data/balete-source-full.json", import.meta.url)));
const boundaries = validateBaleteBoundaries(data);

test("all 13 PSA barangays retain the original source geometry and correct PSGC", () => {
  assert.deepEqual(boundaries.features.map(feature => feature.properties.name), [...BALETE_BARANGAYS]);
  for (const feature of boundaries.features) {
    const original = source.features.find(item => String(item.properties.adm4_psgc).padStart(10, "0") === feature.properties.psgc);
    assert.deepEqual(feature.geometry, original.geometry);
    const [lng, lat] = feature.properties.labelPoint;
    assert.equal(locateBarangay(boundaries, lat, lng).barangay, feature.properties.name);
  }
  assert.equal(boundaries.features.some(feature => feature.properties.name === "Kinalaglagan"), false);
});

test("source polygons have no self-intersections or overlapping interiors", () => {
  for (const feature of boundaries.features) assert.equal(kinks(feature).features.length, 0, feature.properties.name);
  for (let i = 0; i < 13; i++) for (let j = i + 1; j < 13; j++) {
    const overlap = intersect(featureCollection([boundaries.features[i], boundaries.features[j]]));
    assert.ok(!overlap || area(overlap) < 0.001, `${i}/${j} overlap`);
  }
});

test("Calawit is on Volcano Island; San Sebastian is included; old mainland Calawit was Palsara", () => {
  assert.equal(locateBarangay(boundaries, 14.006, 121.010).barangay, "Calawit");
  assert.equal(locateBarangay(boundaries, 14.0262, 121.0642).barangay, "San Sebastian");
  assert.equal(locateBarangay(boundaries, 14.019, 121.098).barangay, "Poblacion");
  assert.equal(locateBarangay(boundaries, 13.995, 121.102).barangay, "Palsara");
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
