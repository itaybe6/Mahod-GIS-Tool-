/**
 * Centralized route paths.
 * Use these constants instead of hard-coding strings in <Link>, navigate(), etc.
 */

export const ROUTES = {
  DASHBOARD: '/',
  MAP: '/map',
  ACCIDENTS: '/accidents',
  TRANSIT: '/transit',
  INFRASTRUCTURE: '/infrastructure',
  SOURCES: '/sources',
  HISTORY: '/history',
  EXPORT: '/export',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
