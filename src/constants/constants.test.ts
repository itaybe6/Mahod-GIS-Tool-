import { describe, it, expect } from 'vitest';
import { BRAND_COLORS, STATUS_COLORS, SURFACE_COLORS, LAYER_COLORS } from './colors';
import { ROUTES } from './routes';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAP_TYPES,
  MAP_TYPE_LABELS,
  MAP_TYPE_HEBREW_LABELS,
  LEAFLET_MAP_TYPES,
} from './mapConfig';

describe('colors', () => {
  it('BRAND_COLORS has teal and blue', () => {
    expect(BRAND_COLORS.teal).toBeTruthy();
    expect(BRAND_COLORS.blue).toBeTruthy();
  });

  it('STATUS_COLORS has danger, warning, success', () => {
    expect(STATUS_COLORS.danger).toMatch(/^#/);
    expect(STATUS_COLORS.warning).toMatch(/^#/);
    expect(STATUS_COLORS.success).toMatch(/^#/);
  });

  it('SURFACE_COLORS has bg0 and surface', () => {
    expect(SURFACE_COLORS.bg0).toMatch(/^#/);
    expect(SURFACE_COLORS.surface).toMatch(/^#/);
  });

  it('LAYER_COLORS has all 5 layer keys', () => {
    const keys = Object.keys(LAYER_COLORS);
    expect(keys).toContain('transit');
    expect(keys).toContain('accidents');
    expect(keys).toContain('roads');
    expect(keys).toContain('infra');
    expect(keys).toContain('traffic');
  });
});

describe('routes', () => {
  it('ROUTES has LOGIN and DASHBOARD', () => {
    expect(ROUTES.LOGIN).toBe('/login');
    expect(ROUTES.DASHBOARD).toBe('/');
  });

  it('ROUTES has MAP, ACCIDENTS, TRANSIT', () => {
    expect(ROUTES.MAP).toBe('/map');
    expect(ROUTES.ACCIDENTS).toBe('/accidents');
    expect(ROUTES.TRANSIT).toBe('/transit');
  });

  it('ROUTES has RECENT_FILES and SOURCES', () => {
    expect(ROUTES.RECENT_FILES).toBe('/recent-files');
    expect(ROUTES.SOURCES).toBe('/sources');
  });

  it('all routes start with /', () => {
    Object.values(ROUTES).forEach((route) => {
      expect(route).toMatch(/^\//);
    });
  });
});

describe('mapConfig', () => {
  it('DEFAULT_MAP_CENTER is a valid [lat, lng] tuple for Israel', () => {
    const [lat, lng] = DEFAULT_MAP_CENTER;
    expect(lat).toBeGreaterThan(29);
    expect(lat).toBeLessThan(34);
    expect(lng).toBeGreaterThan(34);
    expect(lng).toBeLessThan(36);
  });

  it('DEFAULT_MAP_ZOOM is a reasonable zoom level', () => {
    expect(DEFAULT_MAP_ZOOM).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_MAP_ZOOM).toBeLessThanOrEqual(20);
  });

  it('MAP_TYPES includes all leaflet types and mapbox3d', () => {
    expect(MAP_TYPES).toContain('dark');
    expect(MAP_TYPES).toContain('osm');
    expect(MAP_TYPES).toContain('sat');
    expect(MAP_TYPES).toContain('topo');
    expect(MAP_TYPES).toContain('mapbox3d');
  });

  it('LEAFLET_MAP_TYPES does not include mapbox3d', () => {
    expect(LEAFLET_MAP_TYPES).not.toContain('mapbox3d');
  });

  it('MAP_TYPE_LABELS has a label for every MAP_TYPE', () => {
    MAP_TYPES.forEach((type) => {
      expect(MAP_TYPE_LABELS[type]).toBeTruthy();
    });
  });

  it('MAP_TYPE_HEBREW_LABELS has a Hebrew label for every MAP_TYPE', () => {
    MAP_TYPES.forEach((type) => {
      expect(MAP_TYPE_HEBREW_LABELS[type].length).toBeGreaterThan(0);
    });
  });
});
