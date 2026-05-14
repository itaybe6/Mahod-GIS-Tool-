import { useEffect } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

/**
 * Singleton toast pinned to the bottom of the viewport.
 * Drives its message and dismiss timeout from the UI store.
 */
export function Toast(): JSX.Element {
  const toast = useUIStore((s) => s.toast);
  const dismiss = useUIStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismiss, toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-6 left-1/2 z-[999] -translate-x-1/2',
        'flex items-center gap-2 rounded-[10px] border px-4 py-2.5 text-sm',
        'bg-surface text-text shadow-[0_8px_28px_rgba(76,175,80,0.28)]',
        'transition-all duration-[250ms] ease-out',
        toast
          ? 'translate-y-0 border-brand-teal opacity-100'
          : 'pointer-events-none translate-y-5 border-transparent opacity-0'
      )}
    >
      <span className="h-2 w-2 rounded-full bg-brand-teal shadow-[0_0_8px_#4caf50]" />
      <span>{toast?.message ?? ''}</span>
    </div>
  );
}
