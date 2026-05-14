import { z } from 'zod';

const nullableNumber = z.coerce.number().nullable();
const toneSchema = z.enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple']);

export const accidentsKpiSchema = z.object({
  total_accidents: z.coerce.number(),
  total_fatalities: z.coerce.number(),
  fatality_rate: nullableNumber,
  most_dangerous_city: z.string().nullable(),
  most_dangerous_city_accidents: z.coerce.number().nullable(),
});

export const cityDangerRankingSchema = z.object({
  rank: z.coerce.number(),
  city: z.string(),
  total_accidents: z.coerce.number(),
  fatalities: z.coerce.number(),
  severe_injuries: z.coerce.number(),
  light_injuries: z.coerce.number(),
  pedestrian_injuries: z.coerce.number(),
  total_injuries: z.coerce.number(),
  population: z.coerce.number(),
  area_sqm: z.coerce.number(),
  severity_score: z.coerce.number(),
  rate_per_1000_residents: nullableNumber,
  density_per_sqkm: nullableNumber,
  fatality_rate: nullableNumber,
  pedestrian_share: nullableNumber,
  severity_tone: toneSchema,
});

export const statisticalHotspotSchema = z.object({
  city: z.string(),
  area_id: z.coerce.number(),
  accidents: z.coerce.number(),
  population: z.coerce.number(),
  rate_per_1000_residents: nullableNumber,
  z_score: nullableNumber,
  is_hotspot: z.boolean(),
});

export const demographicsByCitySchema = z.object({
  city: z.string(),
  inj0_19: z.coerce.number(),
  inj20_64: z.coerce.number(),
  inj65_: z.coerce.number(),
  injtotal: z.coerce.number(),
  private_vehicle: z.coerce.number(),
  motorcycle: z.coerce.number(),
  truck: z.coerce.number(),
  bicycle: z.coerce.number(),
  pedestrian: z.coerce.number(),
});

export const landUseSchema = z.object({
  mainuse: z.string(),
  total_accidents: z.coerce.number(),
  area_sqm: z.coerce.number(),
  intensity_per_sqkm: nullableNumber,
  intensity_vs_average: nullableNumber,
});

export const insightSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  metric_value: nullableNumber,
  metric_unit: z.string(),
  tone: toneSchema,
});

export const accidentClusterSchema = z.object({
  cluster_id: z.coerce.number(),
  member_count: z.coerce.number(),
  total_accidents_in_cluster: z.coerce.number(),
  cluster_centroid: z.unknown().nullable(),
});

export type SeverityTone = z.infer<typeof toneSchema>;
export type AccidentsKpi = z.infer<typeof accidentsKpiSchema>;
export type CityDangerRanking = z.infer<typeof cityDangerRankingSchema>;
export type StatisticalHotspot = z.infer<typeof statisticalHotspotSchema>;
export type DemographicsByCity = z.infer<typeof demographicsByCitySchema>;
export type LandUseStat = z.infer<typeof landUseSchema>;
export type AccidentInsight = z.infer<typeof insightSchema>;
export type AccidentCluster = z.infer<typeof accidentClusterSchema>;

export type RankingSortKey =
  | 'total_accidents'
  | 'severity_score'
  | 'rate_per_1000_residents'
  | 'density_per_sqkm'
  | 'fatality_rate'
  | 'pedestrian_share';

export interface SortState {
  key: RankingSortKey;
  dir: 'asc' | 'desc';
}
