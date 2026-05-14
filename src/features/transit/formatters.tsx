import type { ReactNode } from 'react';

import type { ColumnDef } from './types';

const dateTimeFormatter = new Intl.DateTimeFormat('he-IL', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const numberFormatter = new Intl.NumberFormat('he-IL');

/**
 * Best-effort string coercion for an unknown DB value. Plain JS primitives
 * pass through; arrays / objects are JSON-encoded so we never display
 * `[object Object]` in a cell.
 */
export function valueAsString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/** Render a Boolean cell as a colored chip ("פעיל" / "—"). */
function renderBoolean(value: unknown, column: ColumnDef): ReactNode {
  const isTrue = value === true;
  const label = column.enumLabels?.[String(isTrue)] ?? (isTrue ? 'כן' : 'לא');
  return (
    <span
      className={
        isTrue
          ? 'inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success'
          : 'inline-flex items-center text-text-faint'
      }
    >
      {label}
    </span>
  );
}

function renderDate(value: unknown, withTime: boolean): ReactNode {
  if (value == null || value === '') return <span className="text-text-faint">—</span>;
  const str = valueAsString(value);
  if (!withTime && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return (
      <span className="font-mono text-[12px] text-text-dim">
        {d}/{m}/{y}
      </span>
    );
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    return <span className="font-mono text-[12px] text-text-dim">{str}</span>;
  }
  return (
    <span className="font-mono text-[12px] text-text-dim">
      {(withTime ? dateTimeFormatter : dateFormatter).format(parsed)}
    </span>
  );
}

function renderEnum(value: unknown, column: ColumnDef): ReactNode {
  if (value == null || value === '') return <span className="text-text-faint">—</span>;
  const key = typeof value === 'number' || typeof value === 'string' ? value : valueAsString(value);
  const label = column.enumLabels?.[key];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-teal/70" aria-hidden />
      {label ?? <span className="text-text-faint">קוד {valueAsString(value)}</span>}
    </span>
  );
}

function renderText(value: unknown): ReactNode {
  if (value == null || value === '') return <span className="text-text-faint">—</span>;
  return <span className="text-[13px] text-text">{valueAsString(value)}</span>;
}

function renderNumber(value: unknown): ReactNode {
  if (value == null || value === '') return <span className="text-text-faint">—</span>;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return <span className="font-mono text-[12.5px] text-text">{numberFormatter.format(value)}</span>;
  }
  return <span className="font-mono text-[12.5px] text-text">{valueAsString(value)}</span>;
}

/**
 * Render a single cell. Falls back to type-aware defaults if the column
 * doesn't define an explicit `formatter`.
 */
export function renderCell(column: ColumnDef, row: Record<string, unknown>): ReactNode {
  const value = row[column.key];
  if (column.formatter) return column.formatter(value, row);
  switch (column.type) {
    case 'boolean':
      return renderBoolean(value, column);
    case 'date':
      return renderDate(value, column.key === 'updated_at');
    case 'enum':
      return renderEnum(value, column);
    case 'number':
      return renderNumber(value);
    case 'text':
    default:
      return renderText(value);
  }
}

/** Hebrew thousands-grouped count (e.g. "34,972"). */
export function formatCount(n: number): string {
  return numberFormatter.format(n);
}
