/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  /** Mapbox GL (client-side); restrict by URL in Mapbox account settings. */
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  /** Optional `mapbox://styles/...` override; defaults to Mapbox Streets v12. */
  readonly VITE_MAPBOX_STYLE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
