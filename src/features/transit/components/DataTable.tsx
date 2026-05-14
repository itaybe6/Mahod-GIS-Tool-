import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-surface shadow-card">
      {isFetching && !isLoading && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden">
          <div className="top-loader" />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-start">
          <thead className="sticky top-0 z-10 bg-surface-2/95 backdrop-blur">
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
                  className="group transition-colors hover:bg-white/[0.025]"
                >
                  {config.columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'border-t border-border px-3 py-2.5 align-top',
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
        'sticky top-0 select-none border-b border-border bg-surface-2/95 px-3 py-2 text-start text-[11.5px] font-semibold uppercase tracking-wider text-text-dim backdrop-blur',
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
            'group/h inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors',
            'hover:bg-white/[0.06] hover:text-text',
            sortDir && 'text-brand-teal'
          )}
        >
          <span>{column.label}</span>
          <SortIndicator dir={sortDir} index={sortIndex} />
        </button>
      ) : (
        <span className="px-1">{column.label}</span>
      )}
    </th>
  );
}

function SortIndicator({
  dir,
  index,
}: {
  dir: 'asc' | 'desc' | undefined;
  index: number;
}): JSX.Element {
  if (!dir) {
    return (
      <ArrowUpDown
        size={12}
        className="opacity-40 transition-opacity group-hover/h:opacity-80"
        aria-hidden
      />
    );
  }
  const Icon = dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-1 text-brand-teal">
      <Icon size={12} aria-hidden />
      {index >= 0 && (
        <span className="rounded bg-brand-teal/15 px-1 font-mono text-[9.5px]">{index + 1}</span>
      )}
    </span>
  );
}

function SkeletonRows({ columns }: { columns: ColumnDef[] }): JSX.Element {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIdx) => (
        <tr key={rowIdx}>
          {columns.map((col) => (
            <td key={col.key} className="border-t border-border px-3 py-3">
              <span className="block h-3 w-full animate-pulse rounded bg-white/[0.04]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
