import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import {
  accidentClusterSchema,
  accidentsKpiSchema,
  cityDangerRankingSchema,
  demographicsByCitySchema,
  insightSchema,
  landUseSchema,
  statisticalHotspotSchema,
  type AccidentCluster,
  type AccidentInsight,
  type AccidentsKpi,
  type CityDangerRanking,
  type DemographicsByCity,
  type LandUseStat,
  type StatisticalHotspot,
} from './types';

function errorMessage(error: { message?: string; details?: string; hint?: string }): string {
  return [error.message, error.details, error.hint].filter(Boolean).join(' — ') || 'שגיאת Supabase';
}

async function selectRows<T>(
  relation: string,
  schema: { parse: (value: unknown) => T },
  options?: {
    order?: { column: string; ascending?: boolean };
    limit?: number;
  }
): Promise<T[]> {
  let query = supabase.from(relation as never).select('*');

  if (options?.order) {
    query = query.order(options.order.column as never, {
      ascending: options.order.ascending ?? true,
    });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((row) => schema.parse(row));
}

export async function fetchAccidentsKpi(): Promise<AccidentsKpi> {
  const rows = await selectRows('v_accidents_kpi', accidentsKpiSchema);
  return (
    rows[0] ?? {
      total_accidents: 0,
      total_fatalities: 0,
      fatality_rate: null,
      most_dangerous_city: null,
      most_dangerous_city_accidents: null,
    }
  );
}

export function fetchCityDangerRanking(): Promise<CityDangerRanking[]> {
  return selectRows('v_city_danger_ranking', cityDangerRankingSchema, {
    order: { column: 'severity_score', ascending: false },
  });
}

export function fetchStatisticalHotspots(): Promise<StatisticalHotspot[]> {
  return selectRows('v_statistical_hotspots', statisticalHotspotSchema, {
    order: { column: 'z_score', ascending: false },
    limit: 100,
  });
}

export function fetchDemographics(): Promise<DemographicsByCity[]> {
  return selectRows('v_accidents_demographics_by_city', demographicsByCitySchema, {
    order: { column: 'city', ascending: true },
  });
}

export function fetchLandUse(): Promise<LandUseStat[]> {
  return selectRows('v_accidents_land_use', landUseSchema, {
    order: { column: 'intensity_per_sqkm', ascending: false },
  });
}

export function fetchInsights(): Promise<AccidentInsight[]> {
  return selectRows('v_accidents_insights', insightSchema);
}

export async function fetchAccidentClusters(minAccidents = 1): Promise<AccidentCluster[]> {
  const { data, error } = await supabase.rpc('get_accident_clusters', {
    min_accidents: minAccidents,
  });

  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((row) => accidentClusterSchema.parse(row));
}

export function useAccidentsKpi() {
  return useQuery({
    queryKey: ['statistics', 'kpi'],
    queryFn: fetchAccidentsKpi,
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useCityDangerRanking() {
  return useQuery({
    queryKey: ['statistics', 'city-danger-ranking'],
    queryFn: fetchCityDangerRanking,
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useStatisticalHotspots() {
  return useQuery({
    queryKey: ['statistics', 'statistical-hotspots'],
    queryFn: fetchStatisticalHotspots,
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useDemographics() {
  return useQuery({
    queryKey: ['statistics', 'demographics'],
    queryFn: fetchDemographics,
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useLandUse() {
  return useQuery({
    queryKey: ['statistics', 'land-use'],
    queryFn: fetchLandUse,
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useInsights() {
  return useQuery({
    queryKey: ['statistics', 'insights'],
    queryFn: fetchInsights,
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useAccidentClusters(enabled: boolean, minAccidents = 1) {
  return useQuery({
    queryKey: ['statistics', 'clusters', minAccidents],
    queryFn: () => fetchAccidentClusters(minAccidents),
    enabled: enabled && isSupabaseConfigured,
    staleTime: 10 * 60_000,
    retry: false,
  });
}
