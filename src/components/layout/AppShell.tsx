import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { LoadingBar } from '@/components/common/LoadingBar';
import { Toast } from '@/components/common/Toast';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export interface AppShellProps {
  /** Main route content (map area, dashboards, etc.). */
  children: ReactNode;
  /** Per-page right-panel content. If omitted, the default panel renders. */
  rightPanel?: ReactNode;
}

/**
 * Layout: (sidebar | main | right-panel). No top chrome — navigation lives in
 * the sidebar. Responsive breakpoints collapse the sidebar to icons (≤1280px)
 * and hide the right panel entirely (≤1024px).
 */
export function AppShell({ children, rightPanel }: AppShellProps): JSX.Element {
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <LoadingBar />
      <div
        className={cn(
          'grid min-h-0 flex-1 overflow-hidden',
          rightPanelOpen
            ? 'grid-cols-[220px_1fr_340px] max-[1280px]:grid-cols-[64px_1fr_320px] max-[1024px]:grid-cols-[64px_1fr]'
            : 'grid-cols-[220px_1fr] max-[1280px]:grid-cols-[64px_1fr]'
        )}
      >
        <Sidebar />
        <main className="flex min-w-0 flex-col overflow-hidden bg-bg-1">{children}</main>
        {rightPanelOpen && <RightPanel>{rightPanel}</RightPanel>}
      </div>
      <Toast />
    </div>
  );
}
