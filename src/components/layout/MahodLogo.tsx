import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

import logoUrl from '../../../Logo.png?url';

export interface MahodLogoProps {
  /**
   * `mobile` keeps the logo at full width inside the navigation drawer where
   * there's plenty of room. `desktop` (default) collapses it at ≤1280px to
   * match the icon-only sidebar.
   */
  variant?: 'desktop' | 'mobile';
}

/**
 * Brand lockup for the sidebar — official Mahod raster (`Logo.png` at repo root).
 * Scales down in the icon-only nav breakpoint (≤1280px) on desktop.
 */
export function MahodLogo({ variant = 'desktop' }: MahodLogoProps): JSX.Element {
  return (
    <NavLink
      to={ROUTES.DASHBOARD}
      end
      className={cn(
        'mb-4 flex justify-center rounded-lg px-1 py-1.5 transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-2',
        'hover:bg-white/[0.04]'
      )}
      aria-label="מהוד הנדסה — דשבורד ראשי"
    >
      <img
        src={logoUrl}
        alt="מהוד הנדסה — מקבוצת מילגם"
        width={200}
        height={48}
        decoding="async"
        className={cn(
          'h-auto w-full max-w-[192px] object-contain object-center max-h-[52px]',
          variant === 'desktop' && 'max-[1280px]:max-h-9 max-[1280px]:max-w-[3.25rem]'
        )}
      />
    </NavLink>
  );
}
