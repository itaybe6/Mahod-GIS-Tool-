import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bus, Filter, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { DataTable } from './components/DataTable';
import { Pagination } from './components/Pagination';
import { SearchBar } from './components/SearchBar';
import { SortControls } from './components/SortControls';
import { TablePicker } from './components/TablePicker';
import { formatCount } from './formatters';
import { probeGtfsShapesSchema } from './shapesProbe';
import {
  SHOW_GTFS_SHAPES_TAB,
  buildGtfsTableList,
  findTableConfig,
  type GtfsShapesSchemaMode,
} from './tables';
import type { SortSpec, TableConfig } from './types';
import { useGtfsTable, useGtfsTableCounts } from './useGtfsTable';

const DEFAULT_PAGE_SIZE = 50;

interface TableUiState {
  search: string;
  sorts: SortSpec[];
  page: number;
  pageSize: number;
}

const FALLBACK_STATE: TableUiState = {
  search: '',
  sorts: [],
  page: 0,
  pageSize: DEFAULT_PAGE_SIZE,
};

function makeInitialTableUiState(tables: TableConfig[]): Record<string, TableUiState> {
  return Object.fromEntries(tables.map((cfg) => [cfg.name, { ...FALLBACK_STATE }]));
}

export function TransitPage(): JSX.Element {
  const [shapesMode, setShapesMode] = useState<GtfsShapesSchemaMode>('line');
  const tablesList = useMemo(() => buildGtfsTableList(shapesMode), [shapesMode]);

  const [activeName, setActiveName] = useState<string>(() => tablesList[0]!.name);
  const [tableStates, setTableStates] = useState<Record<string, TableUiState>>(() =>
    makeInitialTableUiState(buildGtfsTableList('line'))
  );

  useEffect(() => {
    if (!SHOW_GTFS_SHAPES_TAB) return;
    let cancelled = false;
    void probeGtfsShapesSchema().then((mode) => {
      if (!cancelled) setShapesMode(mode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tablesList.some((t) => t.name === activeName)) return;
    setActiveName(tablesList[0]!.name);
  }, [tablesList, activeName]);

  const config = findTableConfig(activeName, tablesList) ?? tablesList[0]!;
  const state = tableStates[activeName] ?? FALLBACK_STATE;
  const debouncedSearch = useDebounce(state.search, 300);
  const sortableKeys = useMemo(
    () => new Set(config.columns.filter((column) => column.sortable ?? true).map((column) => column.key)),
    [config]
  );
  const activeSorts = useMemo(
    () => state.sorts.filter((sort) => sortableKeys.has(sort.key)),
    [state.sorts, sortableKeys]
  );

  useEffect(() => {
    setTableStates((prev) => {
      const current = prev[activeName] ?? FALLBACK_STATE;
      if (current.page === 0) return prev;
      return { ...prev, [activeName]: { ...current, page: 0 } };
    });
  }, [debouncedSearch, activeName]);

  useEffect(() => {
    setTableStates((prev) => {
      const current = prev[activeName] ?? FALLBACK_STATE;
      if (current.sorts.length === 0) return prev;

      const nextSorts = current.sorts.filter((sort) => sortableKeys.has(sort.key));
      if (nextSorts.length === current.sorts.length) return prev;

      return { ...prev, [activeName]: { ...current, sorts: nextSorts, page: 0 } };
    });
  }, [activeName, sortableKeys]);

  const queryParams = useMemo(
    () => ({
      search: debouncedSearch,
      sorts: activeSorts,
      page: state.page,
      pageSize: state.pageSize,
    }),
    [debouncedSearch, activeSorts, state.page, state.pageSize]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useGtfsTable(
    config,
    queryParams
  );
  const { counts, isLoading: isLoadingCounts } = useGtfsTableCounts(tablesList);

  function patchState(patch: Partial<TableUiState>) {
    setTableStates((prev) => {
      const current = prev[activeName] ?? FALLBACK_STATE;
      return { ...prev, [activeName]: { ...current, ...patch } };
    });
  }

  function handleToggleSort(key: string, multi: boolean) {
    const current = state.sorts;
    const existing = current.find((s) => s.key === key);
    if (multi) {
      if (!existing) {
        patchState({ sorts: [...current, { key, dir: 'asc' }], page: 0 });
        return;
      }
      if (existing.dir === 'asc') {
        patchState({
          sorts: current.map((s) => (s.key === key ? { ...s, dir: 'desc' as const } : s)),
          page: 0,
        });
        return;
      }
      patchState({ sorts: current.filter((s) => s.key !== key), page: 0 });
      return;
    }

    if (!existing) {
      patchState({ sorts: [{ key, dir: 'asc' }], page: 0 });
      return;
    }
    if (existing.dir === 'asc') {
      patchState({ sorts: [{ key, dir: 'desc' }], page: 0 });
      return;
    }
    patchState({ sorts: [], page: 0 });
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center p-6">
        <div className="max-w-md rounded-md border border-warning/30 bg-warning/5 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 text-warning" size={26} />
          <h2 className="mb-1 text-base font-semibold text-text">Supabase לא מוגדר</h2>
          <p className="text-sm leading-relaxed text-text-dim">
            ודאו ש-<code className="font-mono text-brand-teal">VITE_SUPABASE_URL</code> ו-
            <code className="font-mono text-brand-teal">VITE_SUPABASE_ANON_KEY</code> מוגדרים בקובץ{' '}
            <code>.env</code>.
          </p>
        </div>
      </div>
    );
  }

  const fetchErr = data?.fetchError;
  const totalCount = data?.totalCount ?? 0;
  const isFiltered = debouncedSearch.trim().length > 0;
  const tableTotal = counts.get(activeName);
  const isSearchPending = isFetching && state.search !== debouncedSearch;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-3.5 lg:overflow-hidden lg:pb-3.5">
      <header className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-brand-teal/10 text-brand-teal">
            <Bus size={18} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-text">
              תחבורה ציבורית
            </h1>
            <p className="line-clamp-2 text-[11.5px] text-text-faint sm:line-clamp-1">
              נתוני GTFS — חברות, קווים, תחנות, נסיעות ותוואים. מקור: Supabase.
            </p>
          </div>
        </div>

        <div className="ms-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="רענן נתונים"
            className="gap-1.5"
          >
            <RefreshCcw size={13} className={cn(isFetching && 'animate-spin')} />
            רענן
          </Button>
        </div>
      </header>

      <TablePicker
        tables={tablesList}
        active={activeName}
        onSelect={(name) => setActiveName(name)}
        counts={counts}
        isLoadingCounts={isLoadingCounts}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <SearchBar
            value={state.search}
            onChange={(v) => patchState({ search: v })}
            placeholder={config.searchPlaceholder ?? `חיפוש בטבלת "${config.label}"`}
            isFetching={isSearchPending}
          />
          {!config.disableAdvancedSort && (
            <SortControls
              config={config}
              sorts={activeSorts}
              onChange={(next) => patchState({ sorts: next, page: 0 })}
            />
          )}

          {(isFiltered || activeSorts.length > 0) && (
            <button
              type="button"
              onClick={() => patchState({ search: '', sorts: [], page: 0 })}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-1 px-2.5 py-1 text-[11.5px] text-text-faint transition-colors hover:border-danger/40 hover:text-danger"
            >
              <Filter size={11} />
              נקה חיפוש ומיון
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11.5px] text-text-faint">
          <span>
            <span className="font-mono text-text">{formatCount(totalCount)}</span>
            {isFiltered && tableTotal != null && (
              <span className="text-text-faint"> / {formatCount(tableTotal)}</span>
            )}{' '}
            רשומות
          </span>
        </div>
      </div>

      <DataTable
        config={config}
        rows={data?.rows ?? []}
        sorts={activeSorts.length ? activeSorts : config.defaultSort}
        onToggleSort={handleToggleSort}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError || Boolean(fetchErr)}
        errorMessage={fetchErr ?? (error instanceof Error ? error.message : undefined)}
      />

      <Pagination
        page={state.page}
        pageSize={state.pageSize}
        totalCount={totalCount}
        onPageChange={(p) => patchState({ page: p })}
        onPageSizeChange={(sz) => patchState({ pageSize: sz, page: 0 })}
        isFetching={isFetching}
      />
    </div>
  );
}
