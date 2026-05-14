import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  AlertTriangle,
  Bus,
  Building2,
  Database,
  History,
  Download,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES, type RoutePath } from '@/constants/routes';
import { cn } from '@/lib/utils';

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
      { to: ROUTES.MAP, label: 'מפה אינטראקטיבית', icon: Map },
      { to: ROUTES.ACCIDENTS, label: 'ניתוח תאונות', icon: AlertTriangle, badge: '2.8K' },
      { to: ROUTES.TRANSIT, label: 'תחבורה ציבורית', icon: Bus },
      { to: ROUTES.INFRASTRUCTURE, label: 'תשתיות', icon: Building2 },
    ],
  },
  {
    title: 'ניהול נתונים',
    items: [
      { to: ROUTES.SOURCES, label: 'מקורות מידע', icon: Database },
      { to: ROUTES.HISTORY, label: 'היסטוריית עדכונים', icon: History },
      { to: ROUTES.EXPORT, label: 'ייצוא דוחות', icon: Download },
    ],
  },
];

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '2.4.1';

export function Sidebar(): JSX.Element {
  return (
    <aside className="flex flex-col overflow-y-auto border-s border-border bg-bg-2 px-3 pb-3.5 pt-4">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.title} className={cn(index > 0 && 'mt-5')}>
          <div className="px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[1.4px] text-text-faint max-[1280px]:hidden">
            {section.title}
          </div>
          {section.items.map((item) => (
            <SidebarItem key={item.to} entry={item} />
          ))}
        </div>
      ))}

      <div className="mt-auto border-t border-border pt-4 text-center text-[11px] leading-[1.6] text-text-faint">
        <span className="mb-1.5 inline-block rounded-full border border-border bg-brand-teal/10 px-1.5 py-0.5 font-mono text-[10px] text-brand-teal">
          v{APP_VERSION}
        </span>
        <div className="max-[1280px]:hidden">
          מהוד הנדסה בע״מ
          <br />© 2025
        </div>
      </div>
    </aside>
  );
}

interface SidebarItemProps {
  entry: NavEntry;
}

function SidebarItem({ entry }: SidebarItemProps): JSX.Element {
  const { to, label, icon: Icon, badge } = entry;
  return (
    <NavLink
      to={to}
      end={to === ROUTES.DASHBOARD}
      className={({ isActive }) =>
        cn(
          'group relative my-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] transition-colors',
          'max-[1280px]:justify-center max-[1280px]:px-1.5',
          isActive
            ? 'bg-brand-teal/10 font-medium text-brand-teal'
            : 'text-text-dim hover:bg-white/[0.04] hover:text-text'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute -end-3 top-1/2 h-[22px] w-[3px] -translate-y-1/2 rounded-s-none rounded-e-[3px] bg-brand-teal shadow-[0_0_8px_rgba(76,175,80,0.4)] max-[1280px]:-end-2"
            />
          )}
          <Icon size={16} className="shrink-0 opacity-85" />
          <span className="max-[1280px]:hidden">{label}</span>
          {badge && (
            <span
              className={cn(
                'ms-auto rounded border px-1.5 py-px font-mono text-[10px] max-[1280px]:hidden',
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
