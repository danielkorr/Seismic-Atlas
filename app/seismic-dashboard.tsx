"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { geoEquirectangular, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldLand from "world-atlas/land-110m.json";

type QuakeProperties = {
  mag: number | null;
  place: string | null;
  time: number;
  updated: number;
  url: string;
  detail?: string;
  felt: number | null;
  cdi: number | null;
  mmi: number | null;
  alert: string | null;
  status: string;
  tsunami: number;
  sig: number;
  net: string;
  code: string;
  nst: number | null;
  dmin: number | null;
  rms: number | null;
  gap: number | null;
  magType: string | null;
  type: string;
  title?: string;
  horizontalError?: number | null;
  depthError?: number | null;
  magError?: number | null;
  locationSource?: string | null;
  magSource?: string | null;
};

type QuakeFeature = {
  type: "Feature";
  id: string;
  properties: QuakeProperties;
  geometry: { type: "Point"; coordinates: [number, number, number] };
};

type QuakeCollection = {
  type: "FeatureCollection";
  metadata?: { generated?: number; count?: number; title?: string; url?: string };
  features: QuakeFeature[];
};

type Bounds = [number, number, number, number];
type Region = {
  id: string;
  name: string;
  short: string;
  description: string;
  windows: Bounds[];
  global?: boolean;
};

type ViewMode = "live" | "history";
type DataState = "loading" | "live" | "historical" | "fallback" | "error";

const WIDTH = 1000;
const HEIGHT = 500;
const projection = geoEquirectangular()
  .scale(159)
  .translate([WIDTH / 2, HEIGHT / 2 + 2]);
const path = geoPath(projection);
const land = feature(
  worldLand as never,
  (worldLand as unknown as { objects: { land: never } }).objects.land,
);
const landPath = path(land as never) ?? "";
const graticulePath = path(geoGraticule10()) ?? "";

const REGIONS: Region[] = [
  {
    id: "global",
    name: "Global catalog",
    short: "Worldwide",
    description: "A worldwide view. Results are capped for legibility and service reliability.",
    windows: [],
    global: true,
  },
  {
    id: "ring-of-fire",
    name: "Pacific Ring of Fire",
    short: "Ring of Fire",
    description: "A composite of seven high-activity Pacific-margin windows.",
    windows: [
      [-180, 45, -130, 72],
      [165, 45, 180, 72],
      [-132, 15, -105, 55],
      [-82, -58, -65, 15],
      [135, 28, 180, 56],
      [90, -12, 150, 20],
      [150, -50, 180, -10],
    ],
  },
  {
    id: "cascadia",
    name: "Cascadia Subduction Zone",
    short: "Cascadia",
    description: "Northern California to Vancouver Island and the offshore megathrust.",
    windows: [[-132, 39, -120, 52]],
  },
  {
    id: "san-andreas",
    name: "San Andreas system",
    short: "San Andreas",
    description: "California transform-fault corridor and adjacent plate-boundary seismicity.",
    windows: [[-126, 31, -113, 41]],
  },
  {
    id: "alaska-aleutian",
    name: "Alaska–Aleutian Arc",
    short: "Alaska–Aleutian",
    description: "Alaska, the Aleutian chain, and its western antimeridian segment.",
    windows: [
      [-180, 45, -130, 72],
      [165, 45, 180, 58],
    ],
  },
  {
    id: "japan-kuril",
    name: "Japan–Kuril–Kamchatka",
    short: "Japan–Kuril",
    description: "Western Pacific subduction from central Japan through Kamchatka.",
    windows: [[135, 30, 165, 58]],
  },
  {
    id: "andes",
    name: "Andean Subduction Zone",
    short: "Andes",
    description: "The Nazca–South America convergent margin from Colombia to Tierra del Fuego.",
    windows: [[-83, -58, -64, 13]],
  },
  {
    id: "sunda",
    name: "Sumatra–Java Trench",
    short: "Sunda Arc",
    description: "The Sunda megathrust from the Andaman Sea through Java.",
    windows: [[90, -13, 122, 16]],
  },
  {
    id: "tonga-kermadec",
    name: "Tonga–Kermadec Arc",
    short: "Tonga–Kermadec",
    description: "A deep and exceptionally active Southwest Pacific subduction system.",
    windows: [[-180, -40, -165, -10]],
  },
  {
    id: "alpine-himalayan",
    name: "Alpine–Himalayan Belt",
    short: "Alpine–Himalayan",
    description: "The broad collision belt from the Mediterranean through the Himalaya.",
    windows: [[-12, 22, 105, 47]],
  },
];

const BOUNDARY_LINES: { name: string; points: [number, number][] }[] = [
  { name: "Cascadia", points: [[-126, 40], [-128, 44], [-128, 48], [-126, 51]] },
  { name: "San Andreas", points: [[-115.5, 32], [-117.5, 34], [-120.5, 36.2], [-123, 39.2]] },
  { name: "Aleutian Arc", points: [[-150, 61], [-165, 54], [-179, 51], [170, 51], [160, 54]] },
  { name: "Japan Trench", points: [[160, 52], [151, 45], [145, 38], [142, 32], [137, 27]] },
  { name: "Mariana Arc", points: [[145, 28], [143, 20], [145, 12], [150, 4]] },
  { name: "Sunda Arc", points: [[94, 13], [96, 5], [102, -5], [113, -11], [125, -10]] },
  { name: "Tonga–Kermadec", points: [[-176, -14], [-177, -24], [-178, -34], [179, -42]] },
  { name: "Andes", points: [[-78, 10], [-80, -5], [-75, -20], [-72, -36], [-74, -51]] },
  { name: "Himalayan front", points: [[66, 34], [75, 34], [84, 29], [94, 28], [101, 31]] },
];

function projectedLine(points: [number, number][]) {
  return points
    .map((point, index) => {
      const projected = projection(point);
      return projected ? `${index === 0 ? "M" : "L"}${projected[0]},${projected[1]}` : "";
    })
    .join(" ");
}

function regionRect(bounds: Bounds) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const a = projection([minLon, maxLat]);
  const b = projection([maxLon, minLat]);
  if (!a || !b) return null;
  return { x: a[0], y: a[1], width: b[0] - a[0], height: b[1] - a[1] };
}

const FALLBACK_EVENTS: QuakeFeature[] = [
  ["sample-alaska", 6.2, "Aleutian Islands, Alaska", -172.4, 52.3, 35],
  ["sample-japan", 5.8, "east of Honshu, Japan", 143.8, 38.1, 28],
  ["sample-tonga", 5.6, "Tonga region", -175.4, -21.2, 186],
  ["sample-chile", 5.3, "offshore Atacama, Chile", -71.8, -25.6, 42],
  ["sample-indonesia", 5.1, "south of Java, Indonesia", 110.2, -9.8, 63],
  ["sample-california", 4.7, "Central California", -120.7, 36.4, 9],
  ["sample-greece", 4.6, "Dodecanese Islands, Greece", 27.4, 36.1, 18],
  ["sample-atlantic", 4.5, "northern Mid-Atlantic Ridge", -36.2, 36.9, 10],
  ["sample-nz", 4.4, "South Island, New Zealand", 171.5, -43.2, 16],
  ["sample-himalaya", 4.3, "western Xizang", 81.2, 32.1, 12],
].map(([id, mag, place, lon, lat, depth], index) => ({
  type: "Feature" as const,
  id: String(id),
  properties: {
    mag: Number(mag),
    place: String(place),
    time: Date.now() - (index + 1) * 3_700_000,
    updated: Date.now() - index * 3_600_000,
    url: "https://earthquake.usgs.gov/earthquakes/map/",
    felt: index % 3 === 0 ? 18 + index * 7 : null,
    cdi: null,
    mmi: null,
    alert: Number(mag) >= 6 ? "green" : null,
    status: "sample",
    tsunami: Number(mag) >= 6 ? 1 : 0,
    sig: Math.round(Number(mag) * 100),
    net: "sample",
    code: `offline-${index + 1}`,
    nst: null,
    dmin: null,
    rms: null,
    gap: null,
    magType: "mw",
    type: "earthquake",
  },
  geometry: { type: "Point" as const, coordinates: [Number(lon), Number(lat), Number(depth)] },
}));

function formatDate(time: number, compact = false) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(compact ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(time));
}

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(3)}°${value >= 0 ? positive : negative}`;
}

function magnitudeColor(mag: number) {
  if (mag >= 7) return "#ff3d72";
  if (mag >= 6) return "#ff6549";
  if (mag >= 5) return "#ff9f43";
  return "#ffd166";
}

function magnitudeLabel(mag: number | null) {
  return mag == null ? "—" : mag.toFixed(1);
}

function deduplicateEvents(groups: QuakeFeature[][]) {
  return Array.from(new Map(groups.flat().map((event) => [event.id, event])).values());
}

function buildQuery(
  start: string,
  end: string,
  minMagnitude: number,
  bounds?: Bounds,
  limit = 2000,
) {
  const params = new URLSearchParams({
    format: "geojson",
    starttime: start,
    endtime: end,
    minmagnitude: minMagnitude.toString(),
    orderby: "magnitude",
    limit: limit.toString(),
  });
  if (bounds) {
    params.set("minlongitude", bounds[0].toString());
    params.set("minlatitude", bounds[1].toString());
    params.set("maxlongitude", bounds[2].toString());
    params.set("maxlatitude", bounds[3].toString());
  }
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${params.toString()}`;
}

function StatusPill({ state }: { state: DataState }) {
  const labels: Record<DataState, string> = {
    loading: "Connecting",
    live: "Live · USGS",
    historical: "Catalog · USGS",
    fallback: "Offline sample",
    error: "Data unavailable",
  };
  return (
    <span className={`status-pill status-${state}`} role="status">
      <span className="status-dot" aria-hidden="true" />
      {labels[state]}
    </span>
  );
}

export default function SeismicDashboard() {
  const [mode, setMode] = useState<ViewMode>("live");
  const [events, setEvents] = useState<QuakeFeature[]>(FALLBACK_EVENTS);
  const [dataState, setDataState] = useState<DataState>("loading");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string>(FALLBACK_EVENTS[0].id);
  const [selectedDetail, setSelectedDetail] = useState<QuakeFeature | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [mapZoom, setMapZoom] = useState({ cx: WIDTH / 2, cy: HEIGHT / 2, zoom: 1 });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"time" | "magnitude" | "depth">("time");
  const [showCount, setShowCount] = useState(12);
  const [decade, setDecade] = useState(2016);
  const [regionId, setRegionId] = useState("ring-of-fire");
  const [historyMinMag, setHistoryMinMag] = useState(5);
  const [appliedHistory, setAppliedHistory] = useState({
    decade: 2016,
    regionId: "ring-of-fire",
    minMagnitude: 5,
  });

  const selectedSummary = useMemo(
    () => events.find((event) => event.id === selectedId) ?? events[0] ?? null,
    [events, selectedId],
  );
  const selected = selectedDetail ?? selectedSummary;
  const selectedDetailUrl = selectedSummary?.properties.detail;

  const activeRegion = useMemo(
    () => REGIONS.find((region) => region.id === regionId) ?? REGIONS[0],
    [regionId],
  );

  const filteredEvents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = needle
      ? events.filter((event) =>
          `${event.properties.place ?? ""} ${event.id}`.toLowerCase().includes(needle),
        )
      : [...events];
    return result.sort((a, b) => {
      if (sort === "magnitude") return (b.properties.mag ?? 0) - (a.properties.mag ?? 0);
      if (sort === "depth") return a.geometry.coordinates[2] - b.geometry.coordinates[2];
      return b.properties.time - a.properties.time;
    });
  }, [events, search, sort]);

  const stats = useMemo(() => {
    if (!events.length) return { largest: null, shallowest: null, tsunami: 0, strong: 0 };
    return {
      largest: events.reduce((a, b) => ((a.properties.mag ?? 0) > (b.properties.mag ?? 0) ? a : b)),
      shallowest: events.reduce((a, b) =>
        a.geometry.coordinates[2] < b.geometry.coordinates[2] ? a : b,
      ),
      tsunami: events.filter((event) => event.properties.tsunami === 1).length,
      strong: events.filter((event) => (event.properties.mag ?? 0) >= 6).length,
    };
  }, [events]);

  const distribution = useMemo(
    () => [
      { label: "4.0–4.9", count: events.filter((e) => (e.properties.mag ?? 0) < 5).length },
      {
        label: "5.0–5.9",
        count: events.filter((e) => (e.properties.mag ?? 0) >= 5 && (e.properties.mag ?? 0) < 6)
          .length,
      },
      { label: "6.0–6.9", count: events.filter((e) => (e.properties.mag ?? 0) >= 6 && (e.properties.mag ?? 0) < 7).length },
      { label: "7.0+", count: events.filter((e) => (e.properties.mag ?? 0) >= 7).length },
    ],
    [events],
  );

  const maxDistribution = Math.max(...distribution.map((item) => item.count), 1);

  const loadLive = useCallback(async (signal?: AbortSignal) => {
    setDataState("loading");
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    try {
      const response = await fetch(
        buildQuery(start.toISOString(), end.toISOString(), 4, undefined, 2000).replace(
          "orderby=magnitude",
          "orderby=time",
        ),
        { signal },
      );
      if (!response.ok) throw new Error(`USGS response ${response.status}`);
      const collection = (await response.json()) as QuakeCollection;
      setEvents(collection.features);
      setSelectedId((current) =>
        collection.features.some((event) => event.id === current)
          ? current
          : collection.features[0]?.id ?? "",
      );
      setSelectedDetail(null);
      setLastUpdated(collection.metadata?.generated ?? Date.now());
      setDataState("live");
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setEvents(FALLBACK_EVENTS);
      setSelectedId(FALLBACK_EVENTS[0].id);
      setLastUpdated(null);
      setDataState("fallback");
    }
  }, []);

  useEffect(() => {
    if (mode !== "live") return;
    const controller = new AbortController();
    const kickoff = window.setTimeout(() => loadLive(controller.signal), 0);
    const refresh = window.setInterval(() => loadLive(), 5 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearTimeout(kickoff);
      window.clearInterval(refresh);
    };
  }, [loadLive, mode]);

  useEffect(() => {
    if (mode !== "history") return;
    const controller = new AbortController();
    const run = async () => {
      setDataState("loading");
      const region = REGIONS.find((item) => item.id === appliedHistory.regionId) ?? REGIONS[0];
      const startDate = `${appliedHistory.decade}-01-01`;
      const decadeEnd = new Date(Date.UTC(appliedHistory.decade + 10, 0, 1));
      const now = new Date();
      const endDate = (decadeEnd > now ? now : decadeEnd).toISOString().slice(0, 10);
      try {
        const urls = region.global
          ? [buildQuery(startDate, endDate, appliedHistory.minMagnitude, undefined, 2000)]
          : region.windows.map((bounds) =>
              buildQuery(
                startDate,
                endDate,
                appliedHistory.minMagnitude,
                bounds,
                region.id === "ring-of-fire" ? 500 : 2000,
              ),
            );
        const responses = await Promise.all(urls.map((url) => fetch(url, { signal: controller.signal })));
        if (responses.some((response) => !response.ok)) throw new Error("Historical query failed");
        const collections = (await Promise.all(
          responses.map((response) => response.json()),
        )) as QuakeCollection[];
        const combined = deduplicateEvents(collections.map((collection) => collection.features)).sort(
          (a, b) => (b.properties.mag ?? 0) - (a.properties.mag ?? 0),
        );
        setEvents(combined);
        setSelectedId(combined[0]?.id ?? "");
        setSelectedDetail(null);
        setLastUpdated(Date.now());
        setDataState("historical");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setEvents([]);
        setSelectedId("");
        setDataState("error");
      }
    };
    run();
    return () => controller.abort();
  }, [appliedHistory, mode]);

  useEffect(() => {
    if (!selectedDetailUrl || selectedId.startsWith("sample-")) return;
    const controller = new AbortController();
    const kickoff = window.setTimeout(() => {
      setDetailLoading(true);
      fetch(selectedDetailUrl, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("detail"))))
        .then((detail: QuakeFeature) => setSelectedDetail(detail))
        .catch((error) => {
          if ((error as Error).name !== "AbortError") setSelectedDetail(null);
        })
        .finally(() => setDetailLoading(false));
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(kickoff);
    };
  }, [selectedDetailUrl, selectedId]);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const nextMode = params.get("view");
      const nextRegion = params.get("region");
      const nextDecade = Number(params.get("decade"));
      if (nextMode === "history") setMode("history");
      if (REGIONS.some((region) => region.id === nextRegion)) {
        setRegionId(nextRegion!);
        setAppliedHistory((current) => ({ ...current, regionId: nextRegion! }));
      }
      if (nextDecade >= 1876 && nextDecade <= 2016 && (nextDecade - 1876) % 10 === 0) {
        setDecade(nextDecade);
        setAppliedHistory((current) => ({ ...current, decade: nextDecade }));
      }
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("view", mode);
    if (mode === "history") {
      params.set("region", appliedHistory.regionId);
      params.set("decade", appliedHistory.decade.toString());
      params.set("minmag", appliedHistory.minMagnitude.toString());
    } else {
      params.delete("region");
      params.delete("decade");
      params.delete("minmag");
    }
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, [appliedHistory, mode]);

  const focusEvent = (event: QuakeFeature, zoom = true) => {
    setSelectedId(event.id);
    setSelectedDetail(null);
    if (zoom) {
      const point = projection([event.geometry.coordinates[0], event.geometry.coordinates[1]]);
      if (point) setMapZoom({ cx: point[0], cy: point[1], zoom: 2.25 });
    }
  };

  const selectRelative = (direction: number) => {
    if (!filteredEvents.length) return;
    const index = Math.max(0, filteredEvents.findIndex((event) => event.id === selectedId));
    focusEvent(filteredEvents[(index + direction + filteredEvents.length) % filteredEvents.length]);
  };

  const changeMode = (nextMode: ViewMode) => {
    setMode(nextMode);
    setMapZoom({ cx: WIDTH / 2, cy: HEIGHT / 2, zoom: 1 });
    setSearch("");
    setShowCount(12);
  };

  const downloadGeoJSON = () => {
    const collection: QuakeCollection = { type: "FeatureCollection", features: filteredEvents };
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `seismic-atlas-${mode}-${new Date().toISOString().slice(0, 10)}.geojson`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const mapView = useMemo(() => {
    const viewWidth = WIDTH / mapZoom.zoom;
    const viewHeight = HEIGHT / mapZoom.zoom;
    const x = Math.max(0, Math.min(WIDTH - viewWidth, mapZoom.cx - viewWidth / 2));
    const y = Math.max(0, Math.min(HEIGHT - viewHeight, mapZoom.cy - viewHeight / 2));
    return `${x} ${y} ${viewWidth} ${viewHeight}`;
  }, [mapZoom]);

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Seismic Atlas home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>SEISMIC</strong>
            <small>ATLAS</small>
          </span>
        </a>
        <nav className="view-nav" aria-label="Primary views">
          <button className={mode === "live" ? "active" : ""} onClick={() => changeMode("live")}>
            Live activity
          </button>
          <button className={mode === "history" ? "active" : ""} onClick={() => changeMode("history")}>
            Historical explorer
          </button>
          <a href="#methods">Method &amp; sources</a>
        </nav>
        <div className="topbar-meta">
          <StatusPill state={dataState} />
          <span className="utc-clock">UTC · {new Date().toISOString().slice(11, 16)}</span>
        </div>
      </header>

      <section id="top" className="intro wrap">
        <div>
          <p className="eyebrow">Global seismic intelligence</p>
          <h1>{mode === "live" ? "Earth in motion, right now." : "150 years of seismic history."}</h1>
          <p className="intro-copy">
            {mode === "live"
              ? "Every globally reported earthquake of magnitude 4.0 or greater during the past seven days — mapped, searchable, and ready for close inspection."
              : "Move through ten-year windows from 1876 to today. Compare plate margins, fault systems, and subduction zones without losing event-level evidence."}
          </p>
        </div>
        <div className="intro-note">
          <span>{mode === "live" ? "7-day rolling window" : "10-year catalog windows"}</span>
          <strong>{events.length.toLocaleString()}</strong>
          <small>{mode === "live" ? "events plotted at M4.0+" : "events in current query"}</small>
        </div>
      </section>

      {mode === "history" && (
        <section className="history-lab wrap" aria-labelledby="history-title">
          <div className="history-heading">
            <div>
              <p className="section-kicker">Historical mapping lab</p>
              <h2 id="history-title">Choose a decade and tectonic lens</h2>
            </div>
            <p>
              Earlier catalogs are less complete, especially for smaller earthquakes. Raise the magnitude
              floor for consistent long-range comparisons.
            </p>
          </div>
          <div className="history-controls">
            <label className="decade-control">
              <span>
                Decade window <strong>{decade}–{Math.min(decade + 9, new Date().getUTCFullYear())}</strong>
              </span>
              <input
                type="range"
                min="1876"
                max="2016"
                step="10"
                value={decade}
                onChange={(event) => setDecade(Number(event.target.value))}
              />
              <span className="range-labels"><em>1876</em><em>Present</em></span>
            </label>
            <label>
              <span>Geographic lens</span>
              <select value={regionId} onChange={(event) => setRegionId(event.target.value)}>
                {REGIONS.map((region) => (
                  <option key={region.id} value={region.id}>{region.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Minimum magnitude</span>
              <select value={historyMinMag} onChange={(event) => setHistoryMinMag(Number(event.target.value))}>
                <option value="4">M4.0+ · broad</option>
                <option value="4.5">M4.5+</option>
                <option value="5">M5.0+ · recommended</option>
                <option value="5.5">M5.5+ · long-range</option>
                <option value="6">M6.0+ · major</option>
              </select>
            </label>
            <button
              className="primary-button"
              onClick={() => setAppliedHistory({ decade, regionId, minMagnitude: historyMinMag })}
            >
              Map this decade
            </button>
          </div>
          <div className="active-lens">
            <span>Active lens</span>
            <strong>{activeRegion.name}</strong>
            <p>{activeRegion.description}</p>
          </div>
        </section>
      )}

      <section className="workspace wrap" aria-label="Earthquake map and event details">
        <div className="map-card">
          <div className="map-toolbar">
            <div>
              <p className="section-kicker">{mode === "live" ? "Current activity" : "Catalog result"}</p>
              <h2>{mode === "live" ? "Global M4.0+ earthquakes" : `${appliedHistory.decade}–${Math.min(appliedHistory.decade + 9, new Date().getUTCFullYear())} · ${(REGIONS.find((r) => r.id === appliedHistory.regionId) ?? REGIONS[0]).short}`}</h2>
            </div>
            <div className="map-actions">
              <button
                className={showBoundaries ? "toggle active" : "toggle"}
                aria-pressed={showBoundaries}
                onClick={() => setShowBoundaries((value) => !value)}
              >
                Plate &amp; fault context
              </button>
              <div className="zoom-group" aria-label="Map zoom controls">
                <button aria-label="Zoom out" onClick={() => setMapZoom((v) => ({ ...v, zoom: Math.max(1, v.zoom / 1.4) }))}>−</button>
                <button aria-label="Reset map" onClick={() => setMapZoom({ cx: WIDTH / 2, cy: HEIGHT / 2, zoom: 1 })}>Reset</button>
                <button aria-label="Zoom in" onClick={() => setMapZoom((v) => ({ ...v, zoom: Math.min(4, v.zoom * 1.4) }))}>+</button>
              </div>
            </div>
          </div>

          <div className="map-frame">
            <p id="map-description" className="sr-only">
              Interactive equirectangular world map. Earthquakes are sized and colored by magnitude.
              Select a marker for event details. Use previous and next controls for dense regions.
            </p>
            <svg
              className="world-map"
              viewBox={mapView}
              role="group"
              aria-labelledby="map-title map-description"
              preserveAspectRatio="xMidYMid meet"
            >
              <title id="map-title">Mapped earthquake events</title>
              <rect width={WIDTH} height={HEIGHT} className="ocean" />
              <path d={graticulePath} className="graticule" />
              <path d={landPath} className="land" />
              {mode === "history" &&
                (REGIONS.find((region) => region.id === appliedHistory.regionId)?.windows ?? []).map(
                  (bounds, index) => {
                    const rect = regionRect(bounds);
                    return rect ? <rect key={`${bounds.join("-")}-${index}`} {...rect} className="query-window" /> : null;
                  },
                )}
              {showBoundaries && (
                <g className="boundary-layer" aria-label="Schematic plate and fault context">
                  {BOUNDARY_LINES.map((line) => (
                    <path key={line.name} d={projectedLine(line.points)}>
                      <title>{line.name} — schematic location</title>
                    </path>
                  ))}
                </g>
              )}
              <g className="quake-layer">
                {events.map((event) => {
                  const [lon, lat] = event.geometry.coordinates;
                  const projected = projection([lon, lat]);
                  const mag = event.properties.mag ?? 0;
                  if (!projected) return null;
                  const radius = 3.2 + Math.max(0, mag - 4) * 2.25;
                  const isSelected = event.id === selectedId;
                  return (
                    <g
                      key={event.id}
                      className={isSelected ? "quake selected" : "quake"}
                      transform={`translate(${projected[0]} ${projected[1]})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Magnitude ${magnitudeLabel(event.properties.mag)}, ${event.properties.place ?? "unknown location"}, depth ${event.geometry.coordinates[2].toFixed(1)} kilometers`}
                      onClick={() => focusEvent(event)}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                          keyboardEvent.preventDefault();
                          focusEvent(event);
                        }
                      }}
                    >
                      {isSelected && <circle r={radius + 6} className="selection-ring" />}
                      <circle r={radius} fill={magnitudeColor(mag)} className="quake-dot" />
                      {mag >= 6 && <circle r={radius + 2.5} className="strong-ring" />}
                      <title>M{magnitudeLabel(event.properties.mag)} · {event.properties.place}</title>
                    </g>
                  );
                })}
              </g>
            </svg>
            <div className="map-legend" aria-label="Magnitude color legend">
              {[4, 5, 6, 7].map((value) => (
                <span key={value}><i style={{ background: magnitudeColor(value) }} />M{value}{value === 7 ? "+" : ""}</span>
              ))}
            </div>
            <div className="map-caption">
              <span>Equirectangular projection · WGS84 event coordinates</span>
              <span>Depth encoded in details, not symbol size</span>
            </div>
          </div>

          <div className="map-stepper">
            <button onClick={() => selectRelative(-1)} aria-label="Select previous visible event">← Previous</button>
            <span>{selected ? `Selected: M${magnitudeLabel(selected.properties.mag)} · ${selected.properties.place}` : "No event selected"}</span>
            <button onClick={() => selectRelative(1)} aria-label="Select next visible event">Next →</button>
          </div>
        </div>

        <aside className="event-inspector" aria-live="polite">
          {selected ? (
            <>
              <div className="inspector-head">
                <span className="magnitude-badge" style={{ borderColor: magnitudeColor(selected.properties.mag ?? 0) }}>
                  <small>MAG</small>
                  {magnitudeLabel(selected.properties.mag)}
                </span>
                <div>
                  <p>{selected.properties.type ?? "earthquake"}</p>
                  <h2>{selected.properties.place ?? "Unknown location"}</h2>
                </div>
              </div>
              <div className="event-time">
                <strong>{formatDate(selected.properties.time)}</strong>
                <span>UTC · {new Date(selected.properties.time).toISOString().slice(11, 19)}</span>
              </div>
              <dl className="detail-grid">
                <div><dt>Depth</dt><dd>{selected.geometry.coordinates[2].toFixed(1)} km</dd></div>
                <div><dt>Magnitude type</dt><dd>{selected.properties.magType?.toUpperCase() ?? "—"}</dd></div>
                <div><dt>Latitude</dt><dd>{formatCoordinate(selected.geometry.coordinates[1], "N", "S")}</dd></div>
                <div><dt>Longitude</dt><dd>{formatCoordinate(selected.geometry.coordinates[0], "E", "W")}</dd></div>
                <div><dt>Felt reports</dt><dd>{selected.properties.felt?.toLocaleString() ?? "None"}</dd></div>
                <div><dt>Significance</dt><dd>{selected.properties.sig ?? "—"}</dd></div>
              </dl>
              <div className="impact-row">
                <span className={selected.properties.tsunami ? "impact active" : "impact"}>
                  Tsunami flag <strong>{selected.properties.tsunami ? "Yes" : "No"}</strong>
                </span>
                <span className={`impact alert-${selected.properties.alert ?? "none"}`}>
                  PAGER alert <strong>{selected.properties.alert?.toUpperCase() ?? "None"}</strong>
                </span>
              </div>
              <details className="technical-details" open>
                <summary>Location quality &amp; source</summary>
                <dl>
                  <div><dt>Stations used</dt><dd>{selected.properties.nst ?? "—"}</dd></div>
                  <div><dt>Azimuthal gap</dt><dd>{selected.properties.gap != null ? `${selected.properties.gap.toFixed(1)}°` : "—"}</dd></div>
                  <div><dt>RMS travel-time residual</dt><dd>{selected.properties.rms != null ? `${selected.properties.rms.toFixed(2)} s` : "—"}</dd></div>
                  <div><dt>Nearest-station distance</dt><dd>{selected.properties.dmin != null ? `${selected.properties.dmin.toFixed(2)}°` : "—"}</dd></div>
                  <div><dt>Horizontal uncertainty</dt><dd>{selected.properties.horizontalError != null ? `${selected.properties.horizontalError.toFixed(1)} km` : detailLoading ? "Loading…" : "—"}</dd></div>
                  <div><dt>Depth uncertainty</dt><dd>{selected.properties.depthError != null ? `${selected.properties.depthError.toFixed(1)} km` : detailLoading ? "Loading…" : "—"}</dd></div>
                  <div><dt>Review status</dt><dd>{selected.properties.status}</dd></div>
                  <div><dt>Event ID</dt><dd className="mono">{selected.id}</dd></div>
                </dl>
              </details>
              <a className="usgs-link" href={selected.properties.url} target="_blank" rel="noreferrer">
                Open complete USGS event record <span aria-hidden="true">↗</span>
              </a>
            </>
          ) : (
            <div className="empty-inspector"><h2>No event in this query</h2><p>Try a wider geographic lens or a lower magnitude floor.</p></div>
          )}
        </aside>
      </section>

      <section className="metrics wrap" aria-label="Activity summary">
        <article>
          <span>Events mapped</span>
          <strong>{events.length.toLocaleString()}</strong>
          <small>{mode === "live" ? "Past 7 days · M4.0+" : "Current historical query"}</small>
        </article>
        <article>
          <span>Largest event</span>
          <strong>{stats.largest ? `M${magnitudeLabel(stats.largest.properties.mag)}` : "—"}</strong>
          <small>{stats.largest?.properties.place ?? "No data"}</small>
        </article>
        <article>
          <span>Shallowest focus</span>
          <strong>{stats.shallowest ? `${stats.shallowest.geometry.coordinates[2].toFixed(1)} km` : "—"}</strong>
          <small>{stats.shallowest?.properties.place ?? "No data"}</small>
        </article>
        <article>
          <span>Strong / tsunami flags</span>
          <strong>{stats.strong} / {stats.tsunami}</strong>
          <small>M6.0+ events / source-issued flags</small>
        </article>
        <article className="distribution-card">
          <span>Magnitude distribution</span>
          <div className="distribution-bars">
            {distribution.map((item, index) => (
              <div key={item.label}>
                <em>{item.label}</em>
                <i><b style={{ width: `${(item.count / maxDistribution) * 100}%`, background: magnitudeColor(index + 4) }} /></i>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="catalog wrap" aria-labelledby="catalog-title">
        <div className="catalog-heading">
          <div>
            <p className="section-kicker">Event catalog</p>
            <h2 id="catalog-title">Inspect every mapped event</h2>
            <p>All {events.length.toLocaleString()} results are plotted. Search the catalog or sort the list below.</p>
          </div>
          <button className="download-button" onClick={downloadGeoJSON} disabled={!events.length}>
            Download GeoJSON
          </button>
        </div>
        <div className="catalog-controls">
          <label className="search-box">
            <span className="sr-only">Search events by location or event ID</span>
            <input value={search} onChange={(event) => { setSearch(event.target.value); setShowCount(12); }} placeholder="Search location or event ID…" />
          </label>
          <label className="sort-box">
            <span>Sort by</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              <option value="time">Most recent</option>
              <option value="magnitude">Largest magnitude</option>
              <option value="depth">Shallowest depth</option>
            </select>
          </label>
        </div>
        <div className="event-table" role="table" aria-label="Earthquake events">
          <div className="event-row table-header" role="row">
            <span role="columnheader">Magnitude</span><span role="columnheader">Location</span><span role="columnheader">Time · UTC</span><span role="columnheader">Depth</span><span role="columnheader">Coordinates</span><span />
          </div>
          {filteredEvents.slice(0, showCount).map((event) => (
            <button key={event.id} className={event.id === selectedId ? "event-row active" : "event-row"} role="row" onClick={() => { focusEvent(event); document.querySelector(".workspace")?.scrollIntoView({ behavior: "smooth" }); }}>
              <span role="cell"><i style={{ background: magnitudeColor(event.properties.mag ?? 0) }} />M{magnitudeLabel(event.properties.mag)}</span>
              <span role="cell"><strong>{event.properties.place ?? "Unknown location"}</strong><small>{event.properties.type}</small></span>
              <span role="cell">{formatDate(event.properties.time, true)}</span>
              <span role="cell">{event.geometry.coordinates[2].toFixed(1)} km</span>
              <span role="cell" className="mono">{event.geometry.coordinates[1].toFixed(2)}, {event.geometry.coordinates[0].toFixed(2)}</span>
              <span role="cell" aria-hidden="true">↗</span>
            </button>
          ))}
          {!filteredEvents.length && <div className="no-results">No events match this search.</div>}
        </div>
        {showCount < filteredEvents.length && (
          <button className="load-more" onClick={() => setShowCount((count) => count + 20)}>
            Show 20 more · {filteredEvents.length - showCount} remaining
          </button>
        )}
      </section>

      <section id="methods" className="methods wrap" aria-labelledby="methods-title">
        <div className="methods-intro">
          <p className="section-kicker">Method &amp; source ledger</p>
          <h2 id="methods-title">What you are looking at</h2>
          <p>
            The map distinguishes measured event records from schematic tectonic context. Catalog coverage
            and detection thresholds change substantially over 150 years, so absence of older small events
            does not mean absence of earthquakes.
          </p>
        </div>
        <div className="ledger-grid">
          <article>
            <span>Measured layer</span>
            <h3>Earthquake events</h3>
            <p>USGS ANSS Comprehensive Earthquake Catalog (ComCat), requested as GeoJSON through the FDSN event service.</p>
            <dl><div><dt>Coordinates</dt><dd>WGS84 lon / lat</dd></div><div><dt>Depth</dt><dd>Kilometers below surface reference</dd></div><div><dt>Live cadence</dt><dd>Refresh every 5 minutes</dd></div></dl>
          </article>
          <article>
            <span>Schematic layer</span>
            <h3>Tectonic context</h3>
            <p>Generalized plate-margin and named fault-zone traces are orientation aids, not survey-grade boundaries or hazard forecasts.</p>
            <dl><div><dt>Projection</dt><dd>Equirectangular</dd></div><div><dt>Wrap policy</dt><dd>±180° antimeridian windows</dd></div><div><dt>Symbol area</dt><dd>Magnitude cue only</dd></div></dl>
          </article>
          <article>
            <span>Coverage policy</span>
            <h3>Historical queries</h3>
            <p>Ten-year, geography-bounded requests limit overplotting and service load. Global and composite views may be capped; exports contain the returned set.</p>
            <dl><div><dt>Start</dt><dd>1876</dd></div><div><dt>Step</dt><dd>10 years</dd></div><div><dt>Recommended floor</dt><dd>M5.0+</dd></div></dl>
          </article>
        </div>
        <div className="source-links">
          <a href="https://earthquake.usgs.gov/fdsnws/event/1/" target="_blank" rel="noreferrer">USGS FDSN event API ↗</a>
          <a href="https://earthquake.usgs.gov/data/comcat/" target="_blank" rel="noreferrer">ComCat documentation ↗</a>
          <a href="https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php" target="_blank" rel="noreferrer">GeoJSON field definitions ↗</a>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="brand footer-brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span><strong>SEISMIC</strong><small>ATLAS</small></span></div>
          <p>Independent exploration interface using authoritative USGS catalog data. Not an emergency alert service or hazard forecast.</p>
          <span>Last source update: {lastUpdated ? `${formatDate(lastUpdated)} UTC` : dataState === "fallback" ? "offline sample" : "pending"}</span>
        </div>
      </footer>
    </main>
  );
}
