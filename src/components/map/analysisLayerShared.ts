import type { Geometry, Position } from 'geojson';

import type { AnalysisLayerKey } from '@/stores/analysisStore';
import type { Coordinates } from '@/types/common';

/**
 * Helpers shared between the Leaflet `AnalysisResultsLayer` and the Mapbox GL
 * `Mapbox3DView`. Both renderers consume the same `analyze-area` payload, so
 * keeping the palette, popup HTML, and feature-positioning logic in one place
 * guarantees they look & behave identically across map modes.
 */

export interface AnalysisLayerPaletteEntry {
  color: string;
  label: string;
}

export const ANALYSIS_PALETTE: Record<AnalysisLayerKey, AnalysisLayerPaletteEntry> = {
  transit: { color: '#10b981', label: 'תחבורה ציבורית' },
  accidents: { color: '#ef4444', label: 'תאונות דרכים' },
  roads: { color: '#f59e0b', label: 'דרכים' },
  infrastructure: { color: '#a855f7', label: 'תשתיות' },
  traffic: { color: '#0ea5e9', label: 'ספירות תנועה' },
};

export const ANALYSIS_LAYER_KEYS: ReadonlyArray<AnalysisLayerKey> = Object.keys(
  ANALYSIS_PALETTE
) as AnalysisLayerKey[];

/**
 * Picks a single representative point inside a geometry — used to place pulse
 * markers on lines/polygons and to fly the camera onto a feature when the user
 * clicks a row in the results panel.
 */
export function getRepresentativeLatLng(geometry: Geometry): Coordinates | null {
  switch (geometry.type) {
    case 'Point':
      return positionToCoordinates(geometry.coordinates);
    case 'MultiPoint':
      return positionToCoordinates(geometry.coordinates[0]);
    case 'LineString':
      return positionToCoordinates(
        geometry.coordinates[Math.floor(geometry.coordinates.length / 2)]
      );
    case 'MultiLineString': {
      const line = geometry.coordinates.find((coords) => coords.length > 0);
      return line ? positionToCoordinates(line[Math.floor(line.length / 2)]) : null;
    }
    case 'Polygon':
      return positionToCoordinates(geometry.coordinates[0]?.[0]);
    case 'MultiPolygon':
      return positionToCoordinates(geometry.coordinates[0]?.[0]?.[0]);
    default:
      return null;
  }
}

function positionToCoordinates(position: Position | undefined): Coordinates | null {
  if (!position || position.length < 2) return null;
  const [lng, lat] = position;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

/**
 * Builds the popup HTML for an analysis feature. The structure uses `.lp`
 * classes defined in `src/styles/rtl.css`, so the same HTML renders correctly
 * inside both a Leaflet `<Popup>` and a Mapbox GL `Popup`. Accepts raw
 * feature properties (Mapbox emits these directly on click) — Leaflet callers
 * pass `feature.properties ?? {}`.
 */
export function buildAnalysisPopupHtml(
  key: AnalysisLayerKey,
  properties: Record<string, unknown> | null | undefined,
  colour: string
): string {
  const props = properties ?? {};
  const title = getFeatureTitle(key, props);
  const rows = getPopupRows(key, props);

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<div class="lp-row"><span class="lp-k">${escHtml(k)}</span><span class="lp-v">${escHtml(v)}</span></div>`
    )
    .join('');

  return `<div class="lp">
    <div class="lp-hd">
      <span class="lp-dot" style="background:${colour};box-shadow:0 0 6px ${colour}99"></span>
      <span class="lp-title">${escHtml(title)}</span>
    </div>
    <div class="lp-body">${rowsHtml}</div>
  </div>`;
}

function getFeatureTitle(key: AnalysisLayerKey, props: Record<string, unknown>): string {
  switch (key) {
    case 'transit':
      return str(props.stop_name ?? props.name ?? '—');
    case 'accidents':
      return props.city ? str(props.city) : `אזור TAZ ${str(props.id ?? '—')}`;
    case 'roads':
      return props.road_name
        ? str(props.road_name)
        : props.road_number
          ? `כביש ${str(props.road_number)}`
          : '—';
    case 'infrastructure':
      return str(props.name ?? props.category ?? '—');
    case 'traffic':
      return str(props.description ?? props.count_type ?? '—');
    default:
      return '—';
  }
}

function getPopupRows(
  key: AnalysisLayerKey,
  props: Record<string, unknown>
): [string, string][] {
  const rows: [string, string][] = [];
  const add = (label: string, val: unknown) => {
    const v = str(val);
    if (v && v !== 'null' && v !== 'undefined') rows.push([label, v]);
  };

  switch (key) {
    case 'transit':
      add('סוג', props.type);
      add('מזהה תחנה', props.stop_id);
      add('קוד', props.stop_code);
      add('אזור', props.zone_id);
      if (typeof props.routes === 'number' && props.routes > 0) add('קווים', props.routes);
      break;
    case 'accidents':
      add('יישוב', props.city);
      if (typeof props.accidents === 'number') add('תאונות', props.accidents);
      if (typeof props.fatal === 'number' && props.fatal > 0) add('הרוגים', props.fatal);
      if (typeof props.severe_inj === 'number' && props.severe_inj > 0)
        add('פצועים קשה', props.severe_inj);
      if (typeof props.light_inj === 'number' && props.light_inj > 0)
        add('פצועים קל', props.light_inj);
      add('שנה', props.year);
      add('חומרה', props.severity);
      break;
    case 'roads':
      if (props.road_number) add('מספר כביש', props.road_number);
      add('רשות', props.authority);
      if (typeof props.length_m === 'number')
        add('אורך', `${Math.round(props.length_m).toLocaleString('he-IL')} מ'`);
      break;
    case 'infrastructure':
      add('סוג', props.category);
      add('סטטוס', props.status);
      break;
    case 'traffic':
      add('סוג ספירה', props.count_type);
      add('תאריך', props.count_date);
      if (typeof props.total_volume === 'number' && props.total_volume > 0)
        add('נפח כולל', props.total_volume.toLocaleString('he-IL'));
      if (typeof props.volume_rows === 'number' && props.volume_rows > 0)
        add('רשומות', props.volume_rows.toLocaleString('he-IL'));
      break;
  }
  return rows;
}

const str = (v: unknown): string => (v == null ? '' : String(v));

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
