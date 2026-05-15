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

const TILE_SIZE = 256;
const VIEW_W = 720;
const VIEW_H = 380;
const PAD = 36;
const TILE_TIMEOUT_MS = 8000;
const MAX_TILES = 25;
const TILE_USER_AGENT = 'mahod-gis-export-reports/1.0 (+https://mahod.co.il)';
const TILE_SUBDOMAINS = ['a', 'b', 'c'] as const;

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
  return `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="מפת אזור הניתוח (ללא רקע OSM)">
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
    <rect x="${(VIEW_W - 200).toFixed(2)}" y="14" width="186" height="46" rx="6" fill="#ffffff" stroke="#dfe4ea"/>
    <text x="${(VIEW_W - 16).toFixed(2)}" y="32" text-anchor="end" font-weight="600">${escapeXml(areaLabel)}</text>
    <text x="${(VIEW_W - 16).toFixed(2)}" y="50" text-anchor="end" fill="#6b7785">${escapeXml(coordLabel)}</text>
  </g>
</svg>`;
}

/**
 * Returns an inline SVG string with an OSM basemap and the polygon overlay.
 * Falls back to a non-tiled visualization when tiles can't be fetched.
 */
export async function buildPolygonMapSvg(geometry: unknown, areaKm2: number): Promise<string> {
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

  // Center the polygon inside the viewport — viewport's top-left in world px:
  const viewX0 = px0 - (VIEW_W - polyW) / 2;
  const viewY0 = py0 - (VIEW_H - polyH) / 2;

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

  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const centerLng = (bbox.minLng + bbox.maxLng) / 2;
  const areaLabel = Number.isFinite(areaKm2) ? `${areaKm2.toFixed(2)} קמ״ר` : '';
  const coordLabel = `${fmtCoord(centerLat)}°N, ${fmtCoord(centerLng)}°E`;
  const attribution = '© OpenStreetMap contributors';

  return `<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="מפת אזור הניתוח על רקע OpenStreetMap">
  <defs>
    <clipPath id="mahod-map-clip"><rect x="0" y="0" width="${VIEW_W}" height="${VIEW_H}"/></clipPath>
  </defs>
  <rect width="${VIEW_W}" height="${VIEW_H}" fill="#f4f6f8"/>
  <g clip-path="url(#mahod-map-clip)">
    ${tileImgs}
    <path d="${path}" fill="rgba(26,111,181,0.22)" fill-rule="evenodd" stroke="#1a6fb5" stroke-width="2.5" stroke-linejoin="round"/>
  </g>
  <g font-family="Rubik, Heebo, Arial, sans-serif" font-size="11" fill="#1f2933">
    <rect x="${(VIEW_W - 200).toFixed(2)}" y="14" width="186" height="46" rx="6" fill="#ffffff" fill-opacity="0.94" stroke="#dfe4ea"/>
    <text x="${(VIEW_W - 16).toFixed(2)}" y="32" text-anchor="end" font-weight="600">${escapeXml(areaLabel)}</text>
    <text x="${(VIEW_W - 16).toFixed(2)}" y="50" text-anchor="end" fill="#6b7785">${escapeXml(coordLabel)}</text>
  </g>
  <g font-family="Arial, sans-serif" font-size="9" fill="#1f2933">
    <rect x="${(VIEW_W - 200).toFixed(2)}" y="${VIEW_H - 20}" width="195" height="14" fill="#ffffff" fill-opacity="0.85"/>
    <text x="${(VIEW_W - 8).toFixed(2)}" y="${VIEW_H - 9}" text-anchor="end">${escapeXml(attribution)}</text>
  </g>
</svg>`;
}
