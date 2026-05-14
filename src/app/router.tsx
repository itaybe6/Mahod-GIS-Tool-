import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { MapPage } from '@/features/map/MapPage';
import { AccidentsPage } from '@/features/accidents/AccidentsPage';
import { TransitPage } from '@/features/transit/TransitPage';
import { InfrastructurePage } from '@/features/infrastructure/InfrastructurePage';
import { SourcesPage } from '@/features/sources/SourcesPage';
import { UpdateHistoryPage } from '@/features/history/UpdateHistoryPage';
import { ExportPage } from '@/features/export/ExportPage';

/**
 * Centralized route table.
 *
 * Every page is wrapped in <AppShell> so the chrome (sidebar / right panel)
 * stays mounted while only the main pane swaps content.
 */
export function AppRouter(): JSX.Element {
  return (
    <Routes>
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
        path={ROUTES.ACCIDENTS}
        element={
          <AppShell>
            <AccidentsPage />
          </AppShell>
        }
      />
      <Route
        path={ROUTES.TRANSIT}
        element={
          <AppShell>
            <TransitPage />
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
      <Route
        path={ROUTES.EXPORT}
        element={
          <AppShell>
            <ExportPage />
          </AppShell>
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
    </Routes>
  );
}
