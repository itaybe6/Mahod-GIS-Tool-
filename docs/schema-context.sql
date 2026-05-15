-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accidents (
  gov_oid integer,
  object_id integer NOT NULL,
  pop_2018 integer,
  usetype text,
  usetypecod smallint,
  city text,
  mainuse text,
  tazarea numeric,
  sumacciden integer,
  dead integer,
  sever_inj integer,
  sligh_inj integer,
  pedestrinj integer,
  inj0_19 integer,
  inj20_64 integer,
  inj65_ integer,
  injtotal integer,
  totdrivers integer,
  motorcycle integer,
  truck integer,
  bicycle integer,
  private_vehicle integer,
  vehicles integer,
  acc_index numeric,
  yearmonth integer NOT NULL,
  citycode integer,
  shape_length numeric,
  shape_area numeric,
  source_version text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  geom USER-DEFINED,
  CONSTRAINT accidents_pkey PRIMARY KEY (object_id)
);
CREATE TABLE public.data_sources (
  id integer NOT NULL DEFAULT nextval('data_sources_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  source_url text NOT NULL,
  last_checked_at timestamp with time zone,
  last_updated_at timestamp with time zone,
  file_hash text,
  file_size_bytes bigint,
  last_modified timestamp with time zone,
  record_count integer,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'error'::text, 'disabled'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT data_sources_pkey PRIMARY KEY (id)
);
CREATE TABLE public.gtfs_agency (
  agency_id integer NOT NULL,
  agency_name text NOT NULL,
  agency_url text,
  agency_phone text,
  agency_lang text DEFAULT 'he'::text,
  agency_timezone text DEFAULT 'Asia/Jerusalem'::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gtfs_agency_pkey PRIMARY KEY (agency_id)
);
CREATE TABLE public.gtfs_calendar (
  service_id integer NOT NULL,
  sunday boolean NOT NULL,
  monday boolean NOT NULL,
  tuesday boolean NOT NULL,
  wednesday boolean NOT NULL,
  thursday boolean NOT NULL,
  friday boolean NOT NULL,
  saturday boolean NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  source_version text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gtfs_calendar_pkey PRIMARY KEY (service_id)
);
CREATE TABLE public.gtfs_routes (
  route_id integer NOT NULL,
  agency_id integer,
  route_short_name text,
  route_long_name text,
  route_desc text,
  route_type smallint,
  source_version text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gtfs_routes_pkey PRIMARY KEY (route_id),
  CONSTRAINT gtfs_routes_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.gtfs_agency(agency_id)
);
CREATE TABLE public.gtfs_shapes (
  shape_id integer NOT NULL,
  geom USER-DEFINED NOT NULL,
  point_count integer,
  source_version text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gtfs_shapes_pkey PRIMARY KEY (shape_id)
);
CREATE TABLE public.gtfs_stop_route (
  stop_id integer NOT NULL,
  route_id integer NOT NULL,
  direction_id smallint NOT NULL,
  source_version text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gtfs_stop_route_pkey PRIMARY KEY (stop_id, route_id, direction_id),
  CONSTRAINT gtfs_stop_route_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES public.gtfs_stops(stop_id),
  CONSTRAINT gtfs_stop_route_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.gtfs_routes(route_id)
);
CREATE TABLE public.gtfs_stops (
  stop_id integer NOT NULL,
  stop_code integer,
  stop_name text NOT NULL,
  stop_desc text,
  location_type smallint DEFAULT 0,
  zone_id text,
  geom USER-DEFINED,
  source_version text,
  updated_at timestamp with time zone DEFAULT now(),
  stop_lat double precision,
  stop_lon double precision,
  CONSTRAINT gtfs_stops_pkey PRIMARY KEY (stop_id)
);
CREATE TABLE public.gtfs_trips (
  trip_id text NOT NULL,
  route_id integer,
  service_id integer,
  trip_headsign text,
  direction_id smallint,
  shape_id integer,
  wheelchair_accessible smallint DEFAULT 0,
  source_version text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT gtfs_trips_pkey PRIMARY KEY (trip_id),
  CONSTRAINT gtfs_trips_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.gtfs_routes(route_id),
  CONSTRAINT gtfs_trips_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.gtfs_calendar(service_id)
);
CREATE TABLE public.infra_metro_stations (
  station_id text NOT NULL,
  station_name text NOT NULL,
  line_id text,
  status text DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['operational'::text, 'under_construction'::text, 'planned'::text])),
  geom USER-DEFINED,
  source_url text,
  source_version text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT infra_metro_stations_pkey PRIMARY KEY (station_id)
);
CREATE TABLE public.infra_railway_stations (
  id integer NOT NULL DEFAULT nextval('infra_railway_stations_id_seq'::regclass),
  station_id integer UNIQUE,
  station_name text NOT NULL,
  station_name_en text,
  station_name_ar text,
  is_active boolean DEFAULT true,
  has_parking boolean,
  platforms smallint,
  geom USER-DEFINED,
  source_url text,
  source_version text,
  updated_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['operational'::text, 'under_construction'::text, 'planned'::text])),
  CONSTRAINT infra_railway_stations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.municipalities (
  id integer NOT NULL DEFAULT nextval('municipalities_id_seq'::regclass),
  semel_yishuv integer UNIQUE,
  name_he text NOT NULL,
  name_en text,
  nafa text,
  mahoz text,
  maamad smallint,
  area_sqkm numeric,
  population integer,
  geom USER-DEFINED,
  source_version text,
  updated_at timestamp with time zone DEFAULT now(),
  sug_muni text,
  cr_pnim text,
  eshkol_name text,
  sign_date date,
  last_tikun date,
  shape_length_m numeric,
  notes text,
  geom_json text,
  CONSTRAINT municipalities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.road_authorities (
  id integer NOT NULL DEFAULT nextval('road_authorities_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  short_name text,
  authority_type text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT road_authorities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.road_authority_network (
  id integer NOT NULL DEFAULT nextval('road_authority_network_id_seq'::regclass),
  trafcode integer,
  trafauth text,
  roadname text,
  roadnumber integer,
  yearmonth integer,
  shape_leng double precision,
  geom USER-DEFINED NOT NULL,
  CONSTRAINT road_authority_network_pkey PRIMARY KEY (id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.traffic_count_volumes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  count_id integer NOT NULL,
  from_arm smallint NOT NULL,
  to_arm smallint NOT NULL,
  vehicle_type text NOT NULL,
  period_start time without time zone NOT NULL,
  volume integer NOT NULL CHECK (volume >= 0),
  CONSTRAINT traffic_count_volumes_pkey PRIMARY KEY (id),
  CONSTRAINT traffic_count_volumes_count_id_fkey FOREIGN KEY (count_id) REFERENCES public.traffic_counts(count_id)
);
CREATE TABLE public.traffic_counts (
  count_id integer NOT NULL,
  count_type text NOT NULL,
  description text NOT NULL,
  count_date date NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  period_min smallint,
  client text,
  executor text,
  arms_count smallint,
  arms_data jsonb,
  x_itm numeric,
  y_itm numeric,
  geom USER-DEFINED,
  source text DEFAULT 'vol4'::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT traffic_counts_pkey PRIMARY KEY (count_id)
);
CREATE TABLE public.traffic_vehicle_types (
  code integer NOT NULL,
  name text NOT NULL,
  maintype text,
  group_type text,
  usage_type text,
  palestinian boolean DEFAULT false,
  CONSTRAINT traffic_vehicle_types_pkey PRIMARY KEY (code)
);
CREATE TABLE public.update_log (
  id integer NOT NULL DEFAULT nextval('update_log_id_seq'::regclass),
  source_id integer,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  status text NOT NULL DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'failed'::text, 'skipped'::text, 'rolled_back'::text])),
  trigger text DEFAULT 'scheduled'::text CHECK (trigger = ANY (ARRAY['scheduled'::text, 'manual'::text, 'force'::text])),
  rows_inserted integer DEFAULT 0,
  rows_updated integer DEFAULT 0,
  rows_deleted integer DEFAULT 0,
  error_message text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT update_log_pkey PRIMARY KEY (id),
  CONSTRAINT update_log_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.data_sources(id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  full_name text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_saved_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bucket_id text NOT NULL DEFAULT 'user-uploads'::text CHECK (bucket_id = 'user-uploads'::text),
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  content_type text,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_saved_files_pkey PRIMARY KEY (id),
  CONSTRAINT user_saved_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
