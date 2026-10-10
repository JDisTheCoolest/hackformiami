import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Alert, Health, Loadable, Report, Tide } from "@/types";

export interface LiveData {
  health: Loadable<Health>;
  tide: Loadable<Tide>;
  latestAlert: Loadable<Alert | null>;
  reports: Loadable<Report[]>;
  /** true when the backend answered /api/health */
  online: boolean;
}

const initial: LiveData = {
  health: { status: "loading" },
  tide: { status: "loading" },
  latestAlert: { status: "loading" },
  reports: { status: "loading" },
  online: false,
};

const LiveDataContext = createContext<LiveData>(initial);

const unavailable = (e: unknown) => ({
  status: "unavailable" as const,
  reason: e instanceof Error ? e.message : "unavailable",
});

/**
 * Polls the backend's read-only endpoints. If the backend is unreachable (e.g. the
 * website is opened on its own), every consumer falls back to labeled sample/illustrative states.
 */
export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LiveData>(initial);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const set = (patch: Partial<LiveData>) => !cancelled && setData((d) => ({ ...d, ...patch }));

    const poll = (fn: () => Promise<void>, everyMs: number) => {
      void fn();
      timers.push(window.setInterval(() => void fn(), everyMs));
    };

    (async () => {
      try {
        const h = await api.health();
        set({ health: { status: "ok", data: h, fetchedAt: new Date() }, online: true });
      } catch (e) {
        const u = unavailable(e);
        set({ health: u, tide: u, latestAlert: u, reports: u, online: false });
        return;
      }
      poll(async () => {
        try {
          set({ tide: { status: "ok", data: await api.tide(), fetchedAt: new Date() } });
        } catch (e) {
          set({ tide: unavailable(e) });
        }
      }, 10 * 60_000);
      poll(async () => {
        try {
          const r = await api.latestAlert();
          set({ latestAlert: { status: "ok", data: r.alert, fetchedAt: new Date() } });
        } catch (e) {
          set({ latestAlert: unavailable(e) });
        }
      }, 15_000);
      poll(async () => {
        try {
          set({ reports: { status: "ok", data: await api.reports(24), fetchedAt: new Date() } });
        } catch (e) {
          set({ reports: unavailable(e) });
        }
      }, 30_000);
    })();

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearInterval(t));
    };
  }, []);

  return <LiveDataContext.Provider value={data}>{children}</LiveDataContext.Provider>;
}

export const useLiveData = () => useContext(LiveDataContext);
