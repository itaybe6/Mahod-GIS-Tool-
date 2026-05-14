import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type ColumnType = 'number' | 'text' | 'date' | 'boolean' | 'enum';

export interface ColumnDef {
  /** Column name in the Supabase table (used for select / order / filter). */
  key: string;
  /** Hebrew display label for the column header. */
  label: string;
  type: ColumnType;
  /** Defaults to true. Set false to hide a column from the sort UI. */
  sortable?: boolean;
  /** Defaults to true for `text` columns. Determines if the search bar can target this column. */
  searchable?: boolean;
  /** Tailwind width class (e.g. 'w-32'). Optional — table is horizontally scrollable. */
  width?: string;
  /** Cell text alignment inside the column. */
  align?: 'start' | 'center' | 'end';
  /** Optional value formatter — receives the raw value and the full row. */
  formatter?: (value: unknown, row: Record<string, unknown>) => ReactNode;
  /** For `enum` columns: numeric/string code → human-readable Hebrew label. */
  enumLabels?: Record<string | number, string>;
  /** Tooltip / sub-text shown under the label. */
  hint?: string;
}

export interface TableConfig {
  /** Postgres table name (e.g. `gtfs_agency`). */
  name: string;
  /** Hebrew display label. */
  label: string;
  /** Optional short Hebrew description (shown in the picker). */
  description?: string;
  /** Sidebar / tab icon. */
  icon: LucideIcon;
  /** Default sort applied when the page is first opened. */
  defaultSort: SortSpec[];
  /** Ordered list of columns. The first column also acts as the row identifier. */
  columns: ColumnDef[];
  /**
   * Optional unique-key builder for React rendering. Defaults to a JSON
   * serialization of the first non-null primary-key-like column.
   */
  rowKey?: (row: Record<string, unknown>) => string;
}

export interface SortSpec {
  key: string;
  dir: 'asc' | 'desc';
}

export interface TableQueryParams {
  search: string;
  sorts: SortSpec[];
  page: number;
  pageSize: number;
}
