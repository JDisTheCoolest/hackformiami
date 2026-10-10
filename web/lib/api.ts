import { API_BASE } from "@/lib/config";
import type { Alert, Health, Report, Tide } from "@/types";

/** Read-only GET against the 4forces backend contract (backend/API.md). */
async function getJSON<T>(path: string, timeoutMs = 6000): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) throw new Error("not JSON");
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export const api = {
  health: () => getJSON<Health>("/api/health"),
  tide: () => getJSON<Tide>("/api/tide", 10000),
  latestAlert: () => getJSON<{ alert: Alert | null }>("/api/alerts/latest"),
  reports: (hours = 24) => getJSON<Report[]>(`/api/reports?hours=${hours}`),
};
