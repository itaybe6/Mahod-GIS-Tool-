-- Standard GTFS shapes.txt: one row per shape point (replaces aggregated LineString design).
DROP TABLE IF EXISTS public.gtfs_shapes;

CREATE TABLE public.gtfs_shapes (
  shape_id          INTEGER NOT NULL,
  shape_pt_lat      DOUBLE PRECISION NOT NULL,
  shape_pt_lon      DOUBLE PRECISION NOT NULL,
  shape_pt_sequence INTEGER NOT NULL,
  PRIMARY KEY (shape_id, shape_pt_sequence)
);

CREATE INDEX idx_gtfs_shapes_shape_id ON public.gtfs_shapes (shape_id);

COMMENT ON TABLE public.gtfs_shapes IS
  'GTFS shapes.txt — composite PK (shape_id, shape_pt_sequence); matches MOT feed for CSV import.';
