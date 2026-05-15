import { useMemo, useState } from 'react';
import { AlertTriangle, Building2, Filter, RefreshCcw, Train, TramFront } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

import { DataTable } from '../transit/components/DataTable';
import { Pagination } from '../transit/components/Pagination';
import { SearchBar } from '../transit/components/SearchBar';
import { TablePicker } from '../transit/components/TablePicker';
import { formatCount, valueAsString } from '../transit/formatters';
import type { ColumnDef, SortSpec, TableConfig } from '../transit/types';
import {
  useMetroStations,
  useRailwayStations,
  type MetroStation,
  type RailwayStation,
  type RailwayStationStatus,
} from './useRailwayStations';

const DEFAULT_PAGE_SIZE = 50;

type InfraTableName = 'metro' | 'railway';
type StatusFilter = 'all' | RailwayStationStatus;
type ActivityFilter = 'all' | 'active' | 'inactive';

interface InfraUiState {
  search: string;
  status: StatusFilter;
  activity: ActivityFilter;
  lineId: string;
  sorts: SortSpec[];
  page: number;
  pageSize: number;
}

const FALLBACK_STATE: InfraUiState = {
  search: '',
  status: 'all',
  activity: 'all',
  lineId: 'all',
  sorts: [],
  page: 0,
  pageSize: DEFAULT_PAGE_SIZE,
};

const STATUS_LABELS: Record<RailwayStationStatus, string> = {
  operational: 'פעילה',
  under_construction: 'בבנייה',
  planned: 'מתוכננת',
};

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'כל הסטטוסים' },
  { value: 'operational', label: STATUS_LABELS.operational },
  { value: 'under_construction', label: STATUS_LABELS.under_construction },
  { value: 'planned', label: STATUS_LABELS.planned },
];

const ACTIVITY_OPTIONS: Array<{ value: ActivityFilter; label: string }> = [
  { value: 'all', label: 'כל התחנות' },
  { value: 'active', label: 'פעילות בלבד' },
  { value: 'inactive', label: 'לא פעילות בלבד' },
];

const SELECT_CLASS =
  'h-9 min-w-[150px] cursor-pointer rounded-md border border-border bg-bg-1 px-3 text-[12.5px] text-text outline-none transition-colors hover:border-brand-teal/50 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20';

function renderStatus(value: unknown): JSX.Element {
  const status = value as RailwayStationStatus;
  const tone =
    status === 'operational'
      ? 'bg-success/15 text-success'
      : status === 'under_construction'
        ? 'bg-warning/15 text-warning'
        : 'bg-brand-blue/15 text-brand-blue';

  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>
      {STATUS_LABELS[status] ?? valueAsString(value)}
    </span>
  );
}

function renderCoordinate(value: unknown): JSX.Element {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return <span className="text-text-faint">—</span>;
  return <span className="font-mono text-[12px] text-text-dim">{numberValue.toFixed(6)}</span>;
}

const INFRA_TABLES: TableConfig[] = [
  {
    name: 'metro',
    label: 'רכבת קלה',
    description: 'תחנות רק"ל/נת"ע עם סטטוס ומיקום גיאוגרפי, כולל סינון לפי קו.',
    searchPlaceholder: 'חיפוש לפי שם תחנה',
    icon: TramFront,
    defaultSort: [{ key: 'name', dir: 'asc' }],
    rowKey: (row) => `metro-${valueAsString(row.stationId)}`,
    columns: [
      { key: 'name', label: 'שם תחנה', type: 'text', searchable: true, width: 'min-w-[220px]' },
      {
        key: 'status',
        label: 'סטטוס',
        type: 'enum',
        searchable: false,
        formatter: renderStatus,
        width: 'w-36',
      },
      {
        key: 'lat',
        label: 'קו רוחב',
        type: 'number',
        searchable: false,
        formatter: renderCoordinate,
        align: 'end',
      },
      {
        key: 'lon',
        label: 'קו אורך',
        type: 'number',
        searchable: false,
        formatter: renderCoordinate,
        align: 'end',
      },
    ],
    sortPresets: [
      { label: 'שם תחנה א-ת', key: 'name', dir: 'asc' },
    ],
  },
  {
    name: 'railway',
    label: 'רכבת',
    description: 'תחנות רכבת ישראל, מצב פעילות ומיקום גיאוגרפי.',
    searchPlaceholder: 'חיפוש לפי שם תחנת רכבת',
    icon: Train,
    defaultSort: [{ key: 'name', dir: 'asc' }],
    rowKey: (row) => `railway-${valueAsString(row.stationId)}`,
    columns: [
      { key: 'name', label: 'שם תחנה', type: 'text', searchable: true, width: 'min-w-[240px]' },
      {
        key: 'status',
        label: 'סטטוס',
        type: 'enum',
        searchable: false,
        formatter: renderStatus,
        width: 'w-36',
      },
      {
        key: 'isActive',
        label: 'פעילה',
        type: 'boolean',
        searchable: false,
        enumLabels: { true: 'כן', false: 'לא' },
        align: 'center',
        width: 'w-24',
      },
      {
        key: 'lat',
        label: 'קו רוחב',
        type: 'number',
        searchable: false,
        formatter: renderCoordinate,
        align: 'end',
      },
      {
        key: 'lon',
        label: 'קו אורך',
        type: 'number',
        searchable: false,
        formatter: renderCoordinate,
        align: 'end',
      },
    ],
    sortPresets: [
      { label: 'שם תחנה א-ת', key: 'name', dir: 'asc' },
    ],
  },
];

function findConfig(name: InfraTableName): TableConfig {
  return INFRA_TABLES.find((table) => table.name === name) ?? INFRA_TABLES[0]!;
}

function makeMetroRows(stations: MetroStation[]): Record<string, unknown>[] {
  return stations.map((station) => ({
    stationId: station.stationId,
    name: station.name,
    lineId: station.lineId ?? '—',
    status: station.status,
    lat: station.position[0],
    lon: station.position[1],
  }));
}

function makeRailwayRows(stations: RailwayStation[]): Record<string, unknown>[] {
  return stations.map((station) => ({
    stationId: station.stationId,
    name: station.name,
    status: station.status,
    isActive: station.isActive,
    lat: station.position[0],
    lon: station.position[1],
  }));
}

function matchesSearch(row: Record<string, unknown>, columns: ColumnDef[], search: string): boolean {
  const term = search.trim().toLocaleLowerCase('he-IL');
  if (!term) return true;

  return columns
    .filter((column) => column.searchable ?? column.type === 'text')
    .some((column) => valueAsString(row[column.key]).toLocaleLowerCase('he-IL').includes(term));
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return valueAsString(a).localeCompare(valueAsString(b), 'he-IL', { numeric: true });
}

function sortRows(rows: Record<string, unknown>[], sorts: SortSpec[]): Record<string, unknown>[] {
  if (sorts.length === 0) return rows;

  return [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const result = compareValues(a[sort.key], b[sort.key]);
      if (result !== 0) return sort.dir === 'asc' ? result : -result;
    }
    return 0;
  });
}

export function InfrastructurePage(): JSX.Element {
  const [activeName, setActiveName] = useState<InfraTableName>('metro');
  const [tableStates, setTableStates] = useState<Record<InfraTableName, InfraUiState>>({
    metro: { ...FALLBACK_STATE },
    railway: { ...FALLBACK_STATE },
  });

  const metroQuery = useMetroStations();
  const railwayQuery = useRailwayStations();
  const config = findConfig(activeName);
  const state = tableStates[activeName];
  const debouncedSearch = useDebounce(state.search, 300);
  const activeSorts = state.sorts.length > 0 ? state.sorts : config.defaultSort;

  const lineOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (metroQuery.data ?? [])
            .map((station) => station.lineId)
            .filter((lineId): lineId is string => Boolean(lineId))
        )
      ).sort((a, b) => a.localeCompare(b, 'he-IL', { numeric: true })),
    [metroQuery.data]
  );

  const allRows = useMemo(() => {
    return activeName === 'metro'
      ? makeMetroRows(metroQuery.data ?? [])
      : makeRailwayRows(railwayQuery.data ?? []);
  }, [activeName, metroQuery.data, railwayQuery.data]);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (!matchesSearch(row, config.columns, debouncedSearch)) return false;
      if (state.status !== 'all' && row.status !== state.status) return false;
      if (activeName === 'metro' && state.lineId !== 'all' && row.lineId !== state.lineId) return false;
      if (activeName === 'railway' && state.activity !== 'all') {
        const shouldBeActive = state.activity === 'active';
        if (row.isActive !== shouldBeActive) return false;
      }
      return true;
    });
  }, [activeName, allRows, config.columns, debouncedSearch, state.activity, state.lineId, state.status]);

  const sortedRows = useMemo(() => sortRows(filteredRows, activeSorts), [activeSorts, filteredRows]);
  const totalCount = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / state.pageSize));
  const safePage = Math.min(state.page, totalPages - 1);
  const pageRows = sortedRows.slice(safePage * state.pageSize, safePage * state.pageSize + state.pageSize);

  const activeQuery = activeName === 'metro' ? metroQuery : railwayQuery;
  const isSearchPending = activeQuery.isFetching && state.search !== debouncedSearch;
  const isFiltered =
    debouncedSearch.trim().length > 0 ||
    state.status !== 'all' ||
    state.lineId !== 'all' ||
    state.activity !== 'all' ||
    state.sorts.length > 0;

  const counts = useMemo(
    () =>
      new Map<string, number>([
        ['metro', metroQuery.data?.length ?? 0],
        ['railway', railwayQuery.data?.length ?? 0],
      ]),
    [metroQuery.data?.length, railwayQuery.data?.length]
  );

  function patchState(patch: Partial<InfraUiState>) {
    setTableStates((prev) => ({
      ...prev,
      [activeName]: { ...prev[activeName], ...patch },
    }));
  }

  function handleToggleSort(key: string, multi: boolean) {
    const current = state.sorts;
    const existing = current.find((sort) => sort.key === key);

    if (multi) {
      if (!existing) {
        patchState({ sorts: [...current, { key, dir: 'asc' }], page: 0 });
        return;
      }
      if (existing.dir === 'asc') {
        patchState({
          sorts: current.map((sort) => (sort.key === key ? { ...sort, dir: 'desc' as const } : sort)),
          page: 0,
        });
        return;
      }
      patchState({ sorts: current.filter((sort) => sort.key !== key), page: 0 });
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

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-3.5">
      <header className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-teal/10 text-brand-teal">
            <Building2 size={18} />
          </span>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight text-text">תשתיות</h1>
            <p className="text-[11.5px] text-text-faint">
              תחנות רכבת קלה ורכבת כבדה מתוך שכבות התשתית ב-Supabase.
            </p>
          </div>
        </div>

        <div className="ms-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => activeQuery.refetch()}
            disabled={activeQuery.isFetching}
            title="רענן נתונים"
            className="gap-1.5"
          >
            <RefreshCcw size={13} className={cn(activeQuery.isFetching && 'animate-spin')} />
            רענן
          </Button>
        </div>
      </header>

      <TablePicker
        tables={INFRA_TABLES}
        active={activeName}
        onSelect={(name) => setActiveName(name as InfraTableName)}
        counts={counts}
        isLoadingCounts={metroQuery.isLoading || railwayQuery.isLoading}
      />

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <SearchBar
            value={state.search}
            onChange={(value) => patchState({ search: value, page: 0 })}
            placeholder={config.searchPlaceholder ?? `חיפוש בטבלת "${config.label}"`}
            isFetching={isSearchPending}
          />

          <select
            value={state.status}
            onChange={(event) => patchState({ status: event.target.value as StatusFilter, page: 0 })}
            className={SELECT_CLASS}
            aria-label="סינון לפי סטטוס"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {activeName === 'metro' ? (
            <select
              value={state.lineId}
              onChange={(event) => patchState({ lineId: event.target.value, page: 0 })}
              className={SELECT_CLASS}
              aria-label="סינון לפי קו"
            >
              <option value="all">כל הקווים</option>
              {lineOptions.map((lineId) => (
                <option key={lineId} value={lineId}>
                  קו {lineId}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={state.activity}
              onChange={(event) =>
                patchState({ activity: event.target.value as ActivityFilter, page: 0 })
              }
              className={SELECT_CLASS}
              aria-label="סינון לפי פעילות"
            >
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          {isFiltered && (
            <button
              type="button"
              onClick={() => patchState({ ...FALLBACK_STATE })}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-1 px-2.5 py-1 text-[11.5px] text-text-faint transition-colors hover:border-danger/40 hover:text-danger"
            >
              <Filter size={11} />
              נקה סינון ומיון
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11.5px] text-text-faint">
          <span>
            <span className="font-mono text-text">{formatCount(totalCount)}</span>
            {totalCount !== allRows.length && (
              <span className="text-text-faint"> / {formatCount(allRows.length)}</span>
            )}{' '}
            רשומות
          </span>
        </div>
      </div>

      <DataTable
        config={config}
        rows={pageRows}
        sorts={activeSorts}
        onToggleSort={handleToggleSort}
        isLoading={activeQuery.isLoading}
        isFetching={activeQuery.isFetching}
        isError={activeQuery.isError}
        errorMessage={activeQuery.error instanceof Error ? activeQuery.error.message : undefined}
      />

      <Pagination
        page={safePage}
        pageSize={state.pageSize}
        totalCount={totalCount}
        onPageChange={(page) => patchState({ page })}
        onPageSizeChange={(pageSize) => patchState({ pageSize, page: 0 })}
        isFetching={activeQuery.isFetching}
      />
    </div>
  );
}
