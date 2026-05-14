/**
 * Database types aligned with `supabase/migrations/20260513120000_initial_schema.sql`
 * plus incremental migrations in `supabase/migrations`.
 * Regenerate from the hosted project when the live schema diverges:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/generated.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** PostGIS geometry as returned by PostgREST (EWKB hex or GeoJSON string, depending on headers). */
export type PgGeometry = string;

type DataSourceStatus = 'active' | 'error' | 'disabled';
type UpdateLogStatus = 'running' | 'success' | 'failed' | 'skipped' | 'rolled_back';
type UpdateLogTrigger = 'scheduled' | 'manual' | 'force';
type InfraLineStatus = 'operational' | 'under_construction' | 'planned';

export type Database = {
  public: {
    Tables: {
      accidents: {
        Row: {
          pk_teuna_fikt: string;
          sug_tik: number | null;
          thum_geografi: number | null;
          sug_dereh: number | null;
          semel_yishuv: number | null;
          rehov1: number | null;
          rehov2: number | null;
          bayit: number | null;
          zomet_ironi: number | null;
          kvish1: number | null;
          kvish2: number | null;
          km: string | null;
          zomet_lo_ironi: number | null;
          yehida: number | null;
          shnat_teuna: number;
          hodesh_teuna: number | null;
          shaa: number | null;
          sug_yom: number | null;
          yom_layla: number | null;
          yom_bashavua: number | null;
          humrat_teuna: number;
          sug_teuna: number | null;
          had_maslul: number | null;
          rav_maslul: number | null;
          mehirut_muteret: number | null;
          tkinut: number | null;
          rohav: number | null;
          simun_timrur: number | null;
          teura: number | null;
          mezeg_avir: number | null;
          pne_kvish: number | null;
          sug_ezem: number | null;
          merhak_ezem: number | null;
          lo_haza: number | null;
          ofen_haziya: number | null;
          mekom_haziya: number | null;
          kivun_haziya: number | null;
          mahoz: number | null;
          nafa: number | null;
          ezor_tivi: number | null;
          maamad_minizipali: number | null;
          zurat_ishuv: number | null;
          status_igun: number | null;
          x_itm: number | null;
          y_itm: number | null;
          geom: PgGeometry | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          pk_teuna_fikt: string;
          sug_tik?: number | null;
          thum_geografi?: number | null;
          sug_dereh?: number | null;
          semel_yishuv?: number | null;
          rehov1?: number | null;
          rehov2?: number | null;
          bayit?: number | null;
          zomet_ironi?: number | null;
          kvish1?: number | null;
          kvish2?: number | null;
          km?: string | null;
          zomet_lo_ironi?: number | null;
          yehida?: number | null;
          shnat_teuna: number;
          hodesh_teuna?: number | null;
          shaa?: number | null;
          sug_yom?: number | null;
          yom_layla?: number | null;
          yom_bashavua?: number | null;
          humrat_teuna: number;
          sug_teuna?: number | null;
          had_maslul?: number | null;
          rav_maslul?: number | null;
          mehirut_muteret?: number | null;
          tkinut?: number | null;
          rohav?: number | null;
          simun_timrur?: number | null;
          teura?: number | null;
          mezeg_avir?: number | null;
          pne_kvish?: number | null;
          sug_ezem?: number | null;
          merhak_ezem?: number | null;
          lo_haza?: number | null;
          ofen_haziya?: number | null;
          mekom_haziya?: number | null;
          kivun_haziya?: number | null;
          mahoz?: number | null;
          nafa?: number | null;
          ezor_tivi?: number | null;
          maamad_minizipali?: number | null;
          zurat_ishuv?: number | null;
          status_igun?: number | null;
          x_itm?: number | null;
          y_itm?: number | null;
          geom?: PgGeometry | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          pk_teuna_fikt?: string;
          sug_tik?: number | null;
          thum_geografi?: number | null;
          sug_dereh?: number | null;
          semel_yishuv?: number | null;
          rehov1?: number | null;
          rehov2?: number | null;
          bayit?: number | null;
          zomet_ironi?: number | null;
          kvish1?: number | null;
          kvish2?: number | null;
          km?: string | null;
          zomet_lo_ironi?: number | null;
          yehida?: number | null;
          shnat_teuna?: number;
          hodesh_teuna?: number | null;
          shaa?: number | null;
          sug_yom?: number | null;
          yom_layla?: number | null;
          yom_bashavua?: number | null;
          humrat_teuna?: number;
          sug_teuna?: number | null;
          had_maslul?: number | null;
          rav_maslul?: number | null;
          mehirut_muteret?: number | null;
          tkinut?: number | null;
          rohav?: number | null;
          simun_timrur?: number | null;
          teura?: number | null;
          mezeg_avir?: number | null;
          pne_kvish?: number | null;
          sug_ezem?: number | null;
          merhak_ezem?: number | null;
          lo_haza?: number | null;
          ofen_haziya?: number | null;
          mekom_haziya?: number | null;
          kivun_haziya?: number | null;
          mahoz?: number | null;
          nafa?: number | null;
          ezor_tivi?: number | null;
          maamad_minizipali?: number | null;
          zurat_ishuv?: number | null;
          status_igun?: number | null;
          x_itm?: number | null;
          y_itm?: number | null;
          geom?: PgGeometry | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      data_sources: {
        Row: {
          id: number;
          name: string;
          display_name: string;
          source_url: string;
          last_checked_at: string | null;
          last_updated_at: string | null;
          file_hash: string | null;
          file_size_bytes: string | null;
          last_modified: string | null;
          record_count: number | null;
          status: DataSourceStatus;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          display_name: string;
          source_url: string;
          last_checked_at?: string | null;
          last_updated_at?: string | null;
          file_hash?: string | null;
          file_size_bytes?: string | null;
          last_modified?: string | null;
          record_count?: number | null;
          status?: DataSourceStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          display_name?: string;
          source_url?: string;
          last_checked_at?: string | null;
          last_updated_at?: string | null;
          file_hash?: string | null;
          file_size_bytes?: string | null;
          last_modified?: string | null;
          record_count?: number | null;
          status?: DataSourceStatus;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gtfs_agency: {
        Row: {
          agency_id: number;
          agency_name: string;
          agency_url: string | null;
          agency_phone: string | null;
          agency_lang: string | null;
          agency_timezone: string | null;
          agency_fare_url: string | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          agency_id: number;
          agency_name: string;
          agency_url?: string | null;
          agency_phone?: string | null;
          agency_lang?: string | null;
          agency_timezone?: string | null;
          agency_fare_url?: string | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          agency_id?: number;
          agency_name?: string;
          agency_url?: string | null;
          agency_phone?: string | null;
          agency_lang?: string | null;
          agency_timezone?: string | null;
          agency_fare_url?: string | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      gtfs_calendar: {
        Row: {
          service_id: number;
          sunday: boolean;
          monday: boolean;
          tuesday: boolean;
          wednesday: boolean;
          thursday: boolean;
          friday: boolean;
          saturday: boolean;
          start_date: string;
          end_date: string;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          service_id: number;
          sunday: boolean;
          monday: boolean;
          tuesday: boolean;
          wednesday: boolean;
          thursday: boolean;
          friday: boolean;
          saturday: boolean;
          start_date: string;
          end_date: string;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          service_id?: number;
          sunday?: boolean;
          monday?: boolean;
          tuesday?: boolean;
          wednesday?: boolean;
          thursday?: boolean;
          friday?: boolean;
          saturday?: boolean;
          start_date?: string;
          end_date?: string;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      gtfs_routes: {
        Row: {
          route_id: number;
          agency_id: number | null;
          route_short_name: string | null;
          route_long_name: string | null;
          route_desc: string | null;
          route_type: number | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          route_id: number;
          agency_id?: number | null;
          route_short_name?: string | null;
          route_long_name?: string | null;
          route_desc?: string | null;
          route_type?: number | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          route_id?: number;
          agency_id?: number | null;
          route_short_name?: string | null;
          route_long_name?: string | null;
          route_desc?: string | null;
          route_type?: number | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gtfs_routes_agency_id_fkey';
            columns: ['agency_id'];
            isOneToOne: false;
            referencedRelation: 'gtfs_agency';
            referencedColumns: ['agency_id'];
          },
        ];
      };
      gtfs_stops: {
        Row: {
          stop_id: number;
          stop_code: number | null;
          stop_name: string;
          stop_desc: string | null;
          stop_lat: number | null;
          stop_lon: number | null;
          location_type: number | null;
          parent_station: number | null;
          zone_id: string | null;
          geom: PgGeometry | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          stop_id: number;
          stop_code?: number | null;
          stop_name: string;
          stop_desc?: string | null;
          stop_lat?: number | null;
          stop_lon?: number | null;
          location_type?: number | null;
          parent_station?: number | null;
          zone_id?: string | null;
          geom?: PgGeometry | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          stop_id?: number;
          stop_code?: number | null;
          stop_name?: string;
          stop_desc?: string | null;
          stop_lat?: number | null;
          stop_lon?: number | null;
          location_type?: number | null;
          parent_station?: number | null;
          zone_id?: string | null;
          geom?: PgGeometry | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      gtfs_trips: {
        Row: {
          trip_id: string;
          route_id: number | null;
          service_id: number | null;
          trip_headsign: string | null;
          direction_id: number | null;
          shape_id: number | null;
          wheelchair_accessible: number | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          trip_id: string;
          route_id?: number | null;
          service_id?: number | null;
          trip_headsign?: string | null;
          direction_id?: number | null;
          shape_id?: number | null;
          wheelchair_accessible?: number | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          trip_id?: string;
          route_id?: number | null;
          service_id?: number | null;
          trip_headsign?: string | null;
          direction_id?: number | null;
          shape_id?: number | null;
          wheelchair_accessible?: number | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gtfs_trips_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'gtfs_routes';
            referencedColumns: ['route_id'];
          },
          {
            foreignKeyName: 'gtfs_trips_service_id_fkey';
            columns: ['service_id'];
            isOneToOne: false;
            referencedRelation: 'gtfs_calendar';
            referencedColumns: ['service_id'];
          },
        ];
      };
      gtfs_shapes: {
        Row: {
          shape_id: number;
          geom: PgGeometry;
          point_count: number | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          shape_id: number;
          geom: PgGeometry;
          point_count?: number | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          shape_id?: number;
          geom?: PgGeometry;
          point_count?: number | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      gtfs_stop_route: {
        Row: {
          stop_id: number;
          route_id: number;
          direction_id: number;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          stop_id: number;
          route_id: number;
          direction_id: number;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          stop_id?: number;
          route_id?: number;
          direction_id?: number;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gtfs_stop_route_route_id_fkey';
            columns: ['route_id'];
            isOneToOne: false;
            referencedRelation: 'gtfs_routes';
            referencedColumns: ['route_id'];
          },
          {
            foreignKeyName: 'gtfs_stop_route_stop_id_fkey';
            columns: ['stop_id'];
            isOneToOne: false;
            referencedRelation: 'gtfs_stops';
            referencedColumns: ['stop_id'];
          },
        ];
      };
      infra_metro_lines: {
        Row: {
          id: number;
          line_id: string;
          line_name: string;
          line_color: string | null;
          line_type: string | null;
          status: InfraLineStatus;
          expected_open: number | null;
          geom: PgGeometry | null;
          source_url: string | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          line_id: string;
          line_name: string;
          line_color?: string | null;
          line_type?: string | null;
          status?: InfraLineStatus;
          expected_open?: number | null;
          geom?: PgGeometry | null;
          source_url?: string | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          line_id?: string;
          line_name?: string;
          line_color?: string | null;
          line_type?: string | null;
          status?: InfraLineStatus;
          expected_open?: number | null;
          geom?: PgGeometry | null;
          source_url?: string | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      infra_metro_stations: {
        Row: {
          id: number;
          station_id: string;
          station_name: string;
          line_id: string | null;
          status: string;
          geom: PgGeometry | null;
          source_url: string | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          station_id: string;
          station_name: string;
          line_id?: string | null;
          status?: string;
          geom?: PgGeometry | null;
          source_url?: string | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          station_id?: string;
          station_name?: string;
          line_id?: string | null;
          status?: string;
          geom?: PgGeometry | null;
          source_url?: string | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'infra_metro_stations_line_id_fkey';
            columns: ['line_id'];
            isOneToOne: false;
            referencedRelation: 'infra_metro_lines';
            referencedColumns: ['line_id'];
          },
        ];
      };
      infra_railway_lines: {
        Row: {
          id: number;
          line_id: string | null;
          line_name: string | null;
          line_type: string | null;
          status: InfraLineStatus;
          geom: PgGeometry | null;
          source_url: string | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          line_id?: string | null;
          line_name?: string | null;
          line_type?: string | null;
          status?: InfraLineStatus;
          geom?: PgGeometry | null;
          source_url?: string | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          line_id?: string | null;
          line_name?: string | null;
          line_type?: string | null;
          status?: InfraLineStatus;
          geom?: PgGeometry | null;
          source_url?: string | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      infra_railway_stations: {
        Row: {
          id: number;
          station_id: number | null;
          station_name: string;
          station_name_en: string | null;
          station_name_ar: string | null;
          is_active: boolean | null;
          has_parking: boolean | null;
          platforms: number | null;
          geom: PgGeometry | null;
          source_url: string | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          station_id?: number | null;
          station_name: string;
          station_name_en?: string | null;
          station_name_ar?: string | null;
          is_active?: boolean | null;
          has_parking?: boolean | null;
          platforms?: number | null;
          geom?: PgGeometry | null;
          source_url?: string | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          station_id?: number | null;
          station_name?: string;
          station_name_en?: string | null;
          station_name_ar?: string | null;
          is_active?: boolean | null;
          has_parking?: boolean | null;
          platforms?: number | null;
          geom?: PgGeometry | null;
          source_url?: string | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      municipalities: {
        Row: {
          id: number;
          semel_yishuv: number | null;
          name_he: string;
          name_en: string | null;
          nafa: number | null;
          mahoz: number | null;
          maamad: number | null;
          area_sqkm: string | null;
          population: number | null;
          geom: PgGeometry | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          semel_yishuv?: number | null;
          name_he: string;
          name_en?: string | null;
          nafa?: number | null;
          mahoz?: number | null;
          maamad?: number | null;
          area_sqkm?: string | null;
          population?: number | null;
          geom?: PgGeometry | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          semel_yishuv?: number | null;
          name_he?: string;
          name_en?: string | null;
          nafa?: number | null;
          mahoz?: number | null;
          maamad?: number | null;
          area_sqkm?: string | null;
          population?: number | null;
          geom?: PgGeometry | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      road_authorities: {
        Row: {
          id: number;
          name: string;
          short_name: string | null;
          authority_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          short_name?: string | null;
          authority_type?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          short_name?: string | null;
          authority_type?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      roads: {
        Row: {
          id: number;
          oid_original: number | null;
          trafcode: number | null;
          authority_id: number | null;
          road_name: string | null;
          road_number: number | null;
          year_month: string | null;
          shape_length: string | null;
          geom: PgGeometry | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          oid_original?: number | null;
          trafcode?: number | null;
          authority_id?: number | null;
          road_name?: string | null;
          road_number?: number | null;
          year_month?: string | null;
          shape_length?: string | null;
          geom?: PgGeometry | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          oid_original?: number | null;
          trafcode?: number | null;
          authority_id?: number | null;
          road_name?: string | null;
          road_number?: number | null;
          year_month?: string | null;
          shape_length?: string | null;
          geom?: PgGeometry | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'roads_authority_id_fkey';
            columns: ['authority_id'];
            isOneToOne: false;
            referencedRelation: 'road_authorities';
            referencedColumns: ['id'];
          },
        ];
      };
      traffic_count_stations: {
        Row: {
          id: number;
          station_id: string;
          station_name: string | null;
          road_number: number | null;
          km: string | null;
          direction: string | null;
          geom: PgGeometry | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          station_id: string;
          station_name?: string | null;
          road_number?: number | null;
          km?: string | null;
          direction?: string | null;
          geom?: PgGeometry | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          station_id?: string;
          station_name?: string | null;
          road_number?: number | null;
          km?: string | null;
          direction?: string | null;
          geom?: PgGeometry | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      traffic_counts: {
        Row: {
          id: string;
          station_id: string | null;
          count_date: string;
          hour: number | null;
          vehicle_type: string | null;
          volume: number | null;
          source_version: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          station_id?: string | null;
          count_date: string;
          hour?: number | null;
          vehicle_type?: string | null;
          volume?: number | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          station_id?: string | null;
          count_date?: string;
          hour?: number | null;
          vehicle_type?: string | null;
          volume?: number | null;
          source_version?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'traffic_counts_station_id_fkey';
            columns: ['station_id'];
            isOneToOne: false;
            referencedRelation: 'traffic_count_stations';
            referencedColumns: ['station_id'];
          },
        ];
      };
      update_log: {
        Row: {
          id: number;
          source_id: number | null;
          started_at: string;
          finished_at: string | null;
          status: UpdateLogStatus;
          trigger: UpdateLogTrigger;
          rows_inserted: number | null;
          rows_updated: number | null;
          rows_deleted: number | null;
          error_message: string | null;
          notes: string | null;
          metadata: Json;
        };
        Insert: {
          id?: number;
          source_id?: number | null;
          started_at?: string;
          finished_at?: string | null;
          status?: UpdateLogStatus;
          trigger?: UpdateLogTrigger;
          rows_inserted?: number | null;
          rows_updated?: number | null;
          rows_deleted?: number | null;
          error_message?: string | null;
          notes?: string | null;
          metadata?: Json;
        };
        Update: {
          id?: number;
          source_id?: number | null;
          started_at?: string;
          finished_at?: string | null;
          status?: UpdateLogStatus;
          trigger?: UpdateLogTrigger;
          rows_inserted?: number | null;
          rows_updated?: number | null;
          rows_deleted?: number | null;
          error_message?: string | null;
          notes?: string | null;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'update_log_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'data_sources';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      v_accidents_with_municipality: {
        Row: Database['public']['Tables']['accidents']['Row'] & {
          municipality_name: string | null;
          mahoz_code: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      itm_to_wgs84: {
        Args: { x_itm: number; y_itm: number };
        Returns: PgGeometry;
      };
      find_municipalities_for_polygon: {
        Args: { polygon_geojson: string };
        Returns: {
          municipalities: Array<{
            semel_yishuv: number | null;
            name_he: string;
            name_en: string | null;
            nafa: string | null;
            mahoz: string | null;
            overlap_area_m2: number;
            overlap_pct: number | null;
            /** True when the polygon doesn't overlap any municipality and this is the nearest one within 20km. */
            is_nearest: boolean;
            /** Distance (m) between the polygon and the municipality. `0` for direct overlaps. */
            distance_m: number;
          }>;
          polygon_area_m2: number;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
