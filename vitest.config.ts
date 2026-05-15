import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/app/**',
        'src/features/**',
        'src/components/**',
        'src/styles/**',
        // external integrations — network / DB / native APIs
        'src/lib/leaflet/**',
        'src/lib/supabase/**',
        'src/lib/gis/**',
        'src/lib/gtfs/**',
        'src/lib/mapbox/**',
        'src/lib/export/fetchExportBlob.ts',
        'src/lib/export/apiBaseUrl.ts',
        // hooks that require full React DOM environment
        'src/hooks/useShapefileUpload.ts',
        'src/hooks/useAreaAnalysis.ts',
        'src/hooks/useDebounce.ts',
        'src/hooks/useLocalStorage.ts',
        'src/hooks/useMediaQuery.ts',
        // DB query modules
        'src/statistics/queries.ts',
        'src/types/**',
      ],
    },
  },
});
