/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Destination of every "Go to the App" CTA. See .env.example. */
  readonly VITE_APP_URL?: string;
  /** Base URL of the 4forces backend API. Empty = same origin. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
