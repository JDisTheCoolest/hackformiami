import {
  AlertTriangle,
  Bell,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  Map as MapIcon,
  MapPin,
  Mic,
  Play,
  Plus,
  Share,
  ShieldCheck,
  Type,
  User,
  Waves,
} from "lucide-react";
import { useEffect, useState } from "react";
import { EyeMark } from "@/components/brand/EyeMark";
import { CityMap, type MapPoint } from "@/components/visuals/CityMap";
import { useLiveData } from "@/lib/live-data";
import { useReducedMotion } from "@/lib/hooks";
import { cn, formatTime, timeAgo } from "@/lib/utils";
import type { Alert, Lang, Tide } from "@/types";

/**
 * Website-side visual preview of the 4forces app (the real app lives in app/).
 * Uses live API data when reachable; otherwise clearly labeled sample values based on
 * the examples in backend/API.md.
 */
const SAMPLE_TIDE: Tide = {
  station: "Virginia Key, FL",
  next_high: { time: "2026-10-10T21:33:00-04:00", height_ft: 2.79 },
  upcoming: [],
  king_tide_window: true,
  risk: "elevated",
  alert: null,
  updated_at: "2026-10-10T11:30:00-04:00",
  stale: false,
};
const SAMPLE_ALERT: Alert = {
  id: "sample",
  type: "flood",
  level: "severe",
  count: 3,
  lat: 25.7655,
  lng: -80.1885,
  area: "Brickell Bay Dr",
  message: {
    en: "Flood alert: 3 neighbors reported flooding near Brickell Bay Dr. Avoid the area.",
    es: "Alerta de inundación: 3 vecinos reportaron inundación cerca de Brickell Bay Dr. Evite la zona.",
    ht: "Alèt inondasyon: 3 vwazen rapòte inondasyon toupre Brickell Bay Dr. Evite zòn nan.",
  },
  report_ids: [],
  created_at: new Date(Date.now() - 6 * 60000).toISOString(),
  test: false,
};
const SAMPLE_POINTS: MapPoint[] = [
  { lat: 25.7655, lng: -80.1885, severity: "severe", label: "Sample report — flood, severe" },
  { lat: 25.7638, lng: -80.1901, severity: "moderate", label: "Sample report — flood, moderate" },
  { lat: 25.7672, lng: -80.1868, severity: "severe", label: "Sample report — flood, severe" },
];

const riskTone = { low: "text-sev-none", elevated: "text-sev-moderate", high: "text-sev-severe" } as const;
const riskGlow = { low: "rgba(76,195,138,0.35)", elevated: "rgba(255,155,61,0.38)", high: "rgba(255,77,77,0.4)" } as const;
const hazardName = (t: string) =>
  t === "flood" ? "Flood" : t === "fire" ? "Fire" : t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-[7%] pt-[4.2%] text-[9.5px] font-semibold text-foam">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span className="flex items-end gap-[1.5px]">
          {[3, 4.5, 6, 7.5].map((h) => (
            <span key={h} className="w-[2px] rounded-[1px] bg-foam" style={{ height: h }} />
          ))}
        </span>
        <span className="ml-1 h-[7px] w-[14px] rounded-[2px] border border-foam/70 p-[1px]">
          <span className="block h-full w-3/4 rounded-[1px] bg-foam" />
        </span>
      </span>
    </div>
  );
}

function DataPill({ live }: { live: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-1.5 py-[2px] text-[7.5px] font-medium",
        live ? "bg-sev-none/15 text-sev-none" : "bg-sev-low/15 text-sev-low",
      )}
    >
      <span className={cn("size-1 rounded-full", live ? "bg-sev-none" : "bg-sev-low")} />
      {live ? "Live" : "Sample data"}
    </span>
  );
}

/** Smooth tide curve (illustrative shape) with "now" marked. */
function TideCurve({ tone }: { tone: string }) {
  const pts = Array.from({ length: 49 }, (_, i) => {
    const x = (i / 48) * 100;
    const y = 18 - Math.sin((i / 48) * Math.PI * 2.1 + 0.6) * 11;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="mt-1 h-9 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="tide-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={tone} stopOpacity="0.35" />
          <stop offset="1" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,34 ${pts} 100,34`} fill="url(#tide-fill)" />
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <line x1="38" x2="38" y1="2" y2="34" stroke="rgba(238,244,255,0.5)" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TabBar({ active }: { active: "home" | "map" | "alerts" | "me" }) {
  const item = (key: typeof active, I: typeof Home, label: string) => (
    <span className={cn("flex flex-col items-center gap-0.5 text-[7px]", active === key ? "text-foam" : "text-dim")}>
      <I className="size-3.5" />
      {label}
    </span>
  );
  return (
    <div className="flex shrink-0 items-end justify-around border-t border-foam/10 bg-abyss/80 px-2 pb-[7%] pt-2 backdrop-blur">
      {item("home", Home, "Home")}
      {item("map", MapIcon, "Map")}
      <span className="-mt-5 grid size-10 place-items-center rounded-full bg-cyan text-abyss shadow-[0_6px_20px_rgba(101,217,242,0.45)]">
        <Plus className="size-5" />
      </span>
      {item("alerts", Bell, "Alerts")}
      {item("me", User, "Me")}
    </div>
  );
}

export function OverviewScreen() {
  const { tide, latestAlert, reports } = useLiveData();
  // A failed/incomplete backend response must never blank the public landing page.
  const t = tide.status === "ok" && tide.data?.station ? tide.data : SAMPLE_TIDE;
  const liveAlert = latestAlert.status === "ok";
  const alert = liveAlert ? latestAlert.data : SAMPLE_ALERT;
  const live = tide.status === "ok" && Boolean(tide.data);
  const reportCount = reports.status === "ok" && reports.data ? reports.data.length : SAMPLE_POINTS.length;

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(120%_50%_at_50%_0%,#0d2a6b_0%,#06152f_45%,#030814_80%)]">
      <StatusBar />
      <div className="mt-[8%] flex items-center justify-between px-[6%]">
        <p className="flex items-baseline text-[15px] font-semibold tracking-[-0.045em] text-foam" aria-label="4forces">
          4f
          <EyeMark className="mx-[0.5px] h-[11px] w-[11px]" track={false} />
          rces
        </p>
        <span className="relative grid size-6 place-items-center rounded-full bg-foam/10">
          <Bell className="size-3 text-foam" />
          {alert && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-sev-severe" />}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-[6%]">
        <span className="flex items-center gap-0.5 text-[9px] text-mist">
          <MapPin className="size-2.5" /> Brickell, Miami <ChevronDown className="size-2.5" />
        </span>
        <DataPill live={live} />
      </div>

      {/* tide risk */}
      <div
        className="relative mx-[5%] mt-[4%] overflow-hidden rounded-[14px] border border-foam/10 p-2.5"
        style={{ background: `radial-gradient(90% 120% at 100% 0%, ${riskGlow[t.risk]}, rgba(10,20,45,0.85) 60%)` }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="flex items-center gap-1 text-[8px] text-mist">
              <Waves className="size-2.5" /> Tide risk · {t.station.replace(", FL", "")}
            </p>
            <p className={cn("mt-0.5 text-[20px] font-semibold capitalize leading-none tracking-[-0.03em]", riskTone[t.risk])}>{t.risk}</p>
          </div>
          {t.king_tide_window && <span className="rounded-full bg-foam/10 px-1.5 py-[2px] text-[7.5px] text-foam">King-tide window</span>}
        </div>
        <TideCurve tone={t.risk === "low" ? "#4cc38a" : t.risk === "high" ? "#ff4d4d" : "#ff9b3d"} />
        {t.next_high && (
          <p className="flex justify-between text-[8px] text-mist">
            <span>Now</span>
            <span>
              High {formatTime(t.next_high.time)} · <span className="text-foam">{t.next_high.height_ft.toFixed(2)} ft</span>
            </span>
          </p>
        )}
      </div>

      {/* map */}
      <div className="relative mx-[5%] mt-[3.5%] min-h-[22%] flex-1 overflow-hidden rounded-[14px] border border-foam/10">
        <CityMap compact sample={SAMPLE_POINTS} />
        <span className="absolute left-1.5 top-1.5 z-[600] rounded-full bg-abyss/85 px-1.5 py-[2px] text-[7.5px] font-medium text-foam backdrop-blur">
          {reportCount} reports · 24 h
        </span>
      </div>

      {/* active alert */}
      <div className="mx-[5%] mt-[3.5%] overflow-hidden rounded-[14px] border border-sev-severe/30 bg-[linear-gradient(90deg,rgba(255,77,77,0.16),rgba(255,77,77,0.04))]">
        {alert ? (
          <div className="flex items-center gap-2 p-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sev-severe/20">
              <AlertTriangle className="size-3.5 text-sev-severe" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] font-semibold text-foam">
                {hazardName(alert.type)} alert · {alert.area || "Nearby"}
              </span>
              <span className="block text-[8px] text-mist">
                {alert.count} neighbor reports · {timeAgo(alert.created_at)}
                {!liveAlert && " · sample"}
                {liveAlert && alert.test && " · test"}
              </span>
            </span>
            <span className="flex items-center gap-0.5 rounded-full bg-foam px-1.5 py-1 text-[7.5px] font-semibold text-abyss">
              <Play className="size-2 fill-current" /> Listen
            </span>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 p-2 text-[9px] text-mist">
            <ShieldCheck className="size-3 text-sev-none" /> No 4forces alerts near you.
          </p>
        )}
      </div>
      <div className="h-[3%] shrink-0" />
      <TabBar active="home" />
    </div>
  );
}

const LANGS: { k: Lang; label: string }[] = [
  { k: "en", label: "EN" },
  { k: "es", label: "ES" },
  { k: "ht", label: "HT" },
];

export function AlertScreen() {
  const { latestAlert } = useLiveData();
  const live = latestAlert.status === "ok" && latestAlert.data;
  const a = live || SAMPLE_ALERT;
  const reduced = useReducedMotion();
  const [lang, setLang] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setLang((l) => (l + 1) % LANGS.length), 2200);
    return () => window.clearInterval(t);
  }, [reduced]);

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(120%_45%_at_50%_0%,#5a1018_0%,#1a0810_45%,#030814_80%)]">
      <StatusBar />
      <div className="mt-[8%] flex items-center justify-between px-[5%] text-foam">
        <ChevronLeft className="size-4" />
        <span className="text-[10px] font-medium">Alert</span>
        <Share className="size-3.5" />
      </div>
      <div className="mx-[5%] mt-[5%]">
        <span className="inline-flex items-center gap-1 rounded-full bg-sev-severe px-1.5 py-[2px] text-[7.5px] font-semibold capitalize text-abyss">
          <AlertTriangle className="size-2.5" /> {a.level}
        </span>
        <p className="mt-1.5 text-[21px] font-semibold leading-[1.02] tracking-[-0.035em] text-foam">
          {hazardName(a.type)} near {a.area || "you"}
        </p>
        <p className="mt-1 text-[8.5px] text-mist">
          {a.count} confident reports within 1 km · {timeAgo(a.created_at)}
          {!live && " · sample"}
        </p>
      </div>

      <div className="mx-[5%] mt-[5%] rounded-[12px] border border-foam/10 bg-foam/[0.04] p-2">
        <div className="flex gap-1 rounded-full bg-abyss/60 p-0.5">
          {LANGS.map((l, i) => (
            <span
              key={l.k}
              className={cn(
                "flex-1 rounded-full py-[3px] text-center text-[8px] font-medium",
                i === lang ? "bg-foam text-abyss" : "text-mist",
              )}
            >
              {l.label}
            </span>
          ))}
        </div>
        <p className="mt-2 min-h-[44px] text-[9.5px] leading-snug text-foam">{a.message[LANGS[lang].k] ?? "—"}</p>
        <p className="flex items-center gap-1 text-[7.5px] text-dim">
          <Play className="size-2 fill-current" /> Also read aloud by neighborhood speakers
        </p>
      </div>

      {!live && (
        <div className="mx-[5%] mt-[4%]">
          <p className="text-[7.5px] text-dim">Reports behind this alert · sample</p>
          <div className="mt-1 divide-y divide-foam/10 rounded-[12px] border border-foam/10 bg-foam/[0.03]">
            {[
              { I: Camera, k: "Neighbor photo", t: "11:40", c: "91%" },
              { I: Mic, k: "Voice note", t: "11:43", c: "72%" },
              { I: Camera, k: "Street camera", t: "11:45", c: "88%" },
            ].map((r) => (
              <p key={r.t} className="flex items-center gap-1.5 px-2 py-1.5 text-[8.5px] text-foam">
                <r.I className="size-2.5 text-cyan" />
                {r.k}
                <span className="ml-auto text-dim">{r.t}</span>
                <span className="w-6 text-right font-semibold">{r.c}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mx-[5%] mt-[4%] space-y-1.5">
        {["Never walk or drive through flood water.", "Move to higher ground if water keeps rising."].map((tip) => (
          <p key={tip} className="flex items-start gap-1.5 text-[9px] leading-snug text-mist">
            <ShieldCheck className="mt-[1px] size-3 shrink-0 text-cyan" /> {tip}
          </p>
        ))}
      </div>

      <div className="mx-[5%] mb-[9%] mt-auto grid grid-cols-2 gap-1.5">
        <span className="rounded-[10px] bg-foam py-2 text-center text-[9.5px] font-semibold text-abyss">I&rsquo;m safe</span>
        <span className="rounded-[10px] border border-foam/20 py-2 text-center text-[9.5px] font-medium text-foam">Report</span>
      </div>
    </div>
  );
}

export function ReportScreen() {
  return (
    <div className="flex h-full flex-col bg-[#030814]">
      <StatusBar />
      <div className="mt-[8%] flex items-center justify-between px-[5%] text-foam">
        <span className="text-[9px] text-mist">Cancel</span>
        <span className="text-[10px] font-medium">New report</span>
        <DataPill live={false} />
      </div>

      {/* viewfinder with an AI scan */}
      <div className="relative mx-[5%] mt-[4%] h-[38%] overflow-hidden rounded-[14px]">
        <img src="/assets/images/flooded-residential-street.jpg" alt="" className="absolute inset-0 h-full w-full object-cover brightness-75" />
        <div className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent to-cyan/20 [animation:scan-sweep_3s_linear_infinite]">
          <div className="absolute inset-x-0 bottom-0 h-px bg-cyan shadow-[0_0_10px_rgba(101,217,242,0.8)]" />
        </div>
        <div className="absolute left-[34%] top-[40%] h-[42%] w-[30%] rounded-[4px] border-2 border-cyan">
          <span className="absolute -top-3.5 left-0 whitespace-nowrap rounded-[3px] bg-cyan px-1 text-[6.5px] font-medium text-abyss">
            Vehicle in water
          </span>
        </div>
        <span className="glass-capsule absolute bottom-1.5 left-1.5 right-1.5 rounded-full px-2 py-1 text-center text-[8px] text-foam">
          Flood · ~10 in deep · cars can&rsquo;t pass
        </span>
      </div>

      <div className="mx-[5%] mt-[3.5%] flex gap-1 rounded-full bg-foam/[0.06] p-0.5">
        {[
          { I: Camera, k: "Photo", on: true },
          { I: Mic, k: "Voice", on: false },
          { I: Type, k: "Text", on: false },
        ].map(({ I, k, on }) => (
          <span key={k} className={cn("flex flex-1 items-center justify-center gap-1 rounded-full py-1 text-[8.5px]", on ? "bg-foam text-abyss" : "text-mist")}>
            <I className="size-2.5" /> {k}
          </span>
        ))}
      </div>

      <div className="mx-[5%] mt-[3.5%] rounded-[12px] border border-foam/10 bg-foam/[0.04] p-2">
        <p className="flex items-center justify-between text-[7.5px] text-dim">
          <span>Gemma 4 reading</span>
          <span className="text-sev-low">sample</span>
        </p>
        <div className="mt-1 grid grid-cols-4 gap-1 text-center">
          {[
            { k: "Hazard", v: "Flood", c: "text-cyan" },
            { k: "Severity", v: "Severe", c: "text-sev-severe" },
            { k: "Depth", v: "~10 in", c: "text-foam" },
            { k: "Conf.", v: "90%", c: "text-foam" },
          ].map((m) => (
            <span key={m.k} className="rounded-[8px] bg-abyss/50 py-1">
              <span className="block text-[6.5px] text-dim">{m.k}</span>
              <span className={cn("block text-[9.5px] font-semibold", m.c)}>{m.v}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="mx-[6%] mt-[3%] flex items-center gap-1 text-[8.5px] text-mist">
        <MapPin className="size-2.5 text-cyan" /> Brickell Bay Dr · located by GPS
        <ChevronRight className="ml-auto size-2.5" />
      </p>
      <div className="mx-[5%] mb-[9%] mt-auto rounded-[12px] bg-cyan py-2 text-center text-[10px] font-semibold text-abyss shadow-[0_8px_24px_rgba(101,217,242,0.35)]">
        Send report
      </div>
    </div>
  );
}
