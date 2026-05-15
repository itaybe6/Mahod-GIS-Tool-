import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

import { isSupabaseConfigured } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { DataSourcesRow } from '@/types/schema-from-migration';

import { useDataSources } from './useDataSources';

const STATUS_DOT: Record<DataSourcesRow['status'], string> = {
  active: 'bg-brand-teal',
  error: 'bg-danger',
  disabled: 'bg-text-faint',
};

const sourceUpdatedFormatter = new Intl.DateTimeFormat('he-IL', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function effectiveSourceTimestamp(row: DataSourcesRow): string | null {
  return row.last_updated_at ?? row.last_checked_at ?? row.updated_at ?? null;
}

function formatSourceUpdatedAt(row: DataSourcesRow): string {
  const iso = effectiveSourceTimestamp(row);
  if (!iso) return '—';
  return sourceUpdatedFormatter.format(new Date(iso));
}

export function SourcesPage(): JSX.Element {
  const { data: rows, isPending, isError, error, refetch, isFetching } = useDataSources();

  if (!isSupabaseConfigured) {
    return (
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain p-3.5 pb-[calc(env(safe-area-inset-bottom)+0.875rem)]"
        dir="rtl"
      >
        <h1 className="text-lg font-semibold text-text">מקורות מידע</h1>
        <div className="max-w-lg rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 shrink-0 text-warning" size={22} />
            <div>
              <p className="text-sm font-medium text-text">Supabase לא מוגדר</p>
              <p className="mt-1 text-sm leading-relaxed text-text-dim">
                כדי לטעון את רשימת המקורות מהמסד, הגדר את משתני הסביבה VITE_SUPABASE_URL ו־VITE_SUPABASE_ANON_KEY.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-3.5 lg:pb-3.5"
      dir="rtl"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-text sm:text-lg">מקורות מידע</h1>
          <p className="mt-0.5 max-w-3xl text-[12.5px] text-text-dim sm:text-sm">
            רישום המקורות מטבלת <span className="font-mono text-[11px] text-text-faint">data_sources</span> — סטטוס,
            תאריך עדכון אחרון וקישור למקור.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-md border border-border bg-bg-1 px-3 py-1.5 text-xs font-medium text-text hover:bg-bg-2 disabled:opacity-50"
        >
          {isFetching ? 'מרענן…' : 'רענן'}
        </button>
      </div>

      {isPending && (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-teal" size={28} />
        </div>
      )}

      {isError && (
        <div className="max-w-lg rounded-lg border border-danger/30 bg-danger/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 shrink-0 text-danger" size={22} />
            <div>
              <p className="text-sm font-medium text-text">שגיאה בטעינת המקורות</p>
              <p className="mt-1 font-mono text-xs text-text-dim">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {!isPending && !isError && rows?.length === 0 && (
        <p className="text-sm text-text-dim">אין רשומות ב־data_sources.</p>
      )}

      {!isPending && !isError && rows && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-bg-1 px-4 py-3 transition-colors hover:bg-bg-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', STATUS_DOT[s.status])} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{s.display_name}</span>
                  <span className="mt-0.5 block text-xs text-text-dim">
                    עודכן לאחרונה: {formatSourceUpdatedAt(s)}
                  </span>
                </div>
              </div>
              {s.source_url && (
                <a
                  href={s.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-md border border-brand-teal/30 bg-brand-teal/10 px-2.5 py-1 text-xs font-medium text-brand-teal transition-colors hover:bg-brand-teal/20 sm:self-center"
                >
                  קישור למקור
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
