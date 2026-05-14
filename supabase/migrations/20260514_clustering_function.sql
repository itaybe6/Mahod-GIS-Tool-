-- Formula: DBSCAN over centroids of accident TAZ polygons whose accident count is above the caller threshold.
-- Answers: where do high-accident statistical areas form spatial clusters once `accidents.geom` is loaded?
CREATE OR REPLACE FUNCTION public.get_accident_clusters(min_accidents int DEFAULT 1)
RETURNS TABLE (
  cluster_id integer,
  member_count integer,
  total_accidents_in_cluster bigint,
  cluster_centroid jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH threshold AS (
    SELECT GREATEST(
      COALESCE(min_accidents, 1)::numeric,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY COALESCE(sumacciden, 0)), 0)
    ) AS min_cluster_accidents
    FROM public.accidents
    WHERE geom IS NOT NULL
  ),
  candidates AS (
    SELECT
      object_id,
      COALESCE(sumacciden, 0)::integer AS accidents,
      ST_Centroid(geom) AS centroid_geom
    FROM public.accidents
    CROSS JOIN threshold
    WHERE geom IS NOT NULL
      AND COALESCE(sumacciden, 0) > threshold.min_cluster_accidents
  ),
  clustered AS (
    SELECT
      object_id,
      accidents,
      centroid_geom,
      ST_ClusterDBSCAN(
        ST_Transform(centroid_geom, 2039),
        eps := 2000,
        minpoints := 3
      ) OVER () AS cid
    FROM candidates
  )
  SELECT
    cid::integer AS cluster_id,
    COUNT(*)::integer AS member_count,
    SUM(accidents)::bigint AS total_accidents_in_cluster,
    ST_AsGeoJSON(ST_Transform(ST_Centroid(ST_Collect(ST_Transform(centroid_geom, 2039))), 4326))::jsonb AS cluster_centroid
  FROM clustered
  WHERE cid IS NOT NULL
  GROUP BY cid
  ORDER BY total_accidents_in_cluster DESC, member_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_accident_clusters(int) TO anon, authenticated;
