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
import { ProtectedRoute } from './ProtectedRoute';

/**
 * Centralized route table.
 *
 * Every page is wrapped in <AppShell> so the chrome (sidebar / right panel)
 * stays mounted while only the main pane swaps content.
 * All routes except /login are wrapped in <ProtectedRoute> which redirects
 * unauthenticated users to the login page.
 */
export function AppRouter(): JSX.Element {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route
        path={ROUTES.RECENT_FILES}
        element={
          <ProtectedRoute>
            <AppShell>
              <RecentFilesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.DASHBOARD}
        element={
          <ProtectedRoute>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.MAP}
        element={
          <ProtectedRoute>
            <AppShell>
              <MapPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.STATISTICS}
        element={
          <ProtectedRoute>
            <AppShell hideRightPanel>
              <StatisticsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path={ROUTES.ACCIDENTS} element={<Navigate to={ROUTES.STATISTICS} replace />} />
      <Route
        path={ROUTES.TRANSIT}
        element={
          <ProtectedRoute>
            <AppShell hideRightPanel>
              <TransitPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.ROUTE_PLANNER}
        element={
          <ProtectedRoute>
            <AppShell rightPanel={<RoutePlannerPanel />} showMobileRightPanel={false}>
              <RoutePlannerPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.INFRASTRUCTURE}
        element={
          <ProtectedRoute>
            <AppShell hideRightPanel>
              <InfrastructurePage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.SOURCES}
        element={
          <ProtectedRoute>
            <AppShell hideRightPanel>
              <SourcesPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path={ROUTES.HISTORY}
        element={
          <ProtectedRoute>
            <AppShell hideRightPanel>
              <UpdateHistoryPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="/export" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
    </Routes>
  );
}
