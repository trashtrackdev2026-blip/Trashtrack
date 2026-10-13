import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export const BALETE_BARANGAYS = [
  "Alangilan", "Calawit", "Looc", "Magapi", "Makina", "Malabanan", "Paligawan",
  "Palsara", "Poblacion", "Sala", "Sampalocan", "Solis", "San Sebastian",
] as const;

export type BarangayName = (typeof BALETE_BARANGAYS)[number];
export interface BarangayProperties {
  id: string;
  name: BarangayName;
  psgc: string;
  municipality: "Balete";
  province: "Batangas";
  /** WGS84 [longitude, latitude], just like the polygon coordinates. */
  labelPoint: [number, number];
}
export type BarangayFeature = Feature<Polygon | MultiPolygon, BarangayProperties>;
export type BarangayBoundaries = FeatureCollection<Polygon | MultiPolygon, BarangayProperties>;
export type GeofenceResult =
  | { status: "inside"; barangay: BarangayName; psgc: string }
  | { status: "boundary"; barangays: BarangayName[] }
  | { status: "outside" | "invalid" };

export interface ReportLocation {
  latitude?: unknown;
  longitude?: unknown;
  barangay?: unknown;
  location?: unknown;
}

function validPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 &&
    typeof value[0] === "number" && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 &&
    typeof value[1] === "number" && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;
}

/** Reject incomplete lists, mixed municipalities and malformed/lat-lng-swapped data. */
export function validateBaleteBoundaries(value: unknown): BarangayBoundaries {
  const data = value as BarangayBoundaries | undefined;
  if (data?.type !== "FeatureCollection" || !Array.isArray(data.features) || data.features.length !== 13) {
    throw new Error("The boundary file must contain all 13 Balete barangays.");
  }
  const names = new Set<string>();
  for (const feature of data.features) {
    const props = feature.properties;
    const index = BALETE_BARANGAYS.indexOf(props?.name);
    if (feature.type !== "Feature" || index < 0 || names.has(props.name) ||
        props.psgc !== `0401004${String(index + 1).padStart(3, "0")}` ||
        props.municipality !== "Balete" || props.province !== "Batangas") {
      throw new Error("The boundary file contains an incorrect or duplicate Balete barangay.");
    }
    names.add(props.name);
    const geometry = feature.geometry;
    if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) {
      throw new Error(`Missing polygon for ${props.name}.`);
    }
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    if (!polygons.length) throw new Error(`Empty polygon for ${props.name}.`);
    for (const polygon of polygons) {
      if (!polygon.length) throw new Error(`Empty rings for ${props.name}.`);
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4 || ring.some(position =>
          !validPosition(position) || position[0] < 120.9 || position[0] > 121.3 ||
          position[1] < 13.8 || position[1] > 14.2) ||
          ring[0][0] !== ring.at(-1)?.[0] || ring[0][1] !== ring.at(-1)?.[1]) {
          throw new Error(`Invalid WGS84 ring for ${props.name}.`);
        }
      }
    }
    if (!validPosition(props.labelPoint) || !booleanPointInPolygon(point(props.labelPoint), feature, { ignoreBoundary: true })) {
      throw new Error(`The label must be inside ${props.name}.`);
    }
  }
  return data;
}

/** GeoJSON/Turf use [longitude, latitude]; GPS callers pass latitude first. */
export function locateBarangay(boundaries: BarangayBoundaries, latitude: unknown, longitude: unknown): GeofenceResult {
  if (typeof latitude !== "number" || typeof longitude !== "number" ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return { status: "invalid" };
  const gps = point([longitude, latitude]);
  const candidates = boundaries.features.filter(feature => booleanPointInPolygon(gps, feature));
  if (!candidates.length) return { status: "outside" };
  const interior = candidates.filter(feature => booleanPointInPolygon(gps, feature, { ignoreBoundary: true }));
  if (interior.length === 1) {
    const { name: barangay, psgc } = interior[0].properties;
    return { status: "inside", barangay, psgc };
  }
  // An exact shared edge, outer edge, or overlapping source polygon needs review.
  return { status: "boundary", barangays: candidates.map(feature => feature.properties.name) };
}

/** Legacy reports stored absent GPS as 0,0; real GPS must never fall back to an address. */
export function assignReportBarangay(boundaries: BarangayBoundaries, report: ReportLocation): {
  barangay: BarangayName | null;
  method: "gps" | "address" | "outside" | "boundary" | "invalid" | "unassigned";
} {
  const absent = (value: unknown) => value === undefined || value === null;
  const noGps = (absent(report.latitude) && absent(report.longitude)) ||
    (report.latitude === 0 && report.longitude === 0);
  if (!noGps) {
    const result = locateBarangay(boundaries, report.latitude, report.longitude);
    return result.status === "inside" ? { barangay: result.barangay, method: "gps" }
      : { barangay: null, method: result.status };
  }
  const normalize = (text: string) => text.toLowerCase().trim()
    .replace(/^(?:barangay|brgy\.?|bgy\.?)\s+/i, "").replace(/\s+/g, " ");
  // Match an entire address segment, not e.g. Sala inside Palsara or a town elsewhere.
  const segments = [report.barangay, report.location].filter((value): value is string => typeof value === "string")
    .flatMap(value => {
      const parts = value.split(",").map(normalize);
      return parts.length === 1 || parts.some(part => part === "balete" || part === "municipality of balete") ? parts : [];
    });
  const matches = BALETE_BARANGAYS.filter(name => segments.includes(normalize(name)));
  return matches.length === 1 ? { barangay: matches[0], method: "address" }
    : { barangay: null, method: "unassigned" };
}

let boundaryRequest: Promise<BarangayBoundaries> | undefined;
/** Both map sizes and analytics use the same validated, locally hosted data. */
export function loadBaleteBoundaries(): Promise<BarangayBoundaries> {
  if (!boundaryRequest) {
    boundaryRequest = fetch("/geojson/balete_barangays.json", { signal: AbortSignal.timeout(10_000) })
      .then(response => {
        if (!response.ok) throw new Error("Unable to load Balete barangay boundaries.");
        return response.json();
      })
      .then(validateBaleteBoundaries)
      .catch(error => { boundaryRequest = undefined; throw error; });
  }
  return boundaryRequest;
}
