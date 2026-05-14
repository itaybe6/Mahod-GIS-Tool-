import { describe, it, expect } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { buildExportAnalysisPayload, featureCollectionAreaKm2 } from './buildExportPayload';
import type { AnalysisResults } from '@/stores/analysisStore';

const emptyPolygon: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [34.75, 31.25],
            [34.85, 31.25],
            [34.85, 31.35],
            [34.75, 31.35],
            [34.75, 31.25],
          ],
        ],
      },
    },
  ],
};

describe('featureCollectionAreaKm2', () => {
  it('returns a positive area for a simple polygon', () => {
    const km2 = featureCollectionAreaKm2(emptyPolygon);
    expect(km2).toBeGreaterThan(0);
    expect(km2).toBeLessThan(1000);
  });
});

describe('buildExportAnalysisPayload', () => {
  it('aggregates accidents by year from TAZ features', () => {
    const results: AnalysisResults = {
      accidents: {
        counts: { count: 2, breakdown: { fatal: 1, severe: 2, light: 5 } },
        features: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { year: 2022, accidents: 10 },
              geometry: { type: 'Point', coordinates: [34.8, 31.3] },
            },
            {
              type: 'Feature',
              properties: { year: 2022, accidents: 3 },
              geometry: { type: 'Point', coordinates: [34.81, 31.31] },
            },
          ],
        },
      },
    };
    const p = buildExportAnalysisPayload(emptyPolygon, results, {
      polygonName: 'Test',
      analyzedAt: new Date('2026-05-15T12:00:00Z'),
    });
    expect(p.accidents.byYear['2022']).toBe(13);
    expect(p.metadata.polygonName).toBe('Test');
    expect(p.accidents.bySeverity.fatal).toBe(1);
  });
});
