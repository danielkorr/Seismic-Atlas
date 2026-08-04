# Seismic Atlas

Seismic Atlas is an interactive global earthquake reporting and historical
mapping site. It plots every USGS catalog event at magnitude 4.0 or greater in
a rolling seven-day window and provides decade-by-decade exploration from 1876
to the present.

**Live site:** [seismic-atlas.danorr.chatgpt.site](https://seismic-atlas.danorr.chatgpt.site)

## Features

- Live global M4.0+ earthquake map, refreshed every five minutes
- Detailed event inspector with coordinates, depth, magnitude type, felt
  reports, tsunami flag, PAGER alert, source network, and location-quality data
- Historical mapping in ten-year increments from 1876 to the present
- Geographic lenses for the Ring of Fire, Cascadia, San Andreas,
  Alaska–Aleutian, Japan–Kuril–Kamchatka, Andes, Sunda, Tonga–Kermadec, and the
  Alpine–Himalayan belt
- Search, sorting, map selection, keyboard event stepping, and GeoJSON export
- Responsive desktop and mobile layouts with accessible, non-hover-only data
- Explicit source, projection, coverage, and historical-completeness notes

## Data and map

Earthquake records come from the
[USGS FDSN Event API](https://earthquake.usgs.gov/fdsnws/event/1/) and the
[ANSS Comprehensive Earthquake Catalog](https://earthquake.usgs.gov/data/comcat/).
No API key is required.

The basemap is rendered from the `world-atlas` 110 m land topology with D3's
equirectangular projection. Earthquake positions use WGS84 longitude and
latitude. Named tectonic traces are intentionally schematic orientation aids;
they are not survey-grade plate boundaries or hazard forecasts.

See [Mapping and data architecture](docs/MAPPING_AND_DATA.md) for the projection,
query windows, visual encodings, completeness caveats, and extension points.

## Technology

- React 19 and TypeScript
- Next.js-compatible App Router source
- Vinext and Vite for Cloudflare Worker output
- D3 Geo and TopoJSON for cartography
- Tailwind CSS entrypoint plus project-specific responsive CSS
- OpenAI Sites deployment manifest and verified Worker artifact build

## Local development

Prerequisites:

- Node.js 22.13 or newer
- Linux, WSL, or another environment with Bash, GNU `timeout`, `flock`, and
  `curl`

Install and run:

```bash
npm ci
npm run dev
```

Production checks:

```bash
npm run lint
npm run build
npm test
```

The live USGS request occurs in the browser. If the service cannot be reached,
the application keeps the map usable with a clearly labeled offline sample
rather than presenting sample records as current data.

## Project structure

```text
app/
  seismic-dashboard.tsx  Main data, state, query, and map implementation
  globals.css            Responsive visual system and map styling
  layout.tsx             Metadata and font configuration
docs/
  MAPPING_AND_DATA.md     Source, region, projection, and encoding reference
public/                   Static icons
scripts/                  Reproducible install, build, and artifact checks
tests/                    Rendered-output validation
.openai/hosting.json      OpenAI Sites project manifest
```

## Deployment

The checked-in build emits a Cloudflare Worker-compatible ESM artifact at
`dist/server/index.js` and copies the Sites manifest into `dist/.openai/`.
Generated output, local runtime state, and environment files are excluded from
version control.

## Data-use notice

Historical earthquake detection and magnitude completeness vary considerably by
era and region. A sparse early-decade map must not be interpreted as proof that
few earthquakes occurred. Seismic Atlas is an exploration interface, not an
emergency-alert service or earthquake forecast.
