-- Formula: global sums over public.accidents plus the city with the highest SUM(sumacciden).
-- Answers: what are the headline accident KPIs for the statistics page?
CREATE OR REPLACE VIEW public.v_accidents_kpi AS
WITH totals AS (
  SELECT
    COALESCE(SUM(COALESCE(sumacciden, 0)), 0)::bigint AS total_accidents,
    COALESCE(SUM(COALESCE(dead, 0)), 0)::bigint AS total_fatalities
  FROM public.accidents
),
city_totals AS (
  SELECT
    COALESCE(NULLIF(TRIM(city), ''), 'לא ידוע') AS city,
    COALESCE(SUM(COALESCE(sumacciden, 0)), 0)::bigint AS accidents
  FROM public.accidents
  GROUP BY COALESCE(NULLIF(TRIM(city), ''), 'לא ידוע')
),
most_dangerous AS (
  SELECT city, accidents
  FROM city_totals
  ORDER BY accidents DESC, city ASC
  LIMIT 1
)
SELECT
  totals.total_accidents,
  totals.total_fatalities,
  ROUND((totals.total_fatalities::numeric / NULLIF(totals.total_accidents, 0)) * 100, 2) AS fatality_rate,
  most_dangerous.city AS most_dangerous_city,
  most_dangerous.accidents AS most_dangerous_city_accidents
FROM totals
CROSS JOIN most_dangerous;

-- Formula: per-city weighted severity, population-normalized rate, area density, fatality rate and pedestrian share.
-- Answers: which cities are most dangerous after comparing absolute, normalized and severity-weighted accident signals?
CREATE OR REPLACE VIEW public.v_city_danger_ranking AS
WITH city_rollup AS (
  SELECT
    COALESCE(NULLIF(TRIM(city), ''), 'לא ידוע') AS city,
    COALESCE(SUM(COALESCE(sumacciden, 0)), 0)::bigint AS total_accidents,
    COALESCE(SUM(COALESCE(dead, 0)), 0)::bigint AS fatalities,
    COALESCE(SUM(COALESCE(sever_inj, 0)), 0)::bigint AS severe_injuries,
    COALESCE(SUM(COALESCE(sligh_inj, 0)), 0)::bigint AS light_injuries,
    COALESCE(SUM(COALESCE(pedestrinj, 0)), 0)::bigint AS pedestrian_injuries,
    COALESCE(SUM(COALESCE(injtotal, 0)), 0)::bigint AS total_injuries,
    COALESCE(SUM(COALESCE(pop_2018, 0)), 0)::bigint AS population,
    COALESCE(SUM(COALESCE(tazarea, 0)), 0)::numeric AS area_sqm
  FROM public.accidents
  GROUP BY COALESCE(NULLIF(TRIM(city), ''), 'לא ידוע')
),
scored AS (
  SELECT
    *,
    ((fatalities * 10) + (severe_injuries * 3) + light_injuries)::bigint AS severity_score,
    ROUND((total_accidents::numeric / NULLIF(population, 0)) * 1000, 2) AS rate_per_1000_residents,
    ROUND((total_accidents::numeric / NULLIF(area_sqm, 0)) * 1000000, 2) AS density_per_sqkm,
    ROUND((fatalities::numeric / NULLIF(total_accidents, 0)) * 100, 2) AS fatality_rate,
    ROUND((pedestrian_injuries::numeric / NULLIF(total_injuries, 0)) * 100, 2) AS pedestrian_share
  FROM city_rollup
)
SELECT
  ROW_NUMBER() OVER (ORDER BY severity_score DESC, total_accidents DESC, city ASC)::integer AS rank,
  city,
  total_accidents,
  fatalities,
  severe_injuries,
  light_injuries,
  pedestrian_injuries,
  total_injuries,
  population,
  area_sqm,
  severity_score,
  rate_per_1000_residents,
  density_per_sqkm,
  fatality_rate,
  pedestrian_share,
  CASE
    WHEN CUME_DIST() OVER (ORDER BY severity_score DESC, total_accidents DESC, city ASC) <= 0.10 THEN 'red'
    WHEN CUME_DIST() OVER (ORDER BY severity_score DESC, total_accidents DESC, city ASC) <= 0.25 THEN 'orange'
    WHEN CUME_DIST() OVER (ORDER BY severity_score DESC, total_accidents DESC, city ASC) <= 0.50 THEN 'yellow'
    ELSE 'green'
  END AS severity_tone
FROM scored
WHERE total_accidents > 0;

-- Formula: z-score of each TAZ accident rate (`sumacciden / pop_2018`) against all valid TAZ rates.
-- Answers: which statistical areas are anomalously dangerous even without geometry?
CREATE OR REPLACE VIEW public.v_statistical_hotspots AS
WITH row_rates AS (
  SELECT
    object_id AS area_id,
    COALESCE(NULLIF(TRIM(city), ''), 'לא ידוע') AS city,
    COALESCE(sumacciden, 0)::integer AS accidents,
    COALESCE(pop_2018, 0)::integer AS population,
    CASE
      WHEN COALESCE(pop_2018, 0) > 0 THEN COALESCE(sumacciden, 0)::numeric / pop_2018
      ELSE NULL
    END AS rate
  FROM public.accidents
),
stats AS (
  SELECT
    AVG(rate) AS avg_rate,
    STDDEV_SAMP(rate) AS stddev_rate
  FROM row_rates
  WHERE rate IS NOT NULL
)
SELECT
  row_rates.city,
  row_rates.area_id,
  row_rates.accidents,
  row_rates.population,
  ROUND(row_rates.rate * 1000, 2) AS rate_per_1000_residents,
  ROUND((row_rates.rate - stats.avg_rate) / NULLIF(stats.stddev_rate, 0), 2) AS z_score,
  COALESCE(((row_rates.rate - stats.avg_rate) / NULLIF(stats.stddev_rate, 0)) > 2, false) AS is_hotspot
FROM row_rates
CROSS JOIN stats
WHERE row_rates.rate IS NOT NULL
ORDER BY is_hotspot DESC, z_score DESC NULLS LAST, accidents DESC;

-- Formula: injury and vehicle totals grouped by city plus an all-cities row.
-- Answers: what age and vehicle mix should be rendered for the selected city filter?
CREATE OR REPLACE VIEW public.v_accidents_demographics_by_city AS
SELECT
  COALESCE(NULLIF(TRIM(city), ''), 'לא ידוע') AS city,
  COALESCE(SUM(COALESCE(inj0_19, 0)), 0)::bigint AS inj0_19,
  COALESCE(SUM(COALESCE(inj20_64, 0)), 0)::bigint AS inj20_64,
  COALESCE(SUM(COALESCE(inj65_, 0)), 0)::bigint AS inj65_,
  COALESCE(SUM(COALESCE(injtotal, 0)), 0)::bigint AS injtotal,
  COALESCE(SUM(COALESCE(private_vehicle, 0)), 0)::bigint AS private_vehicle,
  COALESCE(SUM(COALESCE(motorcycle, 0)), 0)::bigint AS motorcycle,
  COALESCE(SUM(COALESCE(truck, 0)), 0)::bigint AS truck,
  COALESCE(SUM(COALESCE(bicycle, 0)), 0)::bigint AS bicycle,
  COALESCE(SUM(COALESCE(pedestrinj, 0)), 0)::bigint AS pedestrian
FROM public.accidents
GROUP BY COALESCE(NULLIF(TRIM(city), ''), 'לא ידוע')
UNION ALL
SELECT
  'כל הארץ' AS city,
  COALESCE(SUM(COALESCE(inj0_19, 0)), 0)::bigint,
  COALESCE(SUM(COALESCE(inj20_64, 0)), 0)::bigint,
  COALESCE(SUM(COALESCE(inj65_, 0)), 0)::bigint,
  COALESCE(SUM(COALESCE(injtotal, 0)), 0)::bigint,
  COALESCE(SUM(COALESCE(private_vehicle, 0)), 0)::bigint,
  COALESCE(SUM(COALESCE(motorcycle, 0)), 0)::bigint,
  COALESCE(SUM(COALESCE(truck, 0)), 0)::bigint,
  COALESCE(SUM(COALESCE(bicycle, 0)), 0)::bigint,
  COALESCE(SUM(COALESCE(pedestrinj, 0)), 0)::bigint
FROM public.accidents;

-- Formula: accidents and accident intensity (`SUM(sumacciden) / SUM(tazarea) * 1,000,000`) grouped by main land use.
-- Answers: which land-use categories concentrate accidents per square kilometer?
CREATE OR REPLACE VIEW public.v_accidents_land_use AS
WITH land_use AS (
  SELECT
    COALESCE(NULLIF(TRIM(mainuse), ''), 'לא ידוע') AS mainuse,
    COALESCE(SUM(COALESCE(sumacciden, 0)), 0)::bigint AS total_accidents,
    COALESCE(SUM(COALESCE(tazarea, 0)), 0)::numeric AS area_sqm
  FROM public.accidents
  GROUP BY COALESCE(NULLIF(TRIM(mainuse), ''), 'לא ידוע')
),
avg_all AS (
  SELECT
    (SUM(total_accidents)::numeric / NULLIF(SUM(area_sqm), 0)) * 1000000 AS average_intensity_per_sqkm
  FROM land_use
)
SELECT
  land_use.mainuse,
  land_use.total_accidents,
  land_use.area_sqm,
  ROUND((land_use.total_accidents::numeric / NULLIF(land_use.area_sqm, 0)) * 1000000, 2) AS intensity_per_sqkm,
  ROUND(
    ((land_use.total_accidents::numeric / NULLIF(land_use.area_sqm, 0)) * 1000000)
      / NULLIF(avg_all.average_intensity_per_sqkm, 0),
    2
  ) AS intensity_vs_average
FROM land_use
CROSS JOIN avg_all
WHERE land_use.total_accidents > 0
ORDER BY intensity_per_sqkm DESC NULLS LAST;

-- Formula: SQL-generated cards from aggregate comparisons across city size, land use, vehicle mix and density.
-- Answers: what data-backed textual insights can the statistics page surface automatically?
CREATE OR REPLACE VIEW public.v_accidents_insights AS
WITH city_stats AS (
  SELECT
    COALESCE(NULLIF(TRIM(city), ''), 'לא ידוע') AS city,
    SUM(COALESCE(pop_2018, 0))::numeric AS population,
    SUM(COALESCE(sumacciden, 0))::numeric AS accidents,
    SUM(COALESCE(dead, 0))::numeric AS deaths
  FROM public.accidents
  GROUP BY COALESCE(NULLIF(TRIM(city), ''), 'לא ידוע')
),
city_groups AS (
  SELECT
    AVG((deaths / NULLIF(accidents, 0)) * 100) FILTER (WHERE population > 50000 AND accidents > 0) AS large_city_fatality_rate,
    AVG((deaths / NULLIF(accidents, 0)) * 100) FILTER (WHERE population <= 50000 AND accidents > 0) AS other_city_fatality_rate
  FROM city_stats
),
land_stats AS (
  SELECT
    COALESCE(NULLIF(TRIM(mainuse), ''), 'לא ידוע') AS mainuse,
    SUM(COALESCE(pedestrinj, 0))::numeric AS pedestrian,
    SUM(COALESCE(injtotal, 0))::numeric AS injuries
  FROM public.accidents
  GROUP BY COALESCE(NULLIF(TRIM(mainuse), ''), 'לא ידוע')
),
vehicle_stats AS (
  SELECT
    SUM(COALESCE(motorcycle, 0))::numeric AS motorcycle,
    SUM(COALESCE(private_vehicle, 0) + COALESCE(motorcycle, 0) + COALESCE(truck, 0) + COALESCE(bicycle, 0))::numeric AS known_vehicles,
    SUM(COALESCE(sever_inj, 0))::numeric AS severe,
    SUM(COALESCE(injtotal, 0))::numeric AS injuries
  FROM public.accidents
),
land_density AS (
  SELECT *
  FROM public.v_accidents_land_use
  ORDER BY intensity_per_sqkm DESC NULLS LAST
  LIMIT 1
)
SELECT
  'large_city_fatality' AS id,
  'ערים גדולות מול שאר הערים' AS title,
  CASE
    WHEN city_groups.large_city_fatality_rate IS NULL OR city_groups.other_city_fatality_rate IS NULL THEN
      'אין מספיק נתונים להשוואת שיעור קטלניות לפי גודל עיר.'
    ELSE
      'בערים עם מעל 50,000 תושבים שיעור הקטלניות גבוה ב־'
      || ROUND(((city_groups.large_city_fatality_rate / NULLIF(city_groups.other_city_fatality_rate, 0)) - 1) * 100, 1)
      || '% לעומת ערים קטנות יותר.'
  END AS body,
  ROUND(((city_groups.large_city_fatality_rate / NULLIF(city_groups.other_city_fatality_rate, 0)) - 1) * 100, 1) AS metric_value,
  '%' AS metric_unit,
  'orange' AS tone
FROM city_groups
UNION ALL
SELECT
  'pedestrian_land_use' AS id,
  'פגיעות הולכי רגל לפי שימוש קרקע' AS title,
  'במגורים פגיעות הולכי רגל נפוצות פי '
    || ROUND(
      (MAX(pedestrian / NULLIF(injuries, 0)) FILTER (WHERE mainuse = 'מגורים'))
        / NULLIF(MAX(pedestrian / NULLIF(injuries, 0)) FILTER (WHERE mainuse = 'שטח פתוח'), 0),
      2
    )
    || ' לעומת שטח פתוח.' AS body,
  ROUND(
    (MAX(pedestrian / NULLIF(injuries, 0)) FILTER (WHERE mainuse = 'מגורים'))
      / NULLIF(MAX(pedestrian / NULLIF(injuries, 0)) FILTER (WHERE mainuse = 'שטח פתוח'), 0),
    2
  ) AS metric_value,
  'x' AS metric_unit,
  'red' AS tone
FROM land_stats
UNION ALL
SELECT
  'motorcycle_mix' AS id,
  'מעורבות אופנועים' AS title,
  'אופנועים הם '
    || ROUND((motorcycle / NULLIF(known_vehicles, 0)) * 100, 1)
    || '% מכלי הרכב המעורבים, בזמן שפגיעות קשות הן '
    || ROUND((severe / NULLIF(injuries, 0)) * 100, 1)
    || '% מכלל הנפגעים.' AS body,
  ROUND((motorcycle / NULLIF(known_vehicles, 0)) * 100, 1) AS metric_value,
  '%' AS metric_unit,
  'yellow' AS tone
FROM vehicle_stats
UNION ALL
SELECT
  'land_use_density' AS id,
  'שימוש הקרקע הצפוף ביותר בתאונות' AS title,
  'באזורי '
    || mainuse
    || ' עוצמת התאונות גבוהה פי '
    || COALESCE(intensity_vs_average::text, '0')
    || ' מהממוצע הארצי למ״ר.' AS body,
  intensity_vs_average AS metric_value,
  'x' AS metric_unit,
  'green' AS tone
FROM land_density;

GRANT SELECT ON
  public.v_accidents_kpi,
  public.v_city_danger_ranking,
  public.v_statistical_hotspots,
  public.v_accidents_demographics_by_city,
  public.v_accidents_land_use,
  public.v_accidents_insights
TO anon, authenticated;
