/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_SUPABASE_URL: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  /** Base URL of the 4forces backend API. Empty = same origin. */
  readonly VITE_API_BASE?: string;
  /** Optional CARTO basemaps key (Dark Matter tiles). Without it the map uses Esri's keyless dark basemap. */
  readonly VITE_CARTO_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
