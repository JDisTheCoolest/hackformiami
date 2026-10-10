/**
 * Single source of truth for links into the separate 4forces app (app/ folder).
 *
 * backend/main.py serves app/ at "/app", so "/app/" is correct whenever the website
 * and app share an origin (e.g. both behind the Pi's tunnel). For any other setup,
 * set VITE_APP_URL — see web/.env.example.
 */
const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim();

export const APP_URL = configuredAppUrl || "/app/";
export const APP_URL_CONFIGURED = Boolean(configuredAppUrl);

/** Base for read-only API calls. Empty string = same origin (dev uses the Vite proxy). */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").trim().replace(/\/$/, "");

/** NOAA CO-OPS station used by the backend's tide endpoint (backend/.env.example). */
export const TIDE_STATION = { id: "8723214", name: "Virginia Key, FL", lat: 25.7314, lng: -80.1618 };

export const MIAMI = { lat: 25.7617, lng: -80.1918, label: "Miami, Florida" };
