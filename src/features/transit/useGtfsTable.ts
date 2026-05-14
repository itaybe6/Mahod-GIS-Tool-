import { useQueries, useQuery } from '@tanstack/react-query';

import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

import type { ColumnDef, SortSpec, TableConfig, TableQueryParams } from './types';

export interface GtfsTablePage {
  rows: Record<string, unknown>[];
  totalCount: number;
  /** When set, the HTTP request failed — shown in the table instead of throwing (quieter console). */
  fetchError?: string | undefined;
}

/**
 * Builds the comma-separated `select=` projection for a config.
 * Excludes any geometry columns to avoid pulling huge EWKB blobs over the wire.
 */
function buildSelect(config: TableConfig): string {
  return config.columns
    .map((c) => c.key)
    .filter((key) => key !== 'geom')
    .join(',');
}

const SAFE_INPUT_RE = /[(),%*"\\]/g;

function buildSearchOrFilter(query: string, columns: ColumnDef[]): string | null {
  const safe = query.replace(SAFE_INPUT_RE, ' ').trim();
  if (!safe) return null;

  const parts: string[] = [];
  const numericValue = Number(safe);
  const isNumeric = Number.isFinite(numericValue);
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(safe);

  for (const col of columns) {
    const searchable = col.searchable ?? col.type === 'text';
    if (!searchable) continue;

    if (col.type === 'text') {
      parts.push(`${col.key}.ilike.*${safe}*`);
    } else if (col.type === 'number' && isNumeric) {
      parts.push(`${col.key}.eq.${numericValue}`);
    } else if (col.type === 'date' && isIsoDate) {
      parts.push(`${col.key}.eq.${safe}`);
    } else if (col.type === 'enum' && isNumeric) {
      parts.push(`${col.key}.eq.${numericValue}`);
    }
  }

  return parts.length ? parts.join(',') : null;
}

function postgrestErrorMessage(err: { message?: string; details?: string; hint?: string }): string {
  const bits = [err.message, err.details, err.hint].filter(Boolean);
  return bits.join(' — ') || 'שגיאת PostgREST';
}

async function fetchGtfsTablePage(
  config: TableConfig,
  params: TableQueryParams
): Promise<GtfsTablePage> {
  const { search, sorts, page, pageSize } = params;

  const start = page * pageSize;
  const end = start + pageSize - 1;

  let query = supabase
    .from(config.name as never)
    .select(buildSelect(config), { count: 'estimated' });

  const orFilter = buildSearchOrFilter(search, config.columns);
  if (orFilter) {
    query = query.or(orFilter);
  }

  const effectiveSorts: SortSpec[] = sorts.length ? sorts : config.defaultSort;
  for (const sort of effectiveSorts) {
    query = query.order(sort.key, { ascending: sort.dir === 'asc' });
  }

  const { data, error, count } = await query.range(start, end);

  if (error) {
    return {
      rows: [],
      totalCount: 0,
      fetchError: postgrestErrorMessage(error),
    };
  }

  return {
    rows: data ?? [],
    totalCount: count ?? 0,
  };
}

/**
 * Server-paginated GTFS table query. Re-fetches whenever
 * search / sorts / page / pageSize change.
 *
 * `placeholderData` is scoped to the **same table** so switching tabs does not
 * render foreign rows (e.g. agency rows under route columns), which produces
 * all-em-dash cells and duplicate React keys.
 */
export function useGtfsTable(config: TableConfig, params: TableQueryParams) {
  return useQuery({
    queryKey: ['gtfs-table', config.name, config.columns.map((c) => c.key).join('|'), params],
    queryFn: () => fetchGtfsTablePage(config, params),
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
    retry: false,
    placeholderData: (prev, prevQuery) => {
      const prevTable = (prevQuery?.queryKey as readonly unknown[] | undefined)?.[1];
      return prevTable === config.name ? prev : undefined;
    },
  });
}

async function fetchTableCount(tableName: string): Promise<number | null> {
  const { count, error } = await supabase
    .from(tableName as never)
    .select('*', { count: 'estimated', head: true });

  if (error) return null;
  return count ?? null;
}

/**
 * Per-table total row counts (picker badges). Uses **estimated** counts so
 * huge tables (`gtfs_trips`, point-level `gtfs_shapes`) do not run heavy
 * `COUNT(*)` or spam the console on failure.
 */
export function useGtfsTableCounts(tables: TableConfig[]) {
  return useQueries({
    queries: tables.map((config) => ({
      queryKey: ['gtfs-table-count', config.name, config.columns.map((c) => c.key).join('|')],
      queryFn: () => fetchTableCount(config.name),
      enabled: isSupabaseConfigured,
      staleTime: 10 * 60_000,
      retry: false,
    })),
    combine: (results) => {
      const counts = new Map<string, number>();
      let isLoading = false;
      results.forEach((result, i) => {
        if (result.isLoading) isLoading = true;
        const cfg = tables[i];
        if (cfg && typeof result.data === 'number') {
          counts.set(cfg.name, result.data);
        }
      });
      return { counts, isLoading };
    },
  });
}
