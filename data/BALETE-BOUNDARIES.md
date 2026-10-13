# Balete, Batangas barangay boundaries

The GIS map uses the 13 barangays listed by PSA for municipality PSGC **0401004000**.
Kinalaglagan is not in that list. Calawit is on Taal Volcano Island; San Sebastian
is on the mainland and was missing from the previous synthetic dataset.

## Source and reproduction

- Barangay names/codes: [PSA PSGC](https://psa.gov.ph/classification/psgc/barangays/0401004000).
- Full-resolution polygons: `BgySubMuns.shp.shp` in the
  [altcoder PSGC archive](https://github.com/altcoder/philippines-psgc-shapefiles/blob/main/dist/PH_Adm4_BgySubMuns.shp.zip),
  with source attributes updated to the 31 December 2023 PSGC snapshot.
- Upstream boundary providers: NAMRIA and PSA via
  [OCHA's HDX administrative boundary dataset](https://data.humdata.org/dataset/cod-ab-phl).
  Upstream data license: CC BY-IGO. The redistribution/tool repository uses MIT.
- Original archive member CRS: EPSG:4326 (read from its `.prj`, not guessed from
  the repository's general projection description).
- Original source records are preserved in `balete-source-full.json`.
  Only records with PSGC `0401004001` through `0401004013` were extracted.
- Run `node scripts/import-balete-boundaries.mjs` from `admin-dashboard` to
  regenerate `public/geojson/balete_barangays.json` and its source SHA-256 metadata.
  Polygon coordinate arrays are retained verbatim. Label positions are computed
  inside the polygons; they are not geofence centers or substitute borders.
- Coordinates throughout GeoJSON/Turf are **[longitude, latitude]**. They are
  reversed only when passed to Leaflet's latitude-first position interface.

The extraction used ZIP byte ranges for DBF/SHX/PRJ and the SHP prefix containing
source records 8821–8833, rather than downloading every municipality. DBF/SHX/PRJ
members passed ZIP CRC checks. The original shape record geometry is preserved
in the checked-in extract. The test suite verifies that the deployed polygons
have identical coordinate arrays, all 13 IDs, no self-intersections and no
overlapping interiors.

## Geofencing behavior

Report GPS is tested against the actual polygons, including holes and detached
parts. GPS takes precedence over the report's typed barangay. Reports outside
the polygons, exactly on a border, or with invalid GPS remain unassigned and
are flagged for review. They are never assigned to the nearest barangay.

Legacy reports with absent GPS or the Android default `0,0` use an exact barangay
name/address-segment match. Conflicting names remain unassigned. The map's
barangay selection zooms to the chosen polygon; type/date filters change the
active report counts without changing geofence geometry.

## Accuracy limits

These are published administrative reference polygons, not a new cadastral
survey or an LGU certification. PSGC update dates describe code/name changes,
not a re-survey of the borders. The HDX catalog retrieved on 3 October 2026
describes boundaries created/edited on 9 February 2018 and reviewed on
1 April 2024; that catalog metadata is not a claim that the entire archived
geometry was surveyed in 2023 or 2024. Confirm disputed or legally significant
boundaries with Balete's LGU/NAMRIA. Phone GPS accuracy also affects points near
a border; adding more location samples cannot correct incorrect polygon data.

The fix changes map/analytics classification. It does not rewrite existing
Firestore report addresses or change Captain account permissions.
