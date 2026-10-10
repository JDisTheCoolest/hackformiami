/**
 * Types mirroring the public, read-only parts of the backend contract (backend/API.md).
 * The website never writes to the backend — reports are created in the app.
 */

export type ForceId = "water" | "air" | "land" | "fire";

export type HazardType =
  | "flood"
  | "fire"
  | "downed_power_line"
  | "downed_tree"
  | "storm_damage"
  | "other"
  | "none";

export type Severity = "none" | "low" | "moderate" | "severe";

export type Lang = "en" | "es" | "ht";
export type Localized = Partial<Record<Lang, string>>;

export interface ReportAnalysis {
  is_disaster: boolean;
  type: HazardType;
  severity: Severity;
  depth_in?: number | null;
  car_passable?: boolean | null;
  hazards?: string[];
  confidence: number;
  model?: string;
  needs_confirmation: boolean;
  reasoning?: string;
  summary?: Localized;
}

export interface Report {
  id: string;
  lat: number;
  lng: number;
  area: string;
  text: string;
  photo_url: string | null;
  created_at: string;
  mock: boolean;
  /** "analyzing" right after upload, "done" once Gemma answered, "failed" after all retries. */
  status?: "analyzing" | "done" | "failed";
  /** null unless status is "done" */
  analysis: ReportAnalysis | null;
}

export interface Alert {
  id: string;
  type: HazardType;
  level: Severity;
  count: number;
  lat: number;
  lng: number;
  area: string;
  message: Localized;
  report_ids: string[];
  created_at: string;
  test: boolean;
}

export interface TidePoint {
  time: string;
  height_ft: number;
  type?: "H" | "L";
}

export interface Tide {
  station: string;
  next_high: TidePoint | null;
  upcoming: TidePoint[];
  king_tide_window: boolean;
  risk: "low" | "elevated" | "high";
  alert: Localized | null;
  updated_at: string;
  stale: boolean;
}

export interface Health {
  ok: boolean;
  mock: boolean;
  model: string;
  alert_threshold?: number;
  alert_radius_m?: number;
  alert_window_min?: number;
}

/** Where a piece of information on the page comes from. Shown next to the data. */
export type Provenance = "live" | "official" | "sample" | "illustrative" | "planned";

export type Loadable<T> =
  | { status: "loading" }
  | { status: "ok"; data: T; fetchedAt: Date }
  | { status: "unavailable"; reason: string };
