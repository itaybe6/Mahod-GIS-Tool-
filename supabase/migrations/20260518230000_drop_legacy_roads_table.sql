-- `roads` was the legacy 4326 road segment table.
-- `query_roads_in_polygon` now reads from `road_authority_network`.
DROP TABLE IF EXISTS public.roads;
