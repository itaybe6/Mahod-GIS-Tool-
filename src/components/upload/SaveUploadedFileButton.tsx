import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useUploadStore } from '@/stores/uploadStore';
import type { UserSavedFilesInsert } from '@/types/schema-from-migration';

const BUCKET_ID = 'user-uploads';

function extensionOf(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot) : '';
}

function stemOf(filename: string): string {
  const ext = extensionOf(filename);
  return ext ? filename.slice(0, -ext.length) : filename;
}

function displayNameWithExtension(name: string, sourceFilename: string): string {
  const trimmed = name.trim();
  const fallback = sourceFilename.trim() || 'uploaded-file';
  const candidate = trimmed || fallback;
  return extensionOf(candidate) ? candidate : `${candidate}${extensionOf(fallback)}`;
}

function sanitizeStorageFilename(filename: string): string {
  return filename
    .trim()
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SaveUploadedFileButton(): JSX.Element | null {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const savedFile = useUploadStore((s) => s.savedFile);
  const sourceName = useUploadStore((s) => s.sourceName);
  const showToast = useUIStore((s) => s.showToast);
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedStoragePath, setSavedStoragePath] = useState<string | null>(null);

  const defaultName = useMemo(() => stemOf(savedFile?.name ?? sourceName ?? ''), [savedFile, sourceName]);

  useEffect(() => {
    setDisplayName(defaultName);
    setSavedStoragePath(null);
  }, [defaultName, savedFile]);

  if (!isSupabaseConfigured || !isAuthenticated || !savedFile) {
    return null;
  }

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        showToast(sessionError?.message ?? 'צריך להתחבר כדי לשמור קובץ', 3500);
        return;
      }

      const filename = displayNameWithExtension(displayName, savedFile.name);
      const storageFilename = sanitizeStorageFilename(filename) || `${randomId()}${extensionOf(filename)}`;
      const storagePath = `${session.user.id}/${randomId()}-${storageFilename}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_ID)
        .upload(storagePath, savedFile, {
          contentType: savedFile.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        showToast(`שמירת הקובץ נכשלה: ${uploadError.message}`, 4500);
        return;
      }

      const row: UserSavedFilesInsert = {
        user_id: session.user.id,
        bucket_id: BUCKET_ID,
        storage_path: storagePath,
        original_filename: filename,
        content_type: savedFile.type || null,
        byte_size: savedFile.size,
      };

      const { error: insertError } = await supabase.from('user_saved_files').insert(row);

      if (insertError) {
        await supabase.storage.from(BUCKET_ID).remove([storagePath]);
        showToast(`הקובץ הועלה אבל הרישום בטבלה נכשל: ${insertError.message}`, 5000);
        return;
      }

      setSavedStoragePath(storagePath);
      showToast('הקובץ נשמר בקבצים אחרונים');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 rounded-md border border-border/80 bg-bg-1/60 p-2">
      <label className="flex flex-col gap-1 text-[11px] text-text-dim">
        שם לשמירה בקבצים אחרונים
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={isSaving || Boolean(savedStoragePath)}
          className="h-8 text-xs"
          aria-label="שם לשמירת הקובץ"
        />
      </label>
      <Button
        type="button"
        size="sm"
        onClick={() => void handleSave()}
        disabled={isSaving || Boolean(savedStoragePath)}
        className="w-full"
      >
        {isSaving ? (
          <Loader2 size={14} className="animate-spin" />
        ) : savedStoragePath ? (
          <CheckCircle2 size={14} />
        ) : (
          <Save size={14} />
        )}
        {savedStoragePath ? 'נשמר' : 'שמור קובץ'}
      </Button>
    </div>
  );
}
