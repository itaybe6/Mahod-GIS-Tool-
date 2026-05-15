/**
 * Centralized route paths.
 * Use these constants instead of hard-coding strings in <Link>, navigate(), etc.
 */

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  MAP: '/map',
  STATISTICS: '/statistics',
  ACCIDENTS: '/accidents',
  TRANSIT: '/transit',
  ROUTE_PLANNER: '/route-planner',
  INFRASTRUCTURE: '/infrastructure',
  SOURCES: '/sources',
  HISTORY: '/history',
  RECENT_FILES: '/recent-files',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
