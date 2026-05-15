import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { MapPage } from '@/features/map/MapPage';
import { StatisticsPage } from '@/features/statistics/StatisticsPage';
import { TransitPage } from '@/features/transit/TransitPage';
import { RoutePlannerPage } from '@/features/route-planner/RoutePlannerPage';
import { RoutePlannerPanel } from '@/features/route-planner/components/RoutePlannerPanel';
import { InfrastructurePage } from '@/features/infrastructure/InfrastructurePage';
import { SourcesPage } from '@/features/sources/SourcesPage';
import { UpdateHistoryPage } from '@/features/history/UpdateHistoryPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RecentFilesPage } from '@/features/recent-files/RecentFilesPage';

/**
 * Centralized route table.
 *
 * Every page is wrapped in <AppShell> so the chrome (sidebar / right panel)
 * stays mounted while only the main pane swaps content.
 */
export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route
        path={ROUTES.RECENT_FILES}
        element={
          <AppShell>
            <RecentFilesPage />
          </AppShell>
        }
      />
      <Route
        path={ROUTES.DASHBOARD}
        element={
          <AppShell>
            <DashboardPage />
          </AppShell>
        }
      />
      <Route
        path={ROUTES.MAP}
        element={
          <AppShell>
            <MapPage />
          </AppShell>
        }
      />
      <Route
        path={ROUTES.STATISTICS}
        element={
          <AppShell>
            <StatisticsPage />
          </AppShell>
        }
      />
      <Route path={ROUTES.ACCIDENTS} element={<Navigate to={ROUTES.STATISTICS} replace />} />
      <Route
        path={ROUTES.TRANSIT}
        element={
          <AppShell>
            <TransitPage />
          </AppShell>
        }
      />
      <Route
        path={ROUTES.ROUTE_PLANNER}
        element={
          <AppShell rightPanel={<RoutePlannerPanel />} showMobileRightPanel={false}>
            <RoutePlannerPage />
          </AppShell>
        }
      />
      <Route
        path={ROUTES.INFRASTRUCTURE}
        element={
          <AppShell>
            <InfrastructurePage />
          </AppShell>
        }
      />
      <Route
        path={ROUTES.SOURCES}
        element={
          <AppShell>
            <SourcesPage />
          </AppShell>
        }
      />
      <Route
        path={ROUTES.HISTORY}
        element={
          <AppShell>
            <UpdateHistoryPage />
          </AppShell>
        }
      />
      <Route path="/export" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    </Routes>
  );
}
