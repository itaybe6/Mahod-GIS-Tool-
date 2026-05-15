import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
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

type AuthGate = 'checking' | 'allowed' | 'denied';

export function RecentFilesPage(): JSX.Element {
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const showToast = useUIStore((s) => s.showToast);
  const [authGate, setAuthGate] = useState<AuthGate>('checking');
  const [rows, setRows] = useState<UserSavedFilesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured) {
      setError('Supabase לא מוגדר (חסרים משתני סביבה).');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('user_saved_files')
      .select(
        'id, user_id, bucket_id, storage_path, original_filename, content_type, byte_size, created_at, updated_at'
      )
      .order('created_at', { ascending: false });
    if (queryError) {
      setError(queryError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as UserSavedFilesRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setAuthGate('denied');
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (!session) {
        if (isGuest) {
          setAuthGate('allowed');
          setRows([]);
          setLoading(false);
          return;
        }
        setAuthenticated(false);
        setAuthGate('denied');
        navigate(ROUTES.LOGIN, { replace: true, state: { from: ROUTES.RECENT_FILES } });
        return;
      }

      setAuthenticated(true);
      setAuthGate('allowed');
      await load();
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, load, setAuthenticated, isGuest]);

  const handleDownload = async (row: UserSavedFilesRow): Promise<void> => {
    setDownloadingId(row.id);
    try {
      const { data, error: signError } = await supabase.storage
        .from(row.bucket_id)
        .createSignedUrl(row.storage_path, 3600);
      if (signError || !data?.signedUrl) {
        showToast(signError?.message ?? 'לא ניתן ליצור קישור להורדה');
        return;
      }
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = row.original_filename;
      a.rel = 'noopener';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloadingId(null);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center overflow-y-auto bg-bg-1 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]" dir="rtl">
        <div className="max-w-md rounded-lg border border-warning/30 bg-warning/5 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 text-warning" size={26} />
          <h2 className="mb-1 text-base font-semibold text-text">Supabase לא מוגדר</h2>
          <p className="text-sm leading-relaxed text-text-dim">
            כדי לטעון את רשימת הקבצים צריך להגדיר `VITE_SUPABASE_URL` ו־`VITE_SUPABASE_ANON_KEY`.
          </p>
        </div>
      </div>
    );
  }

  if (authGate === 'checking' || authGate === 'denied') {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-bg-1 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]" dir="rtl">
        <Loader2 className="animate-spin text-brand-teal" size={28} aria-label="טוען" />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto bg-bg-1 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-3.5 lg:pb-3.5"
      dir="rtl"
    >
      <div>
        <h1 className="text-base font-semibold text-text sm:text-lg">קבצים אחרונים</h1>
        <p className="mt-1 max-w-2xl text-[12.5px] text-text-dim sm:text-sm">
          קבצים שהועלו לחשבון שלך (לפי תאריך העלאה). הורדה דרך קישור חתום לשעה.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-teal" size={28} aria-label="טוען" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-text">
          <p className="font-medium text-danger">שגיאה בטעינה</p>
          <p className="mt-1 text-text-dim">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-2/40 px-4 py-10 text-center text-sm text-text-dim">
          {isGuest ? (
            <>
              <p className="font-medium text-text">כניסה כאורח</p>
              <p className="mt-2 leading-relaxed">
                כדי לראות ולנהל קבצים שמורים בחשבון, התחבר דרך עמוד ההתחברות.
              </p>
            </>
          ) : (
            <>עדיין לא הועלו קבצים. כשתעלה קבצים דרך האפליקציה והם יישמרו בטבלה, הם יופיעו כאן.</>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[520px] border-collapse text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-2/60 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
                <th className="px-3 py-2.5 font-medium">שם קובץ</th>
                <th className="px-3 py-2.5 font-medium">גודל</th>
                <th className="px-3 py-2.5 font-medium">תאריך</th>
                <th className="w-28 px-3 py-2.5 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/80 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-text">{row.original_filename}</div>
                    {row.content_type && (
                      <div className="mt-0.5 font-mono text-[11px] text-text-faint">{row.content_type}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-text-dim">{formatBytes(row.byte_size)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-text-dim">
                    {new Date(row.created_at).toLocaleString('he-IL', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => void handleDownload(row)}
                      disabled={downloadingId === row.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors',
                        'text-brand-teal hover:bg-brand-teal/10',
                        downloadingId === row.id && 'pointer-events-none opacity-60'
                      )}
                    >
                      {downloadingId === row.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                      הורדה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
