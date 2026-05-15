import { useCallback, useEffect, useState } from 'react';
import { Clock, FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShapefileUpload } from '@/hooks/useShapefileUpload';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import type { UserSavedFilesRow } from '@/types/schema-from-migration';

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(i === 0 ? 0 : 1))} ${sizes[i]}`;
}

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function fileFromBlob(blob: Blob, row: UserSavedFilesRow): File {
  return new File([blob], row.original_filename, {
    type: row.content_type || blob.type || 'application/octet-stream',
  });
}

export function SavedFilesPicker(): JSX.Element | null {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const showToast = useUIStore((s) => s.showToast);
  const { ingestFiles, isParsing } = useShapefileUpload();
  const [rows, setRows] = useState<UserSavedFilesRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSavedFiles = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured || !isAuthenticated) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from('user_saved_files')
      .select(
        'id, user_id, bucket_id, storage_path, original_filename, content_type, byte_size, created_at, updated_at'
      )
      .order('created_at', { ascending: false })
      .limit(5);

    if (queryError) {
      setRows([]);
      setError(queryError.message);
    } else {
      setRows((data ?? []) as UserSavedFilesRow[]);
    }

    setIsLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    void loadSavedFiles();
  }, [loadSavedFiles]);

  if (!isSupabaseConfigured || !isAuthenticated) {
    return null;
  }

  const handleLoad = async (row: UserSavedFilesRow): Promise<void> => {
    setLoadingFileId(row.id);
    try {
      const { data, error: signError } = await supabase.storage
        .from(row.bucket_id)
        .createSignedUrl(row.storage_path, 300);

      if (signError || !data?.signedUrl) {
        showToast(signError?.message ?? 'לא ניתן ליצור קישור לקובץ השמור', 4500);
        return;
      }

      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        showToast('טעינת הקובץ השמור נכשלה', 4500);
        return;
      }

      const file = fileFromBlob(await response.blob(), row);
      await ingestFiles([file]);
    } catch (err) {
      showToast((err as Error).message || 'טעינת הקובץ השמור נכשלה', 4500);
    } finally {
      setLoadingFileId(null);
    }
  };

  return (
    <div className="rounded-[10px] border border-border/80 bg-bg-1/45 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-semibold text-text">קבצים שמורים</div>
          <div className="text-[11px] text-text-faint">טעינה מהקבצים האחרונים שלך</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadSavedFiles()}
          disabled={isLoading || Boolean(loadingFileId) || isParsing}
          className="h-7 px-2"
        >
          {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
          רענן
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-text-dim">
          <Loader2 size={14} className="animate-spin text-brand-teal" />
          טוען קבצים שמורים...
        </div>
      ) : error ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-border/70 bg-bg-2/40 p-2 text-xs text-text-dim">
          אין עדיין קבצים שמורים לחשבון הזה.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const isLoadingFile = loadingFileId === row.id;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => void handleLoad(row)}
                disabled={Boolean(loadingFileId) || isParsing}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md border border-border/80 bg-surface/70 p-2 text-start transition-colors',
                  'hover:border-brand-teal/50 hover:bg-brand-teal/5',
                  (loadingFileId || isParsing) && 'pointer-events-none opacity-70'
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-text">{row.original_filename}</div>
                  <div className="mt-0.5 text-[11px] text-text-faint">
                    {formatBytes(row.byte_size)} · {formatSavedAt(row.created_at)}
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-brand-teal/25 px-2 py-1 text-[11px] font-medium text-brand-teal">
                  {isLoadingFile ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
                  טען
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
