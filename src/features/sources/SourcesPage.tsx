import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { DataSourcesRow } from '@/types/schema-from-migration';
import type { Json } from '@/lib/supabase/types';

import { useDataSources } from './useDataSources';

const STATUS_LABEL: Record<
  DataSourcesRow['status'],
  { label: string; cls: string }
> = {
  active: { label: 'פעיל', cls: 'text-brand-teal border-brand-teal/30 bg-brand-teal/10' },
  error: { label: 'שגיאה', cls: 'text-danger border-danger/30 bg-danger/10' },
  disabled: { label: 'מושבת', cls: 'text-text-faint border-border bg-bg-1' },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatBytes(raw: string | number | null): string {
  if (raw == null) return '—';
  const bytes = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / k ** i).toFixed(i === 0 ? 0 : 1))} ${sizes[i]}`;
}

function metadataDescription(metadata: Json): string | null {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const d = (metadata as Record<string, unknown>).description;
  return typeof d === 'string' && d.trim() !== '' ? d : null;
}

function shortHash(hash: string | null): string {
  if (!hash) return '—';
  return hash.length <= 14 ? hash : `${hash.slice(0, 10)}…${hash.slice(-4)}`;
}

export function SourcesPage(): JSX.Element {
  const { data: rows, isPending, isError, error, refetch, isFetching } = useDataSources();

  if (!isSupabaseConfigured) {
    return (
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain p-3.5"
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
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain p-3 sm:p-3.5"
      dir="rtl"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-text sm:text-lg">מקורות מידע</h1>
          <p className="mt-0.5 max-w-3xl text-[12.5px] text-text-dim sm:text-sm">
            רישום המקורות מטבלת <span className="font-mono text-[11px] text-text-faint">data_sources</span> — עדכונים
            ומעקב אחרי סוכן הטעינה.
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-1 md:grid-cols-2">
          {rows.map((s) => {
            const extraDescription = metadataDescription(s.metadata);
            return (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <span>{s.display_name}</span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 font-mono text-[10.5px]',
                      STATUS_LABEL[s.status].cls
                    )}
                  >
                    {STATUS_LABEL[s.status].label}
                  </span>
                </CardTitle>
                <p className="font-mono text-[11px] text-text-faint">{s.name}</p>
              </CardHeader>
              <div className="space-y-3 px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
                {extraDescription != null ? (
                  <p className="text-sm leading-relaxed text-text-dim">{extraDescription}</p>
                ) : null}
                <a
                  href={s.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-teal hover:underline"
                >
                  קישור למקור
                  <ExternalLink size={14} className="opacity-80" />
                </a>
                <dl className="grid grid-cols-1 gap-2 border-t border-border pt-3 text-xs text-text-dim sm:grid-cols-2">
                  <div>
                    <dt className="text-text-faint">עדכון אחרון במסד</dt>
                    <dd className="font-mono text-text">{formatDateTime(s.last_updated_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-faint">נבדק לאחרונה</dt>
                    <dd className="font-mono text-text">{formatDateTime(s.last_checked_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-faint">מספר רשומות</dt>
                    <dd className="font-mono text-text">{s.record_count != null ? s.record_count.toLocaleString('he-IL') : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-text-faint">גודל קובץ אחרון</dt>
                    <dd className="font-mono text-text">{formatBytes(s.file_size_bytes)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-text-faint">גיבוב (SHA256)</dt>
                    <dd className="break-all font-mono text-[11px] text-text">{shortHash(s.file_hash)}</dd>
                  </div>
                </dl>
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
