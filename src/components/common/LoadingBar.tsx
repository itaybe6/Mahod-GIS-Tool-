import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';

export interface LoadingBarProps {
  className?: string;
  /** Auto-hide after this many ms. */
  autoHideMs?: number;
}

/**
 * Thin gradient bar pinned to the top of the viewport. Reads its visibility
 * from the UI store so any feature can flip it on/off via `setTopLoaderVisible`.
 */
export function LoadingBar({ className, autoHideMs = 2800 }: LoadingBarProps): JSX.Element | null {
  const visible = useUIStore((s) => s.topLoaderVisible);
  const setVisible = useUIStore((s) => s.setTopLoaderVisible);

  useEffect(() => {
    if (!visible || autoHideMs <= 0) return;
    const timer = window.setTimeout(() => setVisible(false), autoHideMs);
    return () => window.clearTimeout(timer);
  }, [visible, autoHideMs, setVisible]);

  if (!visible) return null;
  return <div className={cn('top-loader', className)} />;
}
