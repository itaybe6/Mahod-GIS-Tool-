import { useQuery } from '@tanstack/react-query';

import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import type { DataSourcesRow } from '@/types/schema-from-migration';

const QUERY_KEY = ['data-sources'] as const;

async function fetchDataSources(): Promise<DataSourcesRow[]> {
  const { data, error } = await supabase
    .from('data_sources')
    .select(
      'id, name, display_name, source_url, last_checked_at, last_updated_at, file_hash, file_size_bytes, last_modified, record_count, status, metadata, created_at, updated_at'
    )
    .order('display_name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DataSourcesRow[];
}

export function useDataSources() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchDataSources,
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
    retry: false,
  });
}
