import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { AlertTriangle, Camera, Mic, Pause, Play, RotateCcw, Type, User, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { addBasemap, SEVERITY_COLOR } from "@/components/visuals/CityMap";
import { AppLink } from "@/components/ui/app-link";
import { ProvenanceTag } from "@/components/ui/live-status";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Severity } from "@/types";

/* ── A simulated king-tide evening (clearly labeled on screen) ───────────────────────── */

type Source = "photo" | "voice" | "camera" | "text";
interface SimEvent {
  t: number; // minute 0–60
  lat: number;
  lng: number;
  zone: Zone;
  sev: Severity;
  src: Source;
  text: string;
  you?: boolean;
}
type Zone = "brickell" | "westave" | "shorecrest";

const ZONES: Record<Zone, { name: string; center: [number, number]; start: number; max: number; alertAt: number }> = {
  brickell: { name: "Brickell Bay Dr", center: [25.7652, -80.1888], start: 4, max: 1100, alertAt: 18 },
  westave: { name: "West Ave, Miami Beach", center: [25.7905, -80.1425], start: 9, max: 900, alertAt: 34 },
  shorecrest: { name: "Shorecrest · NE 79th St", center: [25.8472, -80.183], start: 20, max: 1200, alertAt: 53 },
};

const EVENTS: SimEvent[] = [
  { t: 6, lat: 25.7662, lng: -80.1882, zone: "brickell", sev: "moderate", src: "photo", text: "Water over the curb" },
  { t: 11, lat: 25.7898, lng: -80.1431, zone: "westave", sev: "moderate", src: "photo", text: "Puddles joining up at 10th St" },
  { t: 14, lat: 25.7641, lng: -80.1897, zone: "brickell", sev: "severe", src: "voice", text: "Car stalled near SE 8th St" },
  { t: 17, lat: 25.7655, lng: -80.1874, zone: "brickell", sev: "severe", src: "camera", text: "Street camera: road covered" },
  { t: 23, lat: 25.8466, lng: -80.1842, zone: "shorecrest", sev: "moderate", src: "photo", text: "Drains backing up on NE 79th St" },
  { t: 27, lat: 25.7915, lng: -80.1418, zone: "westave", sev: "severe", src: "voice", text: "Water at doorsteps" },
  { t: 30, lat: 25.7618, lng: -80.1921, zone: "brickell", sev: "severe", src: "photo", text: "Underpass flooding", you: true },
  { t: 33, lat: 25.7894, lng: -80.1438, zone: "westave", sev: "severe", src: "camera", text: "Street camera: lanes covered" },
  { t: 38, lat: 25.8481, lng: -80.1821, zone: "shorecrest", sev: "moderate", src: "voice", text: "Tide coming up through the grates" },
  { t: 44, lat: 25.8459, lng: -80.1836, zone: "shorecrest", sev: "severe", src: "photo", text: "Cars turning back" },
  { t: 47, lat: 25.7667, lng: -80.1902, zone: "brickell", sev: "low", src: "text", text: "Starting to drain on S Miami Ave" },
  { t: 52, lat: 25.8476, lng: -80.1812, zone: "shorecrest", sev: "severe", src: "camera", text: "Street camera: standing water" },
];

const SRC_ICON = { photo: Camera, voice: Mic, camera: Camera, text: Type } as const;
const SRC_LABEL = { photo: "Neighbor photo", voice: "Voice note", camera: "Pi camera", text: "Text" } as const;
const DURATION_S = 26; // a simulated hour plays in 26 seconds

const clock = (m: number) => {
  const total = 19 * 60 + Math.floor(m); // 7:00 PM start
  const h = Math.floor(total / 60) % 12 || 12;
  return `${h}:${String(total % 60).padStart(2, "0")} PM`;
};
const zoneRadius = (z: Zone, m: number) => {
  const { start, max } = ZONES[z];
  if (m < start) return 0;
  const grow = Math.min(1, (m - start) / 26);
  const recede = m > 48 && z === "brickell" ? Math.max(0.55, 1 - (m - 48) / 20) : 1;
  return max * (1 - Math.pow(1 - grow, 2)) * recede;
};

const eventIcon = (e: SimEvent) =>
  L.divIcon({
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: e.you
      ? '<span class="ff-you"><span class="ff-pin ff-pin--pulse" style="--c:#eef4ff;width:16px;height:16px"></span><span class="ff-you-label">You</span></span>'
      : `<span class="ff-pin" style="--c:${SEVERITY_COLOR[e.sev]};width:14px;height:14px"></span>`,
  });
const alertIcon = (name: string) =>
  L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<span class="ff-alert"><span class="ff-alert-ring"></span><span class="ff-alert-label">Flood alert · ${name}</span></span>`,
  });

function ReplayMap({ minute }: { minute: number }) {
  const el = useRef<HTMLDivElement>(null);
  const refs = useRef<{
    zones: Record<Zone, L.Circle[]>;
    pins: L.Marker[];
    alerts: Record<Zone, L.Marker>;
  } | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, {
      center: [25.8, -80.165],
      zoom: 12,
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: true,
    });
    m.attributionControl.setPrefix(false);
    addBasemap(m, true);
    const zones = {} as Record<Zone, L.Circle[]>;
    const alerts = {} as Record<Zone, L.Marker>;
    (Object.keys(ZONES) as Zone[]).forEach((z) => {
      const c = ZONES[z].center;
      // stacked translucent discs read as a soft spreading flood
      zones[z] = [0, 1, 2].map((i) =>
        L.circle(c, { radius: 0, stroke: i === 0, color: "#65d9f2", weight: 1, opacity: 0.5, dashArray: "3 5", fillColor: "#65d9f2", fillOpacity: 0.1 + i * 0.09, interactive: false }).addTo(m),
      );
      alerts[z] = L.marker(c, { icon: alertIcon(ZONES[z].name), opacity: 0, interactive: false, keyboard: false }).addTo(m);
    });
    const pins = EVENTS.map((e) =>
      L.marker([e.lat, e.lng], { icon: eventIcon(e), opacity: 0, title: `${SRC_LABEL[e.src]} — ${e.text}`, keyboard: false }).addTo(m),
    );
    refs.current = { zones, pins, alerts };
    return () => {
      m.remove();
      refs.current = null;
    };
  }, []);

  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    (Object.keys(ZONES) as Zone[]).forEach((z) => {
      const rad = zoneRadius(z, minute);
      r.zones[z].forEach((c, i) => c.setRadius(rad * [1, 0.7, 0.4][i]));
      r.alerts[z].setOpacity(minute >= ZONES[z].alertAt ? 1 : 0);
    });
    EVENTS.forEach((e, i) => r.pins[i].setOpacity(minute >= e.t ? 1 : 0));
  }, [minute]);

  return <div ref={el} className="absolute inset-0" />;
}

export function LiveCity() {
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap);
  const [minute, setMinute] = useState(reduced ? 60 : 0);
  const [playing, setPlaying] = useState(!reduced);
  const mRef = useRef(minute);
  mRef.current = minute;

  useEffect(() => {
    if (!playing || !inView) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let restart = 0;
    const tick = (now: number) => {
      acc += ((now - last) / 1000) * (60 / DURATION_S);
      last = now;
      if (acc >= 0.25 && mRef.current < 60) {
        const next = mRef.current + acc;
        acc = 0;
        if (next >= 60) {
          setMinute(60);
          // hold on the full picture, then replay
          restart = window.setTimeout(() => setMinute(0), 2500);
        } else setMinute(next);
      } else if (mRef.current >= 60) acc = 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(restart);
    };
  }, [playing, inView]);

  const shown = useMemo(() => EVENTS.filter((e) => e.t <= minute), [minute]);
  const alerts = (Object.keys(ZONES) as Zone[]).filter((z) => minute >= ZONES[z].alertAt);
  const feed = useMemo(() => {
    const items: { t: number; key: string; alert?: Zone; e?: SimEvent }[] = [
      ...shown.map((e) => ({ t: e.t, key: `e${e.t}`, e })),
      ...alerts.map((z) => ({ t: ZONES[z].alertAt, key: `a${z}`, alert: z })),
    ];
    return items.sort((a, b) => b.t - a.t).slice(0, 5);
  }, [shown, alerts]);
  const people = shown.filter((e) => e.src !== "camera").length;
  const youIn = minute >= 30;

  return (
    <section id="live" aria-labelledby="live-title" className="relative border-t hairline bg-abyss py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-7">
            <SectionLabel>Your city, in motion</SectionLabel>
            <h2 id="live-title" className="mt-5 text-balance text-4xl font-semibold leading-[1] tracking-[-0.04em] text-foam sm:text-6xl">
              Watch the water move. <span className="text-cyan">You move the map.</span>
            </h2>
          </Reveal>
          <Reveal className="lg:col-span-5" delay={100}>
            <p className="text-lg leading-relaxed text-mist">
              Every report pins down where the water is. Play an hour of a king-tide evening: flooding spreads, neighbors
              and street cameras report, and alerts form where reports agree. Your report is one of them.
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-12" delay={150}>
          <div ref={wrap} className="ff-map relative aspect-[4/5] overflow-hidden rounded-3xl border hairline sm:aspect-[16/10] lg:aspect-[16/8]">
            <ReplayMap minute={minute} />

            {/* clock */}
            <div className="glass-capsule absolute left-3 top-3 z-[700] flex items-center gap-3 rounded-2xl px-4 py-2.5 sm:left-5 sm:top-5">
              <Waves className="size-5 text-cyan" />
              <div className="leading-tight">
                <p className="text-xl font-semibold tabular-nums tracking-[-0.02em] text-foam">{clock(minute)}</p>
                <p className="text-xs text-mist">King tide {minute < 45 ? "rising" : "at its peak"}</p>
              </div>
            </div>
            <div className="absolute right-3 top-3 z-[700] sm:right-5 sm:top-5">
              <ProvenanceTag kind="illustrative" className="bg-abyss/70 backdrop-blur">Simulated replay</ProvenanceTag>
            </div>

            {/* event feed (desktop) */}
            <ol className="absolute right-5 top-16 z-[700] hidden w-80 space-y-2 lg:block" aria-label="Replay events">
              {feed.map((f) => (
                <li
                  key={f.key}
                  className={cn(
                    "glass-capsule flex items-center gap-3 rounded-2xl px-3 py-2 [animation:cloud-in_500ms_var(--ease-out-expo)_both]",
                    f.alert && "bg-[linear-gradient(90deg,rgba(255,77,77,0.28),rgba(8,12,26,0.7))]",
                    f.e?.you && "ring-1 ring-foam/60",
                  )}
                >
                  {f.alert ? (
                    <AlertTriangle className="size-4 shrink-0 text-sev-severe" />
                  ) : f.e?.you ? (
                    <User className="size-4 shrink-0 text-foam" />
                  ) : (
                    (() => {
                      const I = SRC_ICON[f.e!.src];
                      return <I className="size-4 shrink-0" style={{ color: SEVERITY_COLOR[f.e!.sev] }} />;
                    })()
                  )}
                  <span className="min-w-0 flex-1 text-sm leading-tight">
                    <span className="block truncate text-foam">
                      {f.alert ? `Flood alert · ${ZONES[f.alert].name}` : f.e!.you ? `You: ${f.e!.text}` : f.e!.text}
                    </span>
                    <span className="block truncate text-xs text-mist">
                      {f.alert ? "3 confident reports within 1 km" : `${SRC_LABEL[f.e!.src]} · ${ZONES[f.e!.zone].name}`}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-dim">{clock(f.t)}</span>
                </li>
              ))}
            </ol>

            {/* controls + counters */}
            <div className="glass-capsule absolute inset-x-3 bottom-3 z-[700] flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl p-2 pr-4 sm:inset-x-5 sm:bottom-5">
              <button
                type="button"
                onClick={() => {
                  if (minute >= 60) setMinute(0);
                  setPlaying((p) => !p);
                }}
                aria-label={playing ? "Pause replay" : "Play replay"}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-foam text-abyss transition-transform active:scale-95"
              >
                {playing ? <Pause className="size-4" /> : minute >= 60 ? <RotateCcw className="size-4" /> : <Play className="ml-0.5 size-4" />}
              </button>
              <label className="flex min-w-[10rem] flex-1 items-center gap-3">
                <span className="sr-only">Replay time</span>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={0.5}
                  value={minute}
                  onChange={(e) => {
                    setPlaying(false);
                    setMinute(Number(e.target.value));
                  }}
                  className="ff-range w-full"
                  style={{ ["--p" as string]: `${(minute / 60) * 100}%` }}
                />
              </label>
              <dl className="flex gap-4 text-sm">
                {[
                  { k: "Reports", v: shown.length },
                  { k: "Neighbors", v: people },
                  { k: "Alerts", v: alerts.length, c: alerts.length ? "text-sev-severe" : "text-foam" },
                ].map((s) => (
                  <div key={s.k} className="text-center leading-tight">
                    <dd className={cn("text-lg font-semibold tabular-nums", s.c ?? "text-foam")}>{s.v}</dd>
                    <dt className="text-[11px] text-dim">{s.k}</dt>
                  </div>
                ))}
              </dl>
            </div>

            {/* "you" moment */}
            <div
              className={cn(
                "glass-capsule absolute left-1/2 top-1/2 z-[700] -translate-x-1/2 rounded-full px-4 py-2 text-sm text-foam transition-[opacity,transform] duration-500",
                youIn && minute < 36 ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
              )}
            >
              Your photo just joined 3 others near the underpass.
            </div>
          </div>
        </Reveal>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-dim">
            A simulated scenario at real Miami tidal-flooding hot spots. It is not a forecast. Live reports appear on the
            map above in &ldquo;Miami in focus&rdquo; and in the app.
          </p>
          <AppLink context="to add your report to the live map">Add your report</AppLink>
        </div>
      </div>
    </section>
  );
}
