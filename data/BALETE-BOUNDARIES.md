# Balete municipality-supplied geofencing

The resident app, report submission API, dashboard map and analytics use the
same 13 barangay polygons from the municipality's delivery received from the
user on 26 October 2026. This replaces the former NAMRIA/PSA/OCHA public extract.

## Source selection

- `municipality-2026-10-26/Balete_Barangay_Boundary_fin (2).*` supplies the
  individual geofences. Keep SHP, SHX, DBF, PRJ and CPG together.
- `municipality-2026-10-26/Balete_Municipal_Boundary_fin (1).*` supplies the
  independent outer-boundary check. It contains the mainland and Calawit island.
  A municipal outline alone cannot identify a report's barangay.
- Both PRJ files specify WGS84 / UTM zone 51N, **EPSG:32651**, in meters.
  The converter uses pyproj with `always_xy=True` to produce WGS84 GeoJSON in
  **[longitude, latitude]**, EPSG:4326. Ring winding is normalized, with all
  vertices retained. Borders are never simplified, snapped or buffered.
- Original binary files are preserved in the folder above. Extract metadata
  records SHA-256 hashes for all ten files. The deployment asset also records
  the SHA-256 of the converted barangay source.
- The municipal DBF calls one barangay **Sampalukan**. Its polygon maps to the
  existing application name **Sampalocan**, retaining the application's PSGC and
  account/report associations. `sourceName` preserves the original spelling.
  The municipal delivery contains names, not PSGC codes; application codes are
  retained from the previous mapping.

## Validation and reproduction

Install `scripts/requirements-boundaries.txt` into a Python environment, then:

```powershell
python scripts/convert-municipal-boundaries.py
node scripts/import-balete-boundaries.mjs
node --test tests/barangay-geofence.test.mjs
```

The Python converter accepts an optional source-folder argument. It checks
all 13 names, valid polygons, geographic extent, projection round-trip,
overlaps and municipal coverage before writing `balete-municipal-source.json`
and `balete-municipal-outline.json`. The Node importer builds the runtime asset
and places labels strictly inside each polygon. Python is not required at runtime.

The supplied UTM data validates with **0 m²** of gaps, overlaps or barangay area
outside the municipal outline. Municipal/combined barangay area is approximately
**20,695,413.70 m² (2,069.54 hectares)**. The tests independently compare the
converted union with the municipal outline and check corrected GPS examples,
holes, detached parts, invalid GPS and an actual shared source vertex.

Copy the generated `public/geojson/balete_barangays.json` unchanged to the other
dashboard checkout and `resident-app/app/src/main/assets/balete_barangays.json`.
Deploy the server/dashboard and rebuild/install the Android APK together.
The submit API reads this same bundled file; a new APK calling an old server
can otherwise disagree about a corrected border.

## Geofencing behavior

Pins use the supplied polygons, including any holes or detached parts. Exact
borders and ambiguous overlaps require review; outside pins never get a nearest
barangay. Residents remain restricted to their registered barangay. GPS takes
precedence over a typed address; legacy reports without GPS use exact address
segments. Existing stored report addresses and account barangays are not rewritten.

The source's survey date and redistribution terms were not included. The receipt
date describes provenance, not a survey date. Phone GPS accuracy still affects
pins close to a border. `balete-source-full.json` is retained only as the previous
public-source reference and is no longer used by the importer or runtime.

## Previous source attribution

The retained historical `balete-source-full.json` came from NAMRIA/PSA via
[OCHA HDX](https://data.humdata.org/dataset/cod-ab-phl), extracted from the
[altcoder PSGC archive](https://github.com/altcoder/philippines-psgc-shapefiles/blob/main/dist/PH_Adm4_BgySubMuns.shp.zip)
(31 December 2023 PSGC snapshot). Its upstream boundary data is CC BY-IGO;
the archive repository code is MIT. These credits apply to the historical
extract, not to the new municipality-supplied delivery.
