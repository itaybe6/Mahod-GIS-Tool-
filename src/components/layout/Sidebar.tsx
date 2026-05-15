import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  Bus,
  Navigation,
  Building2,
  Database,
  LogIn,
  LogOut,
  FolderClock,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES, type RoutePath } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { MahodLogo } from './MahodLogo';

interface NavEntry {
  to: RoutePath;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavEntry[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'ניתוח נתונים',
    items: [
      { to: ROUTES.DASHBOARD, label: 'דשבורד ראשי', icon: LayoutDashboard },
      { to: ROUTES.STATISTICS, label: 'סטטיסטיקות', icon: AlertTriangle },
      { to: ROUTES.TRANSIT, label: 'תחבורה ציבורית', icon: Bus },
      { to: ROUTES.ROUTE_PLANNER, label: 'תכנון מסלול', icon: Navigation },
      { to: ROUTES.INFRASTRUCTURE, label: 'תשתיות', icon: Building2 },
    ],
  },
  {
    title: 'ניהול נתונים',
    items: [{ to: ROUTES.SOURCES, label: 'מקורות מידע', icon: Database }],
  },
];

/**
 * `variant="mobile"` forces the full-label layout (used inside the mobile
 * navigation drawer where there's plenty of horizontal room). `desktop`
 * (the default) keeps the responsive icon-collapse at ≤1280px.
 */
export type SidebarVariant = 'desktop' | 'mobile';

export interface SidebarProps {
  variant?: SidebarVariant;
}

export function Sidebar({ variant = 'desktop' }: SidebarProps): JSX.Element {
  const navigate = useNavigate();
  const isMobile = variant === 'mobile';
  const labelHide = isMobile ? '' : 'max-[1280px]:hidden';
  const itemCollapse = isMobile ? '' : 'max-[1280px]:justify-center max-[1280px]:px-1.5';
  const activeIndicatorOffset = isMobile ? '-end-3' : '-end-3 max-[1280px]:-end-2';
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async (): Promise<void> => {
    await supabase.auth.signOut();
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <aside
      className={cn(
        'flex h-full flex-col overflow-y-auto border-s border-border px-3 pb-3.5 pt-4',
        'bg-[radial-gradient(circle_at_0%_0%,rgba(26,111,181,0.2),transparent_52%),radial-gradient(circle_at_100%_0%,rgba(26,111,181,0.14),transparent_48%),#0a0e1a]'
      )}
    >
      <MahodLogo variant={variant} />
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.title} className={cn(index > 0 && 'mt-5')}>
          <div
            className={cn(
              'px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[1.4px] text-text-faint',
              labelHide
            )}
          >
            {section.title}
          </div>
          {section.items.map((item) => (
            <SidebarItem
              key={item.to}
              entry={item}
              labelHide={labelHide}
              itemCollapse={itemCollapse}
              activeIndicatorOffset={activeIndicatorOffset}
            />
          ))}
        </div>
      ))}

      {isAuthenticated && (
        <div className="mt-5">
          <div
            className={cn(
              'px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[1.4px] text-text-faint',
              labelHide
            )}
          >
            חשבון
          </div>
          <SidebarItem
            entry={{ to: ROUTES.RECENT_FILES, label: 'קבצים אחרונים', icon: FolderClock }}
            labelHide={labelHide}
            itemCollapse={itemCollapse}
            activeIndicatorOffset={activeIndicatorOffset}
          />
        </div>
      )}

      <div className="mt-5">
        {isAuthenticated || isGuest ? (
          <SidebarActionItem
            label="התנתקות"
            icon={LogOut}
            onClick={() => {
              void handleLogout();
            }}
            labelHide={labelHide}
            itemCollapse={itemCollapse}
          />
        ) : (
          <SidebarItem
            entry={{ to: ROUTES.LOGIN, label: 'התחברות', icon: LogIn }}
            labelHide={labelHide}
            itemCollapse={itemCollapse}
            activeIndicatorOffset={activeIndicatorOffset}
          />
        )}
      </div>

      <div className="mt-auto border-t border-border pt-4 text-center text-[11px] leading-[1.6] text-text-faint">
        <div>
          ITAY BEN YAIR
          <br />© 2026
        </div>
      </div>
    </aside>
  );
}

interface SidebarItemProps {
  entry: NavEntry;
  labelHide: string;
  itemCollapse: string;
  activeIndicatorOffset: string;
}

function SidebarItem({
  entry,
  labelHide,
  itemCollapse,
  activeIndicatorOffset,
}: SidebarItemProps): JSX.Element {
  const { to, label, icon: Icon, badge } = entry;
  return (
    <NavLink
      to={to}
      end={to === ROUTES.DASHBOARD}
      className={({ isActive }) =>
        cn(
          'group relative my-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] transition-colors',
          itemCollapse,
          isActive
            ? 'bg-brand-teal/10 font-medium text-brand-teal'
            : 'text-text hover:bg-white/[0.04]'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-1/2 h-[22px] w-[3px] -translate-y-1/2 rounded-s-none rounded-e-[3px] bg-brand-teal shadow-[0_0_8px_rgba(76,175,80,0.4)]',
                activeIndicatorOffset
              )}
            />
          )}
          <Icon size={16} className="shrink-0" />
          <span className={labelHide || undefined}>{label}</span>
          {badge && (
            <span
              className={cn(
                'ms-auto rounded border px-1.5 py-px font-mono text-[10px]',
                labelHide,
                isActive
                  ? 'border-brand-teal/30 bg-brand-teal/10 text-brand-teal'
                  : 'border-border bg-bg-1 text-text-faint'
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

interface SidebarActionItemProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  iconClassName?: string | undefined;
  labelHide: string;
  itemCollapse: string;
}

function SidebarActionItem({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  iconClassName,
  labelHide,
  itemCollapse,
}: SidebarActionItemProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative my-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] transition-colors',
        itemCollapse,
        disabled
          ? 'cursor-not-allowed text-text-faint opacity-70'
          : 'text-text hover:bg-white/[0.04]'
      )}
    >
      <Icon size={16} className={cn('shrink-0', iconClassName)} />
      <span className={labelHide || undefined}>{label}</span>
    </button>
  );
}

