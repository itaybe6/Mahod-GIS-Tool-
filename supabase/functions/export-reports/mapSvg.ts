import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

/**
 * Build an inline SVG visualization of the analyzed polygon, with a real
 * OpenStreetMap tile basemap baked in as base64 PNGs.
 *
 * The output is a single self-contained `<svg>` string: when embedded in the
 * HTML report it does NOT require network access at view-time (all tile
 * pixels are inline). Falls back to a gradient + grid SVG if tile fetching
 * fails (offline / OSM throttling / timeout).
 *
 * Usage policy: https://operations.osmfoundation.org/policies/tiles/
 *  - We use a descriptive User-Agent.
 *  - Only a handful of tiles are fetched per report (no bulk downloading).
 *  - "© OpenStreetMap contributors" is shown on the map.
 */

type LngLat = [number, number];

interface PolygonRing {
  outer: LngLat[];
  holes: LngLat[][];
}

interface Bbox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

/** Raw GeoJSON-ish feature — only the parts we use to draw on the map. */
export interface MapFeature {
  geometry: unknown;
  properties?: Record<string, unknown>;
}

/**
 * Per-layer features overlaid on top of the OSM basemap. Match the same palette
 * used by the live Leaflet/Mapbox views so the report matches the on-screen map.
 */
export interface MapLayerFeatures {
  publicTransport?: MapFeature[];
  accidents?: MapFeature[];
  roads?: MapFeature[];
}

const TILE_SIZE = 256;
const VIEW_W = 720;
const VIEW_H = 380;
const PAD = 36;
const TILE_TIMEOUT_MS = 8000;
const MAX_TILES = 25;
const TILE_USER_AGENT = 'mahod-gis-export-reports/1.0 (+https://mahod.co.il)';
const TILE_SUBDOMAINS = ['a', 'b', 'c'] as const;

const COLOR_TRANSIT = '#10b981';
const COLOR_ACCIDENTS = '#ef4444';
const COLOR_ROADS = '#f59e0b';
const COLOR_POLYGON = '#1a6fb5';

const MAX_RENDER_STOPS = 800;
const MAX_RENDER_ACCIDENTS = 1500;
const MAX_RENDER_ROAD_SEGMENTS = 800;

function isLngLat(v: unknown): v is LngLat {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

function asRing(raw: unknown): LngLat[] {
  if (!Array.isArray(raw)) return [];
  const out: LngLat[] = [];
  for (const c of raw) {
    if (isLngLat(c)) out.push([c[0], c[1]]);
  }
  return out;
}

function geometryToRings(geometry: unknown): PolygonRing[] {
  if (!geometry || typeof geometry !== 'object') return [];
  const g = geometry as { type?: string; coordinates?: unknown };

  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    const rings = g.coordinates as unknown[];
    if (rings.length === 0) return [];
    const outer = asRing(rings[0]);
    if (outer.length < 3) return [];
    const holes = rings.slice(1).map(asRing).filter((r) => r.length >= 3);
    return [{ outer, holes }];
  }

  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    const polys = g.coordinates as unknown[];
    const out: PolygonRing[] = [];
    for (const p of polys) {
      if (!Array.isArray(p) || p.length === 0) continue;
      const outer = asRing(p[0]);
      if (outer.length < 3) continue;
      const holes = p.slice(1).map(asRing).filter((r) => r.length >= 3);
      out.push({ outer, holes });
    }
    return out;
  }

  return [];
}

function computeBbox(rings: PolygonRing[]): Bbox | null {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let any = false;
  for (const r of rings) {
    for (const [lng, lat] of r.outer) {
      any = true;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!any) return null;
  return { minLng, maxLng, minLat, maxLat };
}

/** Web Mercator: lng/lat → world pixel at given zoom (origin at top-left, +y down). */
function lngLatToWorldPx(lng: number, lat: number, z: number): [number, number] {
  const n = TILE_SIZE * Math.pow(2, z);
  const x = ((lng + 180) / 360) * n;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const yRatio = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  const y = yRatio * n;
  return [x, y];
}

function chooseZoom(bbox: Bbox): number {
  const availW = VIEW_W - 2 * PAD;
  const availH = VIEW_H - 2 * PAD;
  for (let z = 18; z >= 0; z -= 1) {
    const [x0, y0] = lngLatToWorldPx(bbox.minLng, bbox.maxLat, z);
    const [x1, y1] = lngLatToWorldPx(bbox.maxLng, bbox.minLat, z);
    if (x1 - x0 <= availW && y1 - y0 <= availH) return z;
  }
  return 0;
}

async function fetchTileAsDataUrl(
  z: number,
  x: number,
  y: number,
  signal: AbortSignal
): Promise<string> {
  const n = Math.pow(2, z);
  const wrappedX = ((x % n) + n) % n;
  const sub = TILE_SUBDOMAINS[((wrappedX + y) % 3 + 3) % 3]!;
  const url = `https://${sub}.tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`;
  const res = await fetch(url, {
    signal,
    headers: { 'User-Agent': TILE_USER_AGENT, Accept: 'image/png,image/*' },
  });
  if (!res.ok) throw new Error(`tile ${z}/${wrappedX}/${y}: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return `data:image/png;base64,${encodeBase64(buf)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ringToPath(ring: LngLat[], project: (lng: number, lat: number) => [number, number]): string {
  let d = '';
  for (let i = 0; i < ring.length; i += 1) {
    const pt = ring[i]!;
    const [x, y] = project(pt[0], pt[1]);
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d.trim()} Z`;
}

function lineToPath(
  coords: unknown,
  project: (lng: number, lat: number) => [number, number]
): string {
  if (!Array.isArray(coords) || coords.length < 2) return '';
  let d = '';
  let started = false;
  for (const c of coords) {
    if (!isLngLat(c)) continue;
    const [x, y] = project(c[0], c[1]);
    d += `${started ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)} `;
    started = true;
  }
  return d.trim();
}

function buildPointsSvg(
  features: MapFeature[] | undefined,
  cap: number,
  project: (lng: number, lat: number) => [number, number],
  fill: string,
  radius: number
): string {
  if (!features || features.length === 0) return '';
  const max = Math.min(features.length, cap);
  const dots: string[] = [];
  for (let i = 0; i < max; i += 1) {
    const f = features[i]!;
    const g = f.geometry as { type?: string; coordinates?: unknown } | null | undefined;
    if (!g || g.type !== 'Point' || !isLngLat(g.coordinates)) continue;
    const [x, y] = project(g.coordinates[0], g.coordinates[1]);
    if (x < -8 || x > VIEW_W + 8 || y < -8 || y > VIEW_H + 8) continue;
    dots.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius}"/>`);
  }
  if (dots.length === 0) return '';
  return `<g fill="${fill}" stroke="#ffffff" stroke-width="0.9" fill-opacity="0.95">${dots.join('')}</g>`;
}

function buildRoadsSvg(
  features: MapFeature[] | undefined,
  cap: number,
  project: (lng: number, lat: number) => [number, number]
): string {
  if (!features || features.length === 0) return '';
  const segments: string[] = [];
  let segCount = 0;
  for (const f of features) {
    if (segCount >= cap) break;
    const g = f.geometry as { type?: string; coordinates?: unknown } | null | undefined;
    if (!g) continue;
    if (g.type === 'LineString') {
      const d = lineToPath(g.coordinates, project);
      if (d) {
        segments.push(d);
        segCount += 1;
      }
    } else if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
      for (const ls of g.coordinates as unknown[]) {
        if (segCount >= cap) break;
        const d = lineToPath(ls, project);
        if (d) {
          segments.push(d);
          segCount += 1;
        }
      }
    }
  }
  if (segments.length === 0) return '';
  return `<g stroke="${COLOR_ROADS}" stroke-width="2.2" fill="none" opacity="0.9" stroke-linecap="round" stroke-linejoin="round"><path d="${segments.join(' ')}"/></g>`;
}

function buildLegendSvg(features: MapLayerFeatures): string {
  const items: Array<{ color: string; label: string; shape: 'dot' | 'line' }> = [];
  if (features.publicTransport && features.publicTransport.length > 0) {
    items.push({ color: COLOR_TRANSIT, label: 'תחנות תחבורה ציבורית', shape: 'dot' });
  }
  if (features.accidents && features.accidents.length > 0) {
    items.push({ color: COLOR_ACCIDENTS, label: 'תאונות', shape: 'dot' });
  }
  if (features.roads && features.roads.length > 0) {
    items.push({ color: COLOR_ROADS, label: 'דרכים', shape: 'line' });
  }
  items.push({ color: COLOR_POLYGON, label: 'אזור הניתוח', shape: 'line' });
  if (items.length === 0) return '';

  const w = 200;
  const lineH = 18;
  const h = 14 + items.length * lineH;
  const x0 = 12;
  const y0 = 12;
  const swatchCx = x0 + w - 18;
  const textX = x0 + w - 30;
  const rows = items
    .map((it, i) => {
      const cy = y0 + 24 + i * lineH;
      const swatch =
        it.shape === 'dot'
          ? `<circle cx="${swatchCx}" cy="${cy - 4}" r="4" fill="${it.color}" stroke="#ffffff" stroke-width="0.8"/>`
          : `<rect x="${swatchCx - 8}" y="${cy - 6}" width="16" height="3" fill="${it.color}"/>`;
      return `${swatch}<text x="${textX}" y="${cy}" text-anchor="start" direction="rtl" font-size="11" fill="#1f2933">${escapeXml(it.label)}</text>`;
    })
    .join('');

  return `<g font-family="Rubik, Heebo, Arial, sans-serif">
    <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="6" fill="#ffffff" fill-opacity="0.94" stroke="#dfe4ea"/>
    ${rows}
  </g>`;
}

function fmtCoord(n: number): string {
  return n.toFixed(4);
}

/** Gradient + grid fallback when tile fetching fails (offline / OSM down). */
function buildFallbackSvg(rings: PolygonRing[], bbox: Bbox, areaKm2: number): string {
  const { minLng, maxLng, minLat, maxLat } = bbox;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const bx0 = minLng * cosLat;
  const bx1 = maxLng * cosLat;
  const rangeX = bx1 - bx0;
  const rangeY = maxLat - minLat;
  if (rangeX <= 0 || rangeY <= 0) return '';
  const availW = VIEW_W - 2 * PAD;
  const availH = VIEW_H - 2 * PAD;
  const scale = Math.min(availW / rangeX, availH / rangeY);
  const drawnW = rangeX * scale;
  const drawnH = rangeY * scale;
  const offsetX = (VIEW_W - drawnW) / 2;
  const offsetY = (VIEW_H - drawnH) / 2;
  const project = (lng: number, lat: number): [number, number] => {
    const px = (lng * cosLat - bx0) * scale + offsetX;
    const py = VIEW_H - ((lat - minLat) * scale + offsetY);
    return [px, py];
  };
  const path = rings
    .map((r) => {
      let p = ringToPath(r.outer, project);
      for (const h of r.holes) p += ` ${ringToPath(h, project)}`;
      return p;
    })
    .join(' ');
  const areaLabel = Number.isFinite(areaKm2) ? `${areaKm2.toFixed(2)} קמ״ר` : '';
  const coordLabel = `${fmtCoord(centerLat)}°N, ${fmtCoord(centerLng)}°E`;
  return `<svg width="${VIEW_W}" height="${VIEW_H}" viewBox="0 0 ${VIEW_W} ${VIEW_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="מפת אזור הניתוח (ללא רקע OSM)">
  <defs>
    <linearGradient id="mahod-poly-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a6fb5" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#2eaa6f" stop-opacity="0.22"/>
    </linearGradient>
    <pattern id="mahod-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e9ef" stroke-width="0.6"/>
    </pattern>
  </defs>
  <rect width="${VIEW_W}" height="${VIEW_H}" fill="#f9fafc"/>
  <rect width="${VIEW_W}" height="${VIEW_H}" fill="url(#mahod-grid)"/>
  <path d="${path}" fill="url(#mahod-poly-fill)" fill-rule="evenodd" stroke="#1a6fb5" stroke-width="2.2" stroke-linejoin="round"/>
  <g font-family="Rubik, Heebo, Arial, sans-serif" font-size="11" fill="#1f2933">
    <rect x="${(VIEW_W - 210).toFixed(2)}" y="14" width="196" height="46" rx="6" fill="#ffffff" stroke="#dfe4ea"/>
    <text x="${(VIEW_W - 24).toFixed(2)}" y="32" text-anchor="start" direction="rtl" font-weight="600">${escapeXml(areaLabel)}</text>
    <text x="${(VIEW_W - 24).toFixed(2)}" y="50" text-anchor="start" direction="rtl" fill="#6b7785">${escapeXml(coordLabel)}</text>
  </g>
</svg>`;
}

/**
 * Returns an inline SVG string with an OSM basemap, the analysis polygon and
 * (optionally) the same per-layer features that the Leaflet map renders —
 * stops, accidents and roads. Falls back to a non-tiled visualization when
 * tiles can't be fetched.
 */
export async function buildPolygonMapSvg(
  geometry: unknown,
  areaKm2: number,
  features: MapLayerFeatures = {}
): Promise<string> {
  const rings = geometryToRings(geometry);
  if (rings.length === 0) return '';
  const bbox = computeBbox(rings);
  if (!bbox) return '';

  const z = chooseZoom(bbox);
  const [px0, py0] = lngLatToWorldPx(bbox.minLng, bbox.maxLat, z);
  const [px1, py1] = lngLatToWorldPx(bbox.maxLng, bbox.minLat, z);
  const polyW = px1 - px0;
  const polyH = py1 - py0;
  if (polyW <= 0 || polyH <= 0) {
    return buildFallbackSvg(rings, bbox, areaKm2);
  }

  // Center the polygon inside the viewport — viewport's top-left in world px.
  // Snap to integer pixels so OSM tiles render on whole-pixel boundaries
  // (eliminates sub-pixel anti-aliasing that makes features look "off").
  const viewX0 = Math.round(px0 - (VIEW_W - polyW) / 2);
  const viewY0 = Math.round(py0 - (VIEW_H - polyH) / 2);

  const txMin = Math.floor(viewX0 / TILE_SIZE);
  const txMax = Math.floor((viewX0 + VIEW_W - 1) / TILE_SIZE);
  const tyMin = Math.floor(viewY0 / TILE_SIZE);
  const tyMax = Math.floor((viewY0 + VIEW_H - 1) / TILE_SIZE);

  const tileCount = (txMax - txMin + 1) * (tyMax - tyMin + 1);
  if (tileCount > MAX_TILES) {
    return buildFallbackSvg(rings, bbox, areaKm2);
  }

  const maxTileIdx = Math.pow(2, z) - 1;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TILE_TIMEOUT_MS);

  type Tile = { tx: number; ty: number; data: string };
  const tasks: Array<Promise<Tile | null>> = [];
  for (let tx = txMin; tx <= txMax; tx += 1) {
    for (let ty = tyMin; ty <= tyMax; ty += 1) {
      if (ty < 0 || ty > maxTileIdx) continue;
      tasks.push(
        fetchTileAsDataUrl(z, tx, ty, controller.signal)
          .then((data) => ({ tx, ty, data }))
          .catch(() => null)
      );
    }
  }

  const results = await Promise.all(tasks);
  clearTimeout(timeoutId);
  const tiles: Tile[] = results.filter((r): r is Tile => r !== null);
  if (tiles.length === 0) {
    return buildFallbackSvg(rings, bbox, areaKm2);
  }

  const project = (lng: number, lat: number): [number, number] => {
    const [wx, wy] = lngLatToWorldPx(lng, lat, z);
    return [wx - viewX0, wy - viewY0];
  };

  const tileImgs = tiles
    .map((t) => {
      const x = (t.tx * TILE_SIZE - viewX0).toFixed(2);
      const y = (t.ty * TILE_SIZE - viewY0).toFixed(2);
      return `<image href="${t.data}" x="${x}" y="${y}" width="${TILE_SIZE}" height="${TILE_SIZE}" preserveAspectRatio="none"/>`;
    })
    .join('');

  const path = rings
    .map((r) => {
      let p = ringToPath(r.outer, project);
      for (const h of r.holes) p += ` ${ringToPath(h, project)}`;
      return p;
    })
    .join(' ');

  const roadsSvg = buildRoadsSvg(features.roads, MAX_RENDER_ROAD_SEGMENTS, project);
  const stopsSvg = buildPointsSvg(features.publicTransport, MAX_RENDER_STOPS, project, COLOR_TRANSIT, 3.4);
  const accidentsSvg = buildPointsSvg(features.accidents, MAX_RENDER_ACCIDENTS, project, COLOR_ACCIDENTS, 2.6);
  const legendSvg = buildLegendSvg(features);

  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const centerLng = (bbox.minLng + bbox.maxLng) / 2;
  const areaLabel = Number.isFinite(areaKm2) ? `${areaKm2.toFixed(2)} קמ״ר` : '';
  const coordLabel = `${fmtCoord(centerLat)}°N, ${fmtCoord(centerLng)}°E`;
  const attribution = '© OpenStreetMap contributors';

  return `<svg width="${VIEW_W}" height="${VIEW_H}" viewBox="0 0 ${VIEW_W} ${VIEW_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="מפת אזור הניתוח על רקע OpenStreetMap">
  <defs>
    <clipPath id="mahod-map-clip"><rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}"/></clipPath>
  </defs>
  <rect width="${VIEW_W}" height="${VIEW_H}" fill="#f4f6f8"/>
  <g clip-path="url(#mahod-map-clip)">
    ${tileImgs}
    ${roadsSvg}
    <path d="${path}" fill="rgba(26,111,181,0.18)" fill-rule="evenodd" stroke="${COLOR_POLYGON}" stroke-width="2.5" stroke-linejoin="round"/>
    ${stopsSvg}
    ${accidentsSvg}
  </g>
  ${legendSvg}
  <g font-family="Rubik, Heebo, Arial, sans-serif" font-size="11" fill="#1f2933">
    <rect x="${(VIEW_W - 210).toFixed(2)}" y="14" width="196" height="46" rx="6" fill="#ffffff" fill-opacity="0.94" stroke="#dfe4ea"/>
    <text x="${(VIEW_W - 24).toFixed(2)}" y="32" text-anchor="start" direction="rtl" font-weight="600">${escapeXml(areaLabel)}</text>
    <text x="${(VIEW_W - 24).toFixed(2)}" y="50" text-anchor="start" direction="rtl" fill="#6b7785">${escapeXml(coordLabel)}</text>
  </g>
  <g font-family="Arial, sans-serif" font-size="9" fill="#1f2933">
    <rect x="${(VIEW_W - 210).toFixed(2)}" y="${VIEW_H - 20}" width="200" height="14" fill="#ffffff" fill-opacity="0.85"/>
    <text x="${(VIEW_W - 14).toFixed(2)}" y="${VIEW_H - 9}" text-anchor="end" direction="ltr">${escapeXml(attribution)}</text>
  </g>
</svg>`;
}
