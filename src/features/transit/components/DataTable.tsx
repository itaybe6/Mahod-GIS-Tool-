import { cn } from '@/lib/utils';

import { renderCell } from '../formatters';
import type { ColumnDef, SortSpec, TableConfig } from '../types';

export interface DataTableProps {
  config: TableConfig;
  rows: Record<string, unknown>[];
  sorts: SortSpec[];
  /**
   * Toggle sort for a column.
   *  - plain click: replace the current sort with [{key, asc/desc/none}]
   *  - shift-click (multi=true): add/cycle this column at the end of the sort stack
   */
  onToggleSort: (key: string, multi: boolean) => void;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string | undefined;
}

export function DataTable({
  config,
  rows,
  sorts,
  onToggleSort,
  isLoading,
  isFetching,
  isError,
  errorMessage,
}: DataTableProps): JSX.Element {
  return (
    <div className="relative flex min-h-[360px] flex-none flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-surface to-bg-1 shadow-[0_18px_50px_rgba(0,0,0,0.24)] sm:min-h-[420px] lg:min-h-0 lg:flex-1">
      {isFetching && !isLoading && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden">
          <div className="top-loader" />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="min-w-full border-separate border-spacing-0 text-start">
          <thead className="sticky top-0 z-10 bg-gradient-to-l from-slate-900/95 via-surface-2/95 to-slate-900/95 backdrop-blur">
            <tr>
              {config.columns.map((col) => (
                <HeaderCell
                  key={col.key}
                  column={col}
                  sortIndex={sorts.findIndex((s) => s.key === col.key)}
                  sortDir={sorts.find((s) => s.key === col.key)?.dir}
                  onToggle={(multi) => onToggleSort(col.key, multi)}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading && <SkeletonRows columns={config.columns} />}

            {!isLoading && isError && (
              <tr>
                <td
                  colSpan={config.columns.length}
                  className="border-t border-border px-4 py-10 text-center text-sm text-danger"
                >
                  שגיאה בטעינת הנתונים{errorMessage ? ` — ${errorMessage}` : ''}
                </td>
              </tr>
            )}

            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td
                  colSpan={config.columns.length}
                  className="border-t border-border px-4 py-12 text-center text-sm text-text-faint"
                >
                  אין רשומות התואמות לחיפוש.
                </td>
              </tr>
            )}

            {!isLoading &&
              !isError &&
              rows.map((row, idx) => (
                <tr
                  key={config.rowKey ? config.rowKey(row) : idx}
                  className={cn(
                    'group transition-all duration-150 hover:bg-brand-teal/[0.055]',
                    idx % 2 === 1 && 'bg-white/[0.015]'
                  )}
                >
                  {config.columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'border-t border-white/[0.07] px-3 py-2.5 align-top text-[12.5px] text-text-dim transition-colors group-hover:text-text',
                        col.align === 'center' && 'text-center',
                        col.align === 'end' && 'text-end',
                        col.width
                      )}
                    >
                      {renderCell(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface HeaderCellProps {
  column: ColumnDef;
  sortIndex: number;
  sortDir: 'asc' | 'desc' | undefined;
  onToggle: (multi: boolean) => void;
}

function HeaderCell({ column, sortIndex, sortDir, onToggle }: HeaderCellProps): JSX.Element {
  const sortable = column.sortable ?? true;

  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 select-none border-b border-brand-teal/25 bg-transparent px-3 py-3 text-start text-[13.5px] font-bold uppercase tracking-[0.08em] text-white shadow-[inset_0_-1px_rgba(255,255,255,0.06)]',
        column.align === 'center' && 'text-center',
        column.align === 'end' && 'text-end',
        column.width
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={(e) => onToggle(e.shiftKey)}
          title={
            column.hint ??
            'לחץ למיון. החזק Shift+לחיצה כדי להוסיף לעמודות מיון נוספות (מיון מתקדם).'
          }
          className={cn(
            'group/h inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-all',
            'hover:bg-white/[0.08] hover:text-white',
            sortDir && 'bg-brand-teal/10 text-brand-teal'
          )}
        >
          <span className="drop-shadow-sm">{column.label}</span>
          {sortIndex >= 0 && (
            <span className="rounded-full border border-brand-teal/30 bg-brand-teal/20 px-1.5 font-mono text-[10px] text-brand-teal">
              {sortIndex + 1}
            </span>
          )}
        </button>
      ) : (
        <span className="px-1 drop-shadow-sm">{column.label}</span>
      )}
    </th>
  );
}

function SkeletonRows({ columns }: { columns: ColumnDef[] }): JSX.Element {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIdx) => (
        <tr key={rowIdx}>
          {columns.map((col) => (
            <td key={col.key} className="border-t border-white/[0.07] px-3 py-3">
              <span className="block h-3 w-full animate-pulse rounded-full bg-white/[0.06]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
