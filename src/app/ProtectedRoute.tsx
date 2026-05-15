import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/constants/routes';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Redirects users who are neither logged in nor in guest mode to the login page,
 * preserving the attempted path so LoginPage can redirect back after auth.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps): JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const location = useLocation();

  if (!isAuthenticated && !isGuest) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
