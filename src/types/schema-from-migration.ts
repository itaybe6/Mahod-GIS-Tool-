/**
 * כל טיפוסי הטבלאות, הוויוס והפונקציה לפי
 * `supabase/migrations/20260513120000_initial_schema.sql`
 * והמיגרציות האינקרמנטליות תחת `supabase/migrations`.
 *
 * המבנה המלא (PostgREST / Supabase) מוגדר ב־`src/lib/supabase/types.ts` כ־`Database`.
 * כאן רק ייצוא נוח לשמות קצרים — עדכן את `Database` כשהמיגרציה משתנה.
 */

import type { Database } from '../lib/supabase/types';

type PublicSchema = Database['public'];
type Tables = PublicSchema['Tables'];
type Views = PublicSchema['Views'];
type Functions = PublicSchema['Functions'];

// --- מערכת ---

export type DataSourcesRow = Tables['data_sources']['Row'];
export type DataSourcesInsert = Tables['data_sources']['Insert'];
export type DataSourcesUpdate = Tables['data_sources']['Update'];

export type UpdateLogRow = Tables['update_log']['Row'];
export type UpdateLogInsert = Tables['update_log']['Insert'];
export type UpdateLogUpdate = Tables['update_log']['Update'];

// --- GTFS ---

export type GtfsAgencyRow = Tables['gtfs_agency']['Row'];
export type GtfsAgencyInsert = Tables['gtfs_agency']['Insert'];
export type GtfsAgencyUpdate = Tables['gtfs_agency']['Update'];

export type GtfsRoutesRow = Tables['gtfs_routes']['Row'];
export type GtfsRoutesInsert = Tables['gtfs_routes']['Insert'];
export type GtfsRoutesUpdate = Tables['gtfs_routes']['Update'];

export type GtfsStopsRow = Tables['gtfs_stops']['Row'];
export type GtfsStopsInsert = Tables['gtfs_stops']['Insert'];
export type GtfsStopsUpdate = Tables['gtfs_stops']['Update'];

export type GtfsCalendarRow = Tables['gtfs_calendar']['Row'];
export type GtfsCalendarInsert = Tables['gtfs_calendar']['Insert'];
export type GtfsCalendarUpdate = Tables['gtfs_calendar']['Update'];

export type GtfsTripsRow = Tables['gtfs_trips']['Row'];
export type GtfsTripsInsert = Tables['gtfs_trips']['Insert'];
export type GtfsTripsUpdate = Tables['gtfs_trips']['Update'];

export type GtfsShapesRow = Tables['gtfs_shapes']['Row'];
export type GtfsShapesInsert = Tables['gtfs_shapes']['Insert'];
export type GtfsShapesUpdate = Tables['gtfs_shapes']['Update'];

export type GtfsStopRouteRow = Tables['gtfs_stop_route']['Row'];
export type GtfsStopRouteInsert = Tables['gtfs_stop_route']['Insert'];
export type GtfsStopRouteUpdate = Tables['gtfs_stop_route']['Update'];

// --- תאונות ---

export type AccidentsRow = Tables['accidents']['Row'];
export type AccidentsInsert = Tables['accidents']['Insert'];
export type AccidentsUpdate = Tables['accidents']['Update'];

// --- רשויות / דרכים ---

export type RoadAuthoritiesRow = Tables['road_authorities']['Row'];
export type RoadAuthoritiesInsert = Tables['road_authorities']['Insert'];
export type RoadAuthoritiesUpdate = Tables['road_authorities']['Update'];

export type RoadAuthorityNetworkRow = Tables['road_authority_network']['Row'];
export type RoadAuthorityNetworkInsert = Tables['road_authority_network']['Insert'];
export type RoadAuthorityNetworkUpdate = Tables['road_authority_network']['Update'];

// --- תשתיות ---

export type InfraRailwayStationsRow = Tables['infra_railway_stations']['Row'];
export type InfraRailwayStationsInsert = Tables['infra_railway_stations']['Insert'];
export type InfraRailwayStationsUpdate = Tables['infra_railway_stations']['Update'];

export type InfraRailwayLinesRow = Tables['infra_railway_lines']['Row'];
export type InfraRailwayLinesInsert = Tables['infra_railway_lines']['Insert'];
export type InfraRailwayLinesUpdate = Tables['infra_railway_lines']['Update'];

export type InfraMetroLinesRow = Tables['infra_metro_lines']['Row'];
export type InfraMetroLinesInsert = Tables['infra_metro_lines']['Insert'];
export type InfraMetroLinesUpdate = Tables['infra_metro_lines']['Update'];

export type InfraMetroStationsRow = Tables['infra_metro_stations']['Row'];
export type InfraMetroStationsInsert = Tables['infra_metro_stations']['Insert'];
export type InfraMetroStationsUpdate = Tables['infra_metro_stations']['Update'];

// --- מוניציפליות / ספירות ---

export type MunicipalitiesRow = Tables['municipalities']['Row'];
export type MunicipalitiesInsert = Tables['municipalities']['Insert'];
export type MunicipalitiesUpdate = Tables['municipalities']['Update'];

export type TrafficCountStationsRow = Tables['traffic_count_stations']['Row'];
export type TrafficCountStationsInsert = Tables['traffic_count_stations']['Insert'];
export type TrafficCountStationsUpdate = Tables['traffic_count_stations']['Update'];

export type TrafficCountsRow = Tables['traffic_counts']['Row'];
export type TrafficCountsInsert = Tables['traffic_counts']['Insert'];
export type TrafficCountsUpdate = Tables['traffic_counts']['Update'];

// --- Views ---

export type VAccidentsWithMunicipalityRow = Views['v_accidents_with_municipality']['Row'];

// --- פונקציית עזר ב-SQL ---

export type ItmToWgs84Args = Functions['itm_to_wgs84']['Args'];
export type ItmToWgs84Returns = Functions['itm_to_wgs84']['Returns'];

/** מפת שם טבלה → שורה (לשימוש גנרי). */
export type TableRows = {
  data_sources: DataSourcesRow;
  update_log: UpdateLogRow;
  gtfs_agency: GtfsAgencyRow;
  gtfs_routes: GtfsRoutesRow;
  gtfs_stops: GtfsStopsRow;
  gtfs_calendar: GtfsCalendarRow;
  gtfs_trips: GtfsTripsRow;
  gtfs_shapes: GtfsShapesRow;
  gtfs_stop_route: GtfsStopRouteRow;
  accidents: AccidentsRow;
  road_authorities: RoadAuthoritiesRow;
  road_authority_network: RoadAuthorityNetworkRow;
  infra_railway_stations: InfraRailwayStationsRow;
  infra_railway_lines: InfraRailwayLinesRow;
  infra_metro_lines: InfraMetroLinesRow;
  infra_metro_stations: InfraMetroStationsRow;
  municipalities: MunicipalitiesRow;
  traffic_count_stations: TrafficCountStationsRow;
  traffic_counts: TrafficCountsRow;
};

export type TableName = keyof TableRows;

/** מפת שם view → שורה. */
export type ViewRows = {
  v_accidents_with_municipality: VAccidentsWithMunicipalityRow;
};

export type { Database } from '../lib/supabase/types';
export type { Json, PgGeometry } from '../lib/supabase/types';
