import { Building2, Bus, CalendarDays, MapPin, Route, Waypoints } from 'lucide-react';

import { valueAsString } from './formatters';
import type { GtfsShapesSchemaMode } from './shapesProbe';
import type { ColumnDef, TableConfig } from './types';

export type { GtfsShapesSchemaMode } from './shapesProbe';

function key(row: Record<string, unknown>, ...fields: string[]): string {
  return fields.map((f) => valueAsString(row[f])).join('-');
}

const AUDIT_COLUMNS: ColumnDef[] = [
  {
    key: 'source_version',
    label: 'גרסת מקור',
    type: 'text',
    searchable: false,
    sortable: true,
    width: 'w-28',
  },
  {
    key: 'updated_at',
    label: 'עודכן ב-',
    type: 'date',
    searchable: false,
    sortable: true,
    width: 'w-44',
  },
];

const ROUTE_TYPE_LABELS: Record<number, string> = {
  0: 'רכבת קלה / טראם',
  1: 'מטרו',
  2: 'רכבת',
  3: 'אוטובוס',
  4: 'מעבורת',
  5: 'כבל אווירי',
  6: 'רכבל',
  7: 'מעלית / Funicular',
  11: 'טרוליבוס',
  12: 'מונוריל',
  715: 'שירות מיוחד / מענה גמיש',
};

const LOCATION_TYPE_LABELS: Record<number, string> = {
  0: 'תחנה / עצירה',
  1: 'תחנת אם',
  2: 'כניסה / יציאה',
  3: 'צומת תחנות',
  4: 'אזור עלייה',
};

const WHEELCHAIR_LABELS: Record<number, string> = {
  0: 'לא ידוע',
  1: 'נגיש',
  2: 'לא נגיש',
};

const DIRECTION_LABELS: Record<number, string> = {
  0: 'הלוך',
  1: 'חזור',
};

const BOOLEAN_DAY_LABELS: Record<string, string> = {
  true: 'פעיל',
  false: '—',
};

/** LineString-per-shape layout (PostGIS `geom` + `point_count`). */
export const GTFS_SHAPES_LINE: TableConfig = {
  name: 'gtfs_shapes',
  label: 'תוואי קווים',
  description: 'שורה לכל תוואי — LineString ב־PostGIS (ללא טעינת geom בטבלה).',
  sortPresets: [
    { label: 'מס׳ תוואי (עולה)', key: 'shape_id', dir: 'asc' },
    { label: 'מס׳ נקודות (יורד)', key: 'point_count', dir: 'desc' },
  ],
  icon: Waypoints,
  defaultSort: [{ key: 'shape_id', dir: 'asc' }],
  rowKey: (row) => `shape-${key(row, 'shape_id')}`,
  columns: [
    { key: 'shape_id', label: 'מס׳ תוואי', type: 'number', width: 'w-28' },
    { key: 'point_count', label: 'מס׳ נקודות', type: 'number', width: 'w-28' },
    ...AUDIT_COLUMNS,
  ],
};

/** Raw `shapes.txt` layout — one DB row per shape point. */
export const GTFS_SHAPES_POINT: TableConfig = {
  name: 'gtfs_shapes',
  label: 'תוואי קווים',
  description: 'נקודות shapes.txt — שורה לכל נקודה בתוואי (מיליוני שורות; השתמשו בחיפוש ובעמודים קטנים).',
  sortPresets: [
    { label: 'מס׳ תוואי (עולה)', key: 'shape_id', dir: 'asc' },
    { label: 'סדר נקודה (עולה)', key: 'shape_pt_sequence', dir: 'asc' },
  ],
  icon: Waypoints,
  defaultSort: [
    { key: 'shape_id', dir: 'asc' },
    { key: 'shape_pt_sequence', dir: 'asc' },
  ],
  rowKey: (row) => `shapept-${key(row, 'shape_id', 'shape_pt_sequence')}`,
  columns: [
    { key: 'shape_id', label: 'מס׳ תוואי', type: 'number', width: 'w-28' },
    { key: 'shape_pt_sequence', label: 'סדר נקודה', type: 'number', width: 'w-24' },
    {
      key: 'shape_pt_lat',
      label: 'קו רוחב',
      type: 'number',
      width: 'w-28',
      searchable: false,
      formatter: (v) => (typeof v === 'number' ? v.toFixed(5) : '—'),
    },
    {
      key: 'shape_pt_lon',
      label: 'קו אורך',
      type: 'number',
      width: 'w-28',
      searchable: false,
      formatter: (v) => (typeof v === 'number' ? v.toFixed(5) : '—'),
    },
  ],
};

const GTFS_TABLES_BEFORE_SHAPES: TableConfig[] = [
  {
    name: 'gtfs_agency',
    label: 'חברות תחבורה',
    description: 'מפעילי הקווים (רכבת ישראל, אגד, דן, NTA…).',
    searchPlaceholder: 'חיפוש חברות תחבורה — לפי מס׳ חברה, שם חברה או טלפון',
    disableAdvancedSort: true,
    icon: Building2,
    defaultSort: [{ key: 'agency_id', dir: 'asc' }],
    rowKey: (row) => `agency-${key(row, 'agency_id')}`,
    columns: [
      { key: 'agency_id', label: 'מס׳ חברה', type: 'number', width: 'w-24', searchable: true },
      { key: 'agency_name', label: 'שם חברה', type: 'text', width: 'w-56' },
      { key: 'agency_url', label: 'אתר', type: 'text', searchable: false },
      { key: 'agency_phone', label: 'טלפון', type: 'text' },
    ],
  },

  {
    name: 'gtfs_routes',
    label: 'קווים',
    description: 'כל הקווים עם מספר, שם ארוך וסוג כלי תחבורה.',
    searchPlaceholder: 'חיפוש קווים — לפי מס׳ קו, שם קו או תיאור',
    sortPresets: [
      { label: 'מס׳ קו (קטן → גדול)', key: 'route_short_name', dir: 'asc' },
      { label: 'מס׳ קו (גדול → קטן)', key: 'route_short_name', dir: 'desc' },
      { label: 'קיבוץ לפי חברה', key: 'agency_id', dir: 'asc' },
      { label: 'קיבוץ לפי סוג כלי תחבורה', key: 'route_type', dir: 'asc' },
      { label: 'שם הקו (א → ת)', key: 'route_long_name', dir: 'asc' },
    ],
    icon: Route,
    defaultSort: [{ key: 'route_id', dir: 'asc' }],
    rowKey: (row) => `route-${key(row, 'route_id')}`,
    columns: [
      { key: 'route_id', label: 'מס׳ קו (פנימי)', type: 'number', width: 'w-32' },
      { key: 'agency_id', label: 'מס׳ חברה', type: 'number', width: 'w-24' },
      { key: 'route_short_name', label: 'מס׳ קו', type: 'text', width: 'w-24' },
      { key: 'route_long_name', label: 'שם קו', type: 'text' },
      { key: 'route_desc', label: 'תיאור', type: 'text' },
      {
        key: 'route_type',
        label: 'סוג',
        type: 'enum',
        enumLabels: ROUTE_TYPE_LABELS,
        width: 'w-32',
      },
    ],
  },

  {
    name: 'gtfs_stops',
    label: 'תחנות',
    description: 'תחנות אוטובוס/רכבת עם קואורדינטות (WGS84).',
    searchPlaceholder: 'חיפוש תחנות — לפי קוד תחנה, שם תחנה או כתובת',
    sortPresets: [
      { label: 'שם תחנה (א → ת)', key: 'stop_name', dir: 'asc' },
      { label: 'קוד תחנה (קטן → גדול)', key: 'stop_code', dir: 'asc' },
      { label: 'קוד תחנה (גדול → קטן)', key: 'stop_code', dir: 'desc' },
      { label: 'קיבוץ לפי סוג מיקום', key: 'location_type', dir: 'asc' },
      { label: 'קיבוץ לפי אזור תעריף', key: 'zone_id', dir: 'asc' },
    ],
    icon: MapPin,
    defaultSort: [{ key: 'stop_id', dir: 'asc' }],
    rowKey: (row) => `stop-${key(row, 'stop_id')}`,
    columns: [
      { key: 'stop_id', label: 'מס׳ תחנה (פנימי)', type: 'number', width: 'w-32', searchable: true },
      { key: 'stop_code', label: 'קוד תחנה', type: 'number', width: 'w-28', searchable: true },
      { key: 'stop_name', label: 'שם תחנה', type: 'text' },
      { key: 'stop_desc', label: 'כתובת מלאה', type: 'text' },
      {
        key: 'stop_lat',
        label: 'קו רוחב',
        type: 'number',
        width: 'w-28',
        searchable: false,
        formatter: (v) => (typeof v === 'number' ? v.toFixed(5) : '—'),
      },
      {
        key: 'stop_lon',
        label: 'קו אורך',
        type: 'number',
        width: 'w-28',
        searchable: false,
        formatter: (v) => (typeof v === 'number' ? v.toFixed(5) : '—'),
      },
      {
        key: 'location_type',
        label: 'סוג מיקום',
        type: 'enum',
        enumLabels: LOCATION_TYPE_LABELS,
        width: 'w-32',
      },
      { key: 'zone_id', label: 'אזור תעריף', type: 'text', width: 'w-32' },
    ],
  },

  {
    name: 'gtfs_calendar',
    label: 'לוחות שירות',
    description: 'תבניות ימי פעילות (ראשון…שבת) ותקופת תוקף.',
    searchPlaceholder: 'חיפוש לוחות שירות — לפי מס׳ שירות או תאריך תוקף',
    sortPresets: [
      { label: 'פעילים כרגע (סיום מאוחר)', key: 'end_date', dir: 'desc' },
      { label: 'התחילו לאחרונה', key: 'start_date', dir: 'desc' },
      { label: 'מסתיימים בקרוב', key: 'end_date', dir: 'asc' },
      { label: 'מס׳ שירות (קטן → גדול)', key: 'service_id', dir: 'asc' },
    ],
    icon: CalendarDays,
    defaultSort: [{ key: 'service_id', dir: 'asc' }],
    rowKey: (row) => `service-${key(row, 'service_id')}`,
    columns: [
      { key: 'service_id', label: 'מס׳ שירות', type: 'number', width: 'w-28', searchable: true },
      {
        key: 'sunday',
        label: 'א׳',
        type: 'boolean',
        enumLabels: BOOLEAN_DAY_LABELS,
        width: 'w-16',
        align: 'center',
        searchable: false,
      },
      {
        key: 'monday',
        label: 'ב׳',
        type: 'boolean',
        enumLabels: BOOLEAN_DAY_LABELS,
        width: 'w-16',
        align: 'center',
        searchable: false,
      },
      {
        key: 'tuesday',
        label: 'ג׳',
        type: 'boolean',
        enumLabels: BOOLEAN_DAY_LABELS,
        width: 'w-16',
        align: 'center',
        searchable: false,
      },
      {
        key: 'wednesday',
        label: 'ד׳',
        type: 'boolean',
        enumLabels: BOOLEAN_DAY_LABELS,
        width: 'w-16',
        align: 'center',
        searchable: false,
      },
      {
        key: 'thursday',
        label: 'ה׳',
        type: 'boolean',
        enumLabels: BOOLEAN_DAY_LABELS,
        width: 'w-16',
        align: 'center',
        searchable: false,
      },
      {
        key: 'friday',
        label: 'ו׳',
        type: 'boolean',
        enumLabels: BOOLEAN_DAY_LABELS,
        width: 'w-16',
        align: 'center',
        searchable: false,
      },
      {
        key: 'saturday',
        label: 'ש׳',
        type: 'boolean',
        enumLabels: BOOLEAN_DAY_LABELS,
        width: 'w-16',
        align: 'center',
        searchable: false,
      },
      { key: 'start_date', label: 'תחילת תוקף', type: 'date', width: 'w-32', searchable: true },
      { key: 'end_date', label: 'סיום תוקף', type: 'date', width: 'w-32', searchable: true },
    ],
  },

  {
    name: 'gtfs_trips',
    label: 'נסיעות',
    description: 'מופע יומי של קו לכיוון מסוים, מקושר ללוח שירות.',
    searchPlaceholder: 'חיפוש נסיעות — לפי מזהה נסיעה, מס׳ קו, מס׳ שירות או יעד',
    sortPresets: [
      { label: 'קיבוץ לפי קו', key: 'route_id', dir: 'asc' },
      { label: 'יעד (א → ת)', key: 'trip_headsign', dir: 'asc' },
      { label: 'קיבוץ לפי לוח שירות', key: 'service_id', dir: 'asc' },
      { label: 'קיבוץ לפי כיוון', key: 'direction_id', dir: 'asc' },
    ],
    icon: Bus,
    defaultSort: [{ key: 'trip_id', dir: 'asc' }],
    rowKey: (row) => `trip-${key(row, 'trip_id')}`,
    columns: [
      { key: 'trip_id', label: 'מזהה נסיעה', type: 'text', width: 'w-56' },
      { key: 'route_id', label: 'מס׳ קו', type: 'number', width: 'w-28', searchable: true },
      { key: 'service_id', label: 'מס׳ שירות', type: 'number', width: 'w-28', searchable: true },
      { key: 'trip_headsign', label: 'יעד', type: 'text' },
      {
        key: 'direction_id',
        label: 'כיוון',
        type: 'enum',
        enumLabels: DIRECTION_LABELS,
        width: 'w-24',
      },
      { key: 'shape_id', label: 'מס׳ תוואי', type: 'number', width: 'w-28' },
      {
        key: 'wheelchair_accessible',
        label: 'נגישות',
        type: 'enum',
        enumLabels: WHEELCHAIR_LABELS,
        width: 'w-28',
      },
    ],
  },
];

/**
 * When `false`, the `gtfs_shapes` picker tab is hidden (fewer moving parts while the
 * shapes pipeline is optional). Flip to `true` to bring back line/point layouts.
 */
export const SHOW_GTFS_SHAPES_TAB = false;

/** Build the ordered table list for the transit UI (shapes schema varies by deployment). */
export function buildGtfsTableList(shapesMode: GtfsShapesSchemaMode): TableConfig[] {
  if (!SHOW_GTFS_SHAPES_TAB) {
    return [...GTFS_TABLES_BEFORE_SHAPES];
  }
  const shapes = shapesMode === 'point' ? GTFS_SHAPES_POINT : GTFS_SHAPES_LINE;
  return [...GTFS_TABLES_BEFORE_SHAPES, shapes];
}

/** Default list — assumes LineString `gtfs_shapes` until `probeGtfsShapesSchema` runs. */
export const GTFS_TABLES: TableConfig[] = buildGtfsTableList('line');

export function findTableConfig(name: string, list: TableConfig[] = GTFS_TABLES): TableConfig | undefined {
  return list.find((t) => t.name === name);
}
