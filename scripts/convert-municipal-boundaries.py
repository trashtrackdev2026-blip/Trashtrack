"""Validate Balete's supplied shapefiles and reproject them without changing borders.

Install scripts/requirements-boundaries.txt, then run this script. An optional
folder argument selects a replacement municipal delivery. The Node importer
consumes the saved WGS84 extracts; Python is not needed to build/run the app.
"""
import hashlib
import itertools
import json
import sys
from pathlib import Path

import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
FOLDER = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data/municipality-2026-10-26"
LAYERS = {
    "barangays": "Balete_Barangay_Boundary_fin (2)",
    "municipality": "Balete_Municipal_Boundary_fin (1)",
}
NAMES = {"Alangilan", "Calawit", "Looc", "Magapi", "Makina", "Malabanan",
         "Paligawan", "Palsara", "Poblacion", "Sala", "Sampalukan", "Solis", "San Sebastian"}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def right_hand_rule(geometry):
    if geometry.geom_type == "Polygon":
        return orient(geometry, sign=1.0)
    from shapely.geometry import MultiPolygon
    return MultiPolygon([orient(part, sign=1.0) for part in geometry.geoms])


def convert_layer(stem):
    path = FOLDER / stem
    crs = CRS.from_wkt(path.with_suffix(".prj").read_text())
    if crs.to_epsg() != 32651:
        raise ValueError(f"Unexpected projection for {stem}: {crs}")
    forward = Transformer.from_crs(crs, 4326, always_xy=True)
    reverse = Transformer.from_crs(4326, crs, always_xy=True)
    features, projected = [], []
    reader = shapefile.Reader(str(path), encoding=path.with_suffix(".cpg").read_text().strip())
    for row in reader.iterShapeRecords():
        original = shape(row.shape.__geo_interface__)
        if original.geom_type not in ("Polygon", "MultiPolygon") or not original.is_valid or original.is_empty:
            raise ValueError(f"Invalid source geometry: {row.record.as_dict()}")
        gps = right_hand_rule(transform(forward.transform, original))
        west, south, east, north = gps.bounds
        if not (120.9 < west < east < 121.3 and 13.8 < south < north < 14.2):
            raise ValueError("Converted geometry is outside Balete")
        if not gps.is_valid or original.hausdorff_distance(transform(reverse.transform, gps)) > 0.00001:
            raise ValueError("Projection round-trip failed")
        projected.append(original)
        features.append({"type": "Feature", "properties": row.record.as_dict(), "geometry": mapping(gps)})
    return projected, {
        "type": "FeatureCollection",
        "metadata": {
            "source": "Municipality of Balete, Batangas; shapefiles supplied by the user",
            "receivedDate": "2026-10-26",
            "sourceCrs": "EPSG:32651",
            "coordinateSystem": "EPSG:4326",
            "coordinateOrder": "longitude, latitude",
            "sourceFiles": {path.with_suffix(ext).name: sha256(path.with_suffix(ext))
                            for ext in (".shp", ".shx", ".dbf", ".prj", ".cpg")},
            "geometryProcessing": "WGS84 UTM zone 51N to WGS84 longitude/latitude using pyproj always_xy; ring winding normalized. All source vertices retained; no snapping, buffering or simplification.",
        },
        "features": features,
    }


layers = {key: convert_layer(stem) for key, stem in LAYERS.items()}
barangays, barangay_data = layers["barangays"]
municipalities, municipality_data = layers["municipality"]
if len(barangays) != 13 or {f["properties"]["BRGYName"] for f in barangay_data["features"]} != NAMES:
    raise ValueError("The source must contain each of the 13 expected barangays")
if len(municipalities) != 1 or municipality_data["features"][0]["properties"]["BRGYName"] != "Balete":
    raise ValueError("Expected the single Balete municipal outline")
overlap = sum(a.intersection(b).area for a, b in itertools.combinations(barangays, 2))
combined = unary_union(barangays)
municipality = municipalities[0]
audit = {
    "measurementCrs": "EPSG:32651",
    "municipalAreaSquareMeters": municipality.area,
    "barangayUnionAreaSquareMeters": combined.area,
    "unassignedAreaSquareMeters": municipality.difference(combined).area,
    "outsideMunicipalityAreaSquareMeters": combined.difference(municipality).area,
    "overlappingAreaSquareMeters": overlap,
}
if any(audit[key] > 0.001 for key in ("unassignedAreaSquareMeters", "outsideMunicipalityAreaSquareMeters", "overlappingAreaSquareMeters")):
    raise ValueError(f"Source coverage check failed: {audit}")
barangay_data["metadata"]["coverageAudit"] = audit
# Write only after both inputs and coverage have passed validation.
for filename, data in (("balete-municipal-source.json", barangay_data), ("balete-municipal-outline.json", municipality_data)):
    (ROOT / "data" / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print(json.dumps(audit, indent=2))
