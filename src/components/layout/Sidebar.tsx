import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  Bus,
  Navigation,
  Building2,
  Database,
  History,
  RefreshCw,
  LogIn,
  LogOut,
  FolderClock,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES, type RoutePath } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
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
      { to: ROUTES.STATISTICS, label: 'סטטיסטיקות', icon: AlertTriangle, badge: '2.8K' },
      { to: ROUTES.TRANSIT, label: 'תחבורה ציבורית', icon: Bus },
      { to: ROUTES.ROUTE_PLANNER, label: 'תכנון מסלול', icon: Navigation, badge: 'חדש' },
      { to: ROUTES.INFRASTRUCTURE, label: 'תשתיות', icon: Building2 },
    ],
  },
  {
    title: 'ניהול נתונים',
    items: [
      { to: ROUTES.SOURCES, label: 'מקורות מידע', icon: Database },
      { to: ROUTES.HISTORY, label: 'היסטוריית עדכונים', icon: History },
    ],
  },
];

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '2.4.1';

type DataPullTarget = 'all' | 'traffic_counts' | 'railway';

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
  const [testingDataPullTarget, setTestingDataPullTarget] = useState<DataPullTarget | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const showToast = useUIStore((s) => s.showToast);

  const handleDataPullTest = async (target: DataPullTarget = 'all'): Promise<void> => {
    if (testingDataPullTarget !== null) return;
    if (!isSupabaseConfigured) {
      showToast('Supabase לא מוגדר (חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).', 5000);
      return;
    }

    const functionName =
      target === 'traffic_counts'
        ? 'update-agent?source=traffic_counts&force=true'
        : target === 'railway'
          ? 'update-agent?source=railway&force=true'
          : 'update-agent';
    const toastLabel =
      target === 'traffic_counts'
        ? 'בודק משיכת vehicleCounts...'
        : target === 'railway'
          ? 'בודק משיכת רכבת כבדה...'
          : 'בודק משיכת נתונים...';

    setTestingDataPullTarget(target);
    showToast(toastLabel);

    try {
      const result = (await supabase.functions.invoke<UpdateAgentResponse>(functionName)) as {
        data: UpdateAgentResponse | null;
        error: unknown | null;
      };

      if (result.error) {
        showToast(await extractFunctionError(result.error), 6000);
        return;
      }

      const summary = formatUpdateAgentResult(result.data);
      showToast(summary, 5000);
    } catch (err) {
      showToast((err as Error).message || 'בדיקת משיכת הנתונים נכשלה', 6000);
    } finally {
      setTestingDataPullTarget(null);
    }
  };

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

      <div className="mt-5">
        <div
          className={cn(
            'px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[1.4px] text-text-faint',
            labelHide
          )}
        >
          כלים
        </div>
        <SidebarActionItem
          label={testingDataPullTarget === 'all' ? 'בודק משיכת נתונים...' : 'בדיקת משיכת נתונים'}
          icon={RefreshCw}
          onClick={() => {
            void handleDataPullTest();
          }}
          disabled={testingDataPullTarget !== null}
          iconClassName={testingDataPullTarget === 'all' ? 'animate-spin' : undefined}
          labelHide={labelHide}
          itemCollapse={itemCollapse}
        />
        <SidebarActionItem
          label={
            testingDataPullTarget === 'traffic_counts'
              ? 'מושך vehicleCounts...'
              : 'משיכת vehicleCounts'
          }
          icon={RefreshCw}
          onClick={() => {
            void handleDataPullTest('traffic_counts');
          }}
          disabled={testingDataPullTarget !== null}
          iconClassName={testingDataPullTarget === 'traffic_counts' ? 'animate-spin' : undefined}
          labelHide={labelHide}
          itemCollapse={itemCollapse}
        />
        <SidebarActionItem
          label={
            testingDataPullTarget === 'railway'
              ? 'מושך רכבת כבדה...'
              : 'משיכת רכבת כבדה'
          }
          icon={RefreshCw}
          onClick={() => {
            void handleDataPullTest('railway');
          }}
          disabled={testingDataPullTarget !== null}
          iconClassName={testingDataPullTarget === 'railway' ? 'animate-spin' : undefined}
          labelHide={labelHide}
          itemCollapse={itemCollapse}
        />
      </div>

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
        {isAuthenticated ? (
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
        <span className="mb-1.5 inline-block rounded-full border border-border bg-brand-teal/10 px-1.5 py-0.5 font-mono text-[10px] text-brand-teal">
          v{APP_VERSION}
        </span>
        <div className={labelHide || undefined}>
          מהוד הנדסה בע״מ
          <br />© 2025
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

interface UpdateAgentResponse {
  trigger?: string;
  results?: Record<string, string>;
  error?: string;
  message?: string;
  sourceFilter?: string | null;
}

function formatUpdateAgentResult(data: UpdateAgentResponse | null): string {
  if (!data) return 'בדיקת משיכת הנתונים הסתיימה ללא תגובה מהשרת';
  if (data.error) return data.error;
  if (data.message) return data.message;

  const results = data.results ?? {};
  const entries = Object.entries(results);
  if (entries.length === 0) return 'בדיקת משיכת הנתונים הסתיימה';

  const failed = entries.filter(([, status]) => status !== 'success');
  if (failed.length > 0) {
    return `בדיקת משיכת הנתונים הסתיימה עם ${failed.length} כשלונות`;
  }

  return `בדיקת משיכת הנתונים הצליחה (${entries.length} מקורות)`;
}

async function extractFunctionError(error: unknown): Promise<string> {
  const fallback = (error as Error)?.message || 'בדיקת משיכת הנתונים נכשלה';
  const response = (error as { context?: { response?: Response } }).context?.response;
  if (!response) return fallback;

  try {
    const body: unknown = await response.clone().json();
    if (body && typeof body === 'object' && 'error' in body) {
      return String((body as { error: unknown }).error);
    }
  } catch {
    /* ignore non-JSON error bodies */
  }

  return fallback;
}
