/** Same-origin protected app route used by every landing-page CTA. */
export const APP_URL = "/app/";

/** Base for read-only API calls. Empty string = same origin (dev uses the Vite proxy). */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").trim().replace(/\/$/, "");

/** NOAA CO-OPS station used by the backend's tide endpoint. */
export const TIDE_STATION = { id: "8723214", name: "Virginia Key, FL", lat: 25.7314, lng: -80.1918 };

export const MIAMI = { lat: 25.7617, lng: -80.1918, label: "Miami, Florida" };

/** CARTO basemaps key (public by design; restrict usage in CARTO if possible). */
export const CARTO_KEY = (import.meta.env.VITE_CARTO_KEY ?? "").trim();
