/**
 * Reduce any GeoJSON shape to a geometry object consumable by PostGIS
 * `ST_GeomFromGeoJSON` (same contract as `analyze-area`).
 */
export function extractPolygonGeometry(input: unknown): object {
  if (!input || typeof input !== 'object') {
    throw new Error('polygon חסר או לא תקין');
  }
  const geom = input as { type?: string };

  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    return input as object;
  }

  if (geom.type === 'Feature') {
    const feat = input as { geometry?: object };
    if (!feat.geometry) throw new Error('Feature ללא geometry');
    return extractPolygonGeometry(feat.geometry);
  }

  if (geom.type === 'FeatureCollection') {
    const fc = input as {
      features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }>;
    };
    const polys = (fc.features ?? [])
      .map((f) => f?.geometry)
      .filter(
        (g): g is { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } =>
          !!g && (g.type === 'Polygon' || g.type === 'MultiPolygon')
      );
    if (polys.length === 0) {
      throw new Error('FeatureCollection לא מכיל פוליגונים');
    }
    if (polys.length === 1) return polys[0]!;
    const coords: unknown[] = [];
    for (const p of polys) {
      if (p.type === 'Polygon') coords.push(p.coordinates);
      else if (Array.isArray(p.coordinates)) coords.push(...(p.coordinates as unknown[]));
    }
    return { type: 'MultiPolygon', coordinates: coords };
  }

  throw new Error(`type לא נתמך: ${String(geom.type)}`);
}
