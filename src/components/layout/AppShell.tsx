import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { MobileTopBar } from './MobileTopBar';
import { LoadingBar } from '@/components/common/LoadingBar';
import { Toast } from '@/components/common/Toast';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export interface AppShellProps {
  /** Main route content (map area, dashboards, etc.). */
  children: ReactNode;
  /** Per-page right-panel content. If omitted, the default panel renders. */
  rightPanel?: ReactNode;
  /**
   * Hide the mobile right-panel sheet button + content for pages that don't
   * benefit from the upload/analyze rail (e.g. statistics, infrastructure).
   * Defaults to `true`.
   */
  showMobileRightPanel?: boolean;
  /**
   * Completely hide the right panel (desktop column + mobile sheet) for pages
   * that have no use for the upload/analyze workflow — statistics, transit,
   * infrastructure, sources, history, etc.
   * Defaults to `false`.
   */
  hideRightPanel?: boolean;
}

/**
 * Layout: (sidebar | main | right-panel) on desktop. Below `lg` (1024px) we
 * collapse to a single column with a slide-in drawer for the sidebar and a
 * bottom sheet for the right rail, so phones and tablets keep the full
 * viewport for content while still being able to reach every control.
 *
 * Responsive breakpoints:
 *   - 1280px ≤ width        → full sidebar (220px) + right panel (340px)
 *   - 1024px ≤ width <1280  → icon sidebar (64px) + right panel (320px)
 *   - width <1024           → mobile shell (top bar + drawer + bottom sheet)
 */
export function AppShell({
  children,
  rightPanel,
  showMobileRightPanel = true,
  hideRightPanel = false,
}: AppShellProps): JSX.Element {
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const mobileRightPanelOpen = useUIStore((s) => s.mobileRightPanelOpen);
  const setMobileRightPanelOpen = useUIStore((s) => s.setMobileRightPanelOpen);
  const location = useLocation();

  // Close drawers on route change so navigating doesn't leave overlays open.
  useEffect(() => {
    setMobileSidebarOpen(false);
    setMobileRightPanelOpen(false);
  }, [location.pathname, setMobileSidebarOpen, setMobileRightPanelOpen]);

  // Lock body scroll while a mobile overlay is open.
  useEffect(() => {
    const anyOpen = mobileSidebarOpen || mobileRightPanelOpen;
    if (!anyOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileSidebarOpen, mobileRightPanelOpen]);

  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden">
      <LoadingBar />

      <MobileTopBar showRightPanelToggle={!hideRightPanel && showMobileRightPanel} />

      <div
        className={cn(
          'flex min-h-0 flex-1 overflow-hidden lg:grid',
          !hideRightPanel && rightPanelOpen
            ? 'lg:grid-cols-[64px_1fr_320px] xl:grid-cols-[220px_1fr_340px]'
            : 'lg:grid-cols-[64px_1fr] xl:grid-cols-[220px_1fr]'
        )}
      >
        {/* Desktop sidebar — hidden below lg (replaced by drawer below). */}
        <div className="hidden lg:contents">
          <Sidebar />
        </div>

        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-bg-1 lg:flex-none lg:overflow-hidden">
          {children}
        </main>

        {/* Desktop right panel */}
        {!hideRightPanel && rightPanelOpen && (
          <div className="hidden lg:contents">
            <RightPanel>{rightPanel}</RightPanel>
          </div>
        )}
      </div>

      {/* Mobile sidebar drawer (slides in from the start side / right in RTL). */}
      <MobileDrawer
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        side="start"
        ariaLabel="תפריט ראשי"
      >
        <Sidebar variant="mobile" />
      </MobileDrawer>

      {/* Mobile right-panel bottom sheet. */}
      {!hideRightPanel && showMobileRightPanel && (
        <MobileSheet
          open={mobileRightPanelOpen}
          onClose={() => setMobileRightPanelOpen(false)}
          ariaLabel="כלים"
        >
          <RightPanel>{rightPanel}</RightPanel>
        </MobileSheet>
      )}

      <Toast />
    </div>
  );
}

interface MobileOverlayProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
}

function MobileDrawer({
  open,
  onClose,
  side,
  ariaLabel,
  children,
}: MobileOverlayProps & { side: 'start' | 'end' }): JSX.Element {
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[700] bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        // The app is RTL globally (html[dir=rtl]), so the right edge maps to
        // `start-0` and "off-screen closed" is `translate-x-full` (positive X).
        className={cn(
          'fixed inset-y-0 z-[710] flex w-[82%] max-w-[320px] flex-col overflow-hidden bg-bg-1 shadow-2xl transition-transform duration-200 lg:hidden',
          side === 'start' ? 'start-0 border-e border-border' : 'end-0 border-s border-border',
          open ? 'translate-x-0' : side === 'start' ? 'translate-x-full' : '-translate-x-full'
        )}
      >
        <div className="flex shrink-0 items-center justify-end border-b border-border/60 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור תפריט"
            className="grid h-9 w-9 place-items-center rounded-md text-text-dim transition-colors hover:bg-white/[0.06] hover:text-text"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </aside>
    </>
  );
}

function MobileSheet({ open, onClose, ariaLabel, children }: MobileOverlayProps): JSX.Element {
  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[700] bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[710] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-bg-2 shadow-2xl transition-transform duration-200 lg:hidden',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2">
          <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-border" />
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="grid h-9 w-9 place-items-center rounded-md text-text-dim transition-colors hover:bg-white/[0.06] hover:text-text"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </section>
    </>
  );
}
