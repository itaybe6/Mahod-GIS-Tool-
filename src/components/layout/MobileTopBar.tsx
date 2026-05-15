import { Menu, PanelRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import logoUrl from '../../../Logo.png?url';

export interface MobileTopBarProps {
  /**
   * When true, the right-panel toggle button is rendered. Pages without a
   * useful right rail (e.g. statistics) hide it to keep the bar focused.
   */
  showRightPanelToggle?: boolean;
}

/**
 * Slim top bar shown only below the `lg` breakpoint. Hosts the brand mark,
 * the hamburger that opens the navigation drawer, and (optionally) a button
 * that pops the contextual right-panel as a bottom sheet.
 */
export function MobileTopBar({ showRightPanelToggle = true }: MobileTopBarProps): JSX.Element {
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const setMobileRightPanelOpen = useUIStore((s) => s.setMobileRightPanelOpen);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg-2/90 px-3 lg:hidden">
      <button
        type="button"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="פתח תפריט"
        className={cn(
          'grid h-10 w-10 place-items-center rounded-md border border-border bg-bg-1 text-text-dim',
          'transition-colors hover:border-brand-teal/40 hover:text-brand-teal'
        )}
      >
        <Menu size={18} />
      </button>

      <NavLink
        to={ROUTES.DASHBOARD}
        end
        aria-label="דשבורד ראשי"
        className="ms-1 flex min-w-0 flex-1 items-center justify-center"
      >
        <img
          src={logoUrl}
          alt="מהוד הנדסה"
          className="max-h-8 w-auto object-contain"
          decoding="async"
        />
      </NavLink>

      {showRightPanelToggle ? (
        <button
          type="button"
          onClick={() => setMobileRightPanelOpen(true)}
          aria-label="פתח כלים"
          className={cn(
            'grid h-10 w-10 place-items-center rounded-md border border-border bg-bg-1 text-text-dim',
            'transition-colors hover:border-brand-teal/40 hover:text-brand-teal'
          )}
        >
          <PanelRight size={18} />
        </button>
      ) : (
        <span aria-hidden className="h-10 w-10" />
      )}
    </header>
  );
}
