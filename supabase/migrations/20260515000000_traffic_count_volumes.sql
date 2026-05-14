-- Volume detail rows for Vol4 traffic counts (one row per count / arm / vehicle / period slice).
-- Recreated standalone: references public.traffic_counts(count_id) only.

DROP TABLE IF EXISTS public.traffic_count_volumes CASCADE;

CREATE TABLE public.traffic_count_volumes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  count_id integer NOT NULL REFERENCES public.traffic_counts (count_id) ON DELETE CASCADE,
  from_arm smallint NOT NULL,
  to_arm smallint NOT NULL,
  vehicle_type text NOT NULL,
  period_start time without time zone NOT NULL,
  volume integer NOT NULL,
  CONSTRAINT traffic_count_volumes_volume_non_negative CHECK (volume >= 0)
);

CREATE INDEX traffic_count_volumes_count_id_idx ON public.traffic_count_volumes (count_id);

COMMENT ON TABLE public.traffic_count_volumes IS 'Vol4 vol4data.csv rows; seed script limits by survey year and max row count.';
