/**
 * Brand & semantic color tokens.
 * Mirrored in `tailwind.config.ts` — when changing here, sync the Tailwind config as well.
 */

export const BRAND_COLORS = {
  teal: '#4caf50',
  teal2: '#81c784',
  blue: '#1a6fb5',
  green: '#4caf50',
} as const;

export const STATUS_COLORS = {
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  purple: '#8b5cf6',
} as const;

export const SURFACE_COLORS = {
  bg0: '#07090f',
  bg1: '#0a0e1a',
  bg2: '#0d1117',
  surface: '#111827',
  surface2: '#161f31',
  border: '#1f2937',
  border2: '#2b3648',
} as const;

export const LAYER_COLORS = {
  transit: STATUS_COLORS.success,
  accidents: STATUS_COLORS.danger,
  roads: STATUS_COLORS.warning,
  infra: STATUS_COLORS.purple,
} as const;

export type LayerColorKey = keyof typeof LAYER_COLORS;
