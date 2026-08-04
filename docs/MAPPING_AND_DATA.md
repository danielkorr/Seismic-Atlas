# Mapping and data architecture

This document records the geographic, temporal, and visual contracts used by
Seismic Atlas. It is intended for maintainers who want to extend the map without
silently changing its analytical meaning.

## Source ledger

| Layer | Source | Status | Update policy | Units / reference |
| --- | --- | --- | --- | --- |
| Earthquake events | USGS ANSS ComCat through the FDSN Event API | Measured catalog records | Live mode reloads every five minutes; historical mode loads on request | WGS84 longitude/latitude; depth in km; event time in UTC |
| Land geometry | `world-atlas/land-110m.json` | Generalized contextual geometry | Version-locked by `package-lock.json` | TopoJSON converted to GeoJSON |
| Named tectonic traces | Coordinates in `app/seismic-dashboard.tsx` | Schematic orientation layer | Maintainer-reviewed | WGS84-like longitude/latitude points |
| Geographic query lenses | Bounding windows in `app/seismic-dashboard.tsx` | Analytical query definitions | Maintainer-reviewed | `[minLon, minLat, maxLon, maxLat]` |
| Offline events | Local fallback array | Simulated and clearly labeled | Used only after a live-data failure | Same event contract as USGS summaries |

USGS field definitions:

- [FDSN Event API](https://earthquake.usgs.gov/fdsnws/event/1/)
- [GeoJSON summary format](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)
- [ComCat event-term documentation](https://earthquake.usgs.gov/data/comcat/)

## Coordinate and projection contract

- Input event coordinates are `[longitude, latitude, depth]`.
- Longitude is expected in the `-180°` to `180°` range.
- Latitude is expected in the `-90°` to `90°` range.
- Depth is displayed as positive kilometers below the event surface reference.
- The map uses a D3 equirectangular projection in a `1000 × 500` SVG viewBox.
- The projection is shared by land, graticules, tectonic traces, region windows,
  markers, selection rings, focus behavior, and keyboard stepping.
- Antimeridian-spanning regions are represented as two windows. Geometry is not
  joined across the map edge.
- Marker and boundary strokes use `vector-effect: non-scaling-stroke` where
  appropriate so zooming does not imply changing uncertainty or fault width.

Known-place checks when modifying the projection:

1. California markers should appear on the west coast of North America.
2. Japan markers should appear east of the Asian mainland.
3. Chile markers should appear on the western edge of South America.
4. Tonga events with negative longitude should appear near the right/left
   Pacific map edge, depending on exact coordinate.

## Historical query lenses

Bounds are inclusive FDSN query windows. Composite lenses issue multiple
requests and de-duplicate events by USGS event ID.

| Lens | Query windows |
| --- | --- |
| Global | No geographic bounds; returned results are capped |
| Pacific Ring of Fire | Alaska/Aleutian east and west, western North America, Andes, Japan/Kuril, Indonesia, and Southwest Pacific windows |
| Cascadia | `[-132, 39, -120, 52]` |
| San Andreas system | `[-126, 31, -113, 41]` |
| Alaska–Aleutian | `[-180, 45, -130, 72]` and `[165, 45, 180, 58]` |
| Japan–Kuril–Kamchatka | `[135, 30, 165, 58]` |
| Andean Subduction Zone | `[-83, -58, -64, 13]` |
| Sumatra–Java Trench | `[90, -13, 122, 16]` |
| Tonga–Kermadec | `[-180, -40, -165, -10]` |
| Alpine–Himalayan belt | `[-12, 22, 105, 47]` |

These are product-level exploration regions, not legal, geological-survey, or
hazard-zone boundaries. A future polygon-based version should preserve the lens
IDs so shared URLs remain valid.

## Temporal queries

Live mode requests:

- Start: seven days before the request
- End: current time
- Minimum magnitude: 4.0
- Order: newest first
- Limit: 2,000 events

Historical mode requests:

- Start: January 1 of the selected year
- End: January 1 ten years later, clamped to the current date
- Step: ten years, starting in 1876
- Minimum magnitude: user-selectable M4.0 to M6.0
- Default: M5.0
- Order: largest magnitude first
- Global or single-window cap: 2,000 events
- Ring of Fire cap: 500 per component window before de-duplication

## Visual encoding

| Magnitude | Color | Additional cue |
| --- | --- | --- |
| M4.0–4.9 | Yellow `#ffd166` | Small circle |
| M5.0–5.9 | Orange `#ff9f43` | Larger circle |
| M6.0–6.9 | Red-orange `#ff6549` | Outer strength ring |
| M7.0+ | Magenta-red `#ff3d72` | Largest symbol and outer ring |

Selected events receive a cyan focus ring. Depth is not encoded in marker size;
it remains a labeled value in the inspector and catalog. This prevents viewers
from confusing hypocentral depth with earthquake magnitude.

## Detail loading

The summary query supplies the main map and catalog. After an event is selected,
the application follows the USGS `detail` URL when available to retrieve fields
such as horizontal and depth uncertainty. The summary record remains visible
while details load or if the detail request fails.

## Reliability and fallback behavior

- The last known view remains visible while a refresh begins.
- A failed live request switches to a clearly labeled offline sample.
- A failed historical request shows an empty state rather than substituting
  sample data into a historical decade.
- Source status is visible in the page header.
- The live mode refresh timer is five minutes.
- Exported GeoJSON contains the current filtered USGS result set, not tectonic
  context geometry.

## Historical completeness

Catalog completeness is not constant. Instrument density, network coverage,
magnitude methods, association practices, and reporting thresholds changed
over time. Comparisons across the full 150-year range are most defensible at
higher magnitude thresholds and within the same geographic lens. The interface
therefore recommends M5.0+ and keeps the completeness warning adjacent to the
historical controls.

## Extension points

When adding a new lens or mapping layer:

1. Add a stable lens ID and human-readable description.
2. Record the exact bounds or source geometry in this document.
3. State whether the layer is measured, inferred, estimated, schematic, or
   decorative.
4. Confirm the antimeridian policy.
5. Test California, Japan, Chile, and Tonga alignment.
6. Test keyboard selection and mobile event stepping.
7. Keep critical values visible outside hover states.
