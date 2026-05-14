import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Radar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDecimal, formatNumber, formatPercent } from '@/statistics/calculations';
import { useCityDangerRanking } from '@/statistics/queries';
import type { CityDangerRanking, SeverityTone } from '@/statistics/types';
import { cn } from '@/lib/utils';
import { EmptyState, SectionShell } from './section-shell';

const INITIAL_ROWS = 10;
const LOAD_STEP = 10;

const toneClasses: Record<SeverityTone, string> = {
  red: 'border-danger/30 bg-danger/10 text-danger',
  orange: 'border-warning/30 bg-warning/10 text-warning',
  yellow: 'border-yellow-300/30 bg-yellow-300/10 text-yellow-300',
  green: 'border-success/30 bg-success/10 text-success',
  blue: 'border-sky-300/30 bg-sky-300/10 text-sky-300',
  purple: 'border-purple/30 bg-purple/10 text-purple',
};

function metricCell(value: number | null): JSX.Element {
  return <span className="font-mono text-text">{formatDecimal(value)}</span>;
}

export function DangerRankingTable(): JSX.Element {
  const { data = [], isLoading, error } = useCityDangerRanking();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'severity_score', desc: true }]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);

  const columns = useMemo<ColumnDef<CityDangerRanking>[]>(
    () => [
      {
        accessorKey: 'rank',
        header: '#',
        enableSorting: false,
        cell: ({ row }) => <span className="font-mono text-text-faint">{row.index + 1}</span>,
      },
      {
        accessorKey: 'city',
        header: 'עיר',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-text">{row.original.city}</div>
            <div className="text-[11px] text-text-faint">
              אוכלוסייה: {formatNumber(row.original.population)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'total_accidents',
        header: 'תאונות',
        cell: ({ getValue }) => <span className="font-mono">{formatNumber(getValue<number>())}</span>,
      },
      {
        accessorKey: 'severity_score',
        header: 'ציון חומרה',
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-flex min-w-[64px] justify-center rounded-full border px-2 py-1 font-mono text-[11px] font-bold',
              toneClasses[row.original.severity_tone]
            )}
          >
            {formatNumber(row.original.severity_score)}
          </span>
        ),
      },
      {
        accessorKey: 'rate_per_1000_residents',
        header: 'ל־1,000 תושבים',
        cell: ({ getValue }) => metricCell(getValue<number | null>()),
      },
      {
        accessorKey: 'density_per_sqkm',
        header: 'לקמ״ר',
        cell: ({ getValue }) => metricCell(getValue<number | null>()),
      },
      {
        accessorKey: 'fatality_rate',
        header: 'קטלניות',
        cell: ({ getValue }) => (
          <span className="font-mono text-warning">{formatPercent(getValue<number | null>())}</span>
        ),
      },
      {
        accessorKey: 'pedestrian_share',
        header: 'הולכי רגל',
        cell: ({ getValue }) => (
          <span className="font-mono text-danger">{formatPercent(getValue<number | null>())}</span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows.slice(0, visibleCount);
  const canLoadMore = visibleCount < table.getRowModel().rows.length;

  return (
    <SectionShell
      icon={Radar}
      title="דירוג מסוכנים לפי עיר"
      eyebrow="Danger Ranking"
      isLoading={isLoading}
      error={error}
    >
      {data.length === 0 && !isLoading ? (
        <EmptyState>אין נתונים להצגה. ודאו שה־view `v_city_danger_ranking` הוחל על Supabase.</EmptyState>
      ) : (
        <>
          <div className="max-h-[360px] overflow-auto rounded-md border border-border">
            <table className="w-full min-w-[980px] border-collapse text-right text-[12px]">
              <thead className="sticky top-0 z-10 bg-bg-2 text-[10.5px] uppercase tracking-[1px] text-text-faint">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sortState = header.column.getIsSorted();
                      return (
                        <th key={header.id} className="px-3 py-2 font-semibold">
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 transition-colors hover:text-text"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sortState === 'asc' && <ArrowUp size={11} />}
                              {sortState === 'desc' && <ArrowDown size={11} />}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-white/[0.03]">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 text-text-dim">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-[11.5px] text-text-faint">
            <span>
              מוצגות {formatNumber(rows.length)} מתוך {formatNumber(table.getRowModel().rows.length)} ערים
            </span>
            {canLoadMore && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((count) => count + LOAD_STEP)}
              >
                טען עוד
              </Button>
            )}
          </div>
        </>
      )}
    </SectionShell>
  );
}
