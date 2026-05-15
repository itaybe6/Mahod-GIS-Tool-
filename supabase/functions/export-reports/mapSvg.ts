/**
 * Build an inline SVG visualization of the analyzed polygon — embedded directly
 * in the HTML report, so the file stays self-contained (no tile servers / fonts
 * required when the user opens it offline).
 *
 * Projection: equirectangular with cosine-of-latitude correction. Good enough for
 * a single neighborhood / city / region in Israel without visible distortion.
 */

type LngLat = [number, number];

interface PolygonRing {
  outer: LngLat[];
  holes: LngLat[][];
}

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

interface Bbox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
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

function fmtCoord(n: number): string {
  return n.toFixed(4);
}

/**
 * Returns an inline SVG string visualizing the polygon, or empty string when
 * the geometry can't be drawn (missing / wrong type / degenerate ring).
 *
 * `areaKm2` is rendered as a small badge over the map.
 */
export function buildPolygonMapSvg(geometry: unknown, areaKm2: number): string {
  const rings = geometryToRings(geometry);
  if (rings.length === 0) return '';

  const bbox = computeBbox(rings);
  if (!bbox) return '';

  const { minLng, maxLng, minLat, maxLat } = bbox;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);

  const W = 720;
  const H = 380;
  const PAD = 28;

  const bx0 = minLng * cosLat;
  const bx1 = maxLng * cosLat;
  const by0 = minLat;
  const by1 = maxLat;
  const rangeX = bx1 - bx0;
  const rangeY = by1 - by0;
  if (rangeX <= 0 || rangeY <= 0) return '';

  const availW = W - 2 * PAD;
  const availH = H - 2 * PAD;
  const scale = Math.min(availW / rangeX, availH / rangeY);
  const drawnW = rangeX * scale;
  const drawnH = rangeY * scale;
  const offsetX = (W - drawnW) / 2;
  const offsetY = (H - drawnH) / 2;

  const project = (lng: number, lat: number): [number, number] => {
    const px = (lng * cosLat - bx0) * scale + offsetX;
    const py = H - ((lat - by0) * scale + offsetY);
    return [px, py];
  };

  const ringToPath = (ring: LngLat[]): string => {
    let d = '';
    for (let i = 0; i < ring.length; i += 1) {
      const pt = ring[i]!;
      const [x, y] = project(pt[0], pt[1]);
      d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return `${d.trim()} Z`;
  };

  const polygonPath = rings
    .map((r) => {
      let p = ringToPath(r.outer);
      for (const h of r.holes) p += ` ${ringToPath(h)}`;
      return p;
    })
    .join(' ');

  const [centerPx, centerPy] = project(centerLng, centerLat);

  const areaLabel = Number.isFinite(areaKm2) ? `${areaKm2.toFixed(2)} קמ״ר` : '';
  const coordLabel = `${fmtCoord(centerLat)}°N, ${fmtCoord(centerLng)}°E`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="מפת אזור הניתוח">
  <defs>
    <linearGradient id="mahod-poly-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a6fb5" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#2eaa6f" stop-opacity="0.22"/>
    </linearGradient>
    <pattern id="mahod-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e9ef" stroke-width="0.6"/>
    </pattern>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#f9fafc"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#mahod-grid)"/>
  <path d="${polygonPath}" fill="url(#mahod-poly-fill)" fill-rule="evenodd" stroke="#1a6fb5" stroke-width="2.2" stroke-linejoin="round"/>
  <circle cx="${centerPx.toFixed(2)}" cy="${centerPy.toFixed(2)}" r="4" fill="#155a96"/>
  <circle cx="${centerPx.toFixed(2)}" cy="${centerPy.toFixed(2)}" r="9" fill="none" stroke="#155a96" stroke-width="1.2" stroke-opacity="0.55"/>
  <g font-family="Rubik, Heebo, Arial, sans-serif" font-size="11" fill="#1f2933">
    <rect x="${(W - 200).toFixed(2)}" y="14" width="186" height="46" rx="6" fill="#ffffff" stroke="#dfe4ea"/>
    <text x="${(W - 16).toFixed(2)}" y="32" text-anchor="end" font-weight="600">${areaLabel}</text>
    <text x="${(W - 16).toFixed(2)}" y="50" text-anchor="end" fill="#6b7785">${coordLabel}</text>
  </g>
  <g font-family="Rubik, Heebo, Arial, sans-serif" font-size="10" fill="#6b7785">
    <text x="14" y="${H - 14}">צפון מצביע למעלה · היטל equirectangular מתוקן ל-cos(lat)</text>
  </g>
</svg>`;
}
