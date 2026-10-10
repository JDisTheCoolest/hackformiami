import { useId } from "react";
import { TIDE_STATION } from "@/lib/config";
import { useLiveData } from "@/lib/live-data";
import { cn } from "@/lib/utils";
import type { Report, Severity } from "@/types";

/**
 * Simplified, illustrative map of central Miami drawn from approximate real coordinates
 * (equirectangular projection — fine at city scale). Not a navigational map.
 * Live reports from GET /api/reports are plotted only when the backend answers.
 */
const BOUNDS = { north: 25.87, south: 25.66, west: -80.31, east: -80.11 };
const VB = { w: 600, h: 700 };

export const project = (lat: number, lng: number) => ({
  x: ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * VB.w,
  y: ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * VB.h,
});

const path = (pts: [number, number][], close = true) =>
  pts.map(([lat, lng], i) => {
    const p = project(lat, lng);
    return `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ") + (close ? " Z" : "");

const MAINLAND: [number, number][] = [
  [25.87, -80.31], [25.87, -80.183], [25.85, -80.18], [25.835, -80.183], [25.82, -80.186], [25.805, -80.188],
  [25.79, -80.187], [25.78, -80.186], [25.77, -80.187], [25.76, -80.19], [25.75, -80.198], [25.74, -80.212],
  [25.73, -80.226], [25.72, -80.238], [25.705, -80.25], [25.69, -80.262], [25.675, -80.275], [25.66, -80.29], [25.66, -80.31],
];
const MIAMI_BEACH: [number, number][] = [
  [25.87, -80.135], [25.87, -80.119], [25.85, -80.119], [25.83, -80.12], [25.81, -80.123], [25.79, -80.127],
  [25.775, -80.129], [25.768, -80.132], [25.768, -80.139], [25.78, -80.143], [25.8, -80.145], [25.82, -80.142],
  [25.84, -80.14], [25.86, -80.137],
];
const VIRGINIA_KEY: [number, number][] = [
  [25.758, -80.155], [25.752, -80.143], [25.738, -80.147], [25.728, -80.155], [25.725, -80.168], [25.735, -80.172], [25.748, -80.165],
];
const KEY_BISCAYNE: [number, number][] = [
  [25.712, -80.16], [25.705, -80.15], [25.69, -80.152], [25.672, -80.155], [25.665, -80.162], [25.675, -80.17], [25.692, -80.17], [25.705, -80.168],
];
const CAUSEWAYS: [number, number][][] = [
  [[25.848, -80.183], [25.848, -80.136]],
  [[25.808, -80.188], [25.812, -80.143]],
  [[25.79, -80.187], [25.79, -80.144]],
  [[25.785, -80.186], [25.776, -80.141]],
  [[25.752, -80.2], [25.745, -80.165], [25.728, -80.162], [25.71, -80.16]],
];
const PLACES: { name: string; lat: number; lng: number; anchor?: "start" | "end" }[] = [
  { name: "Little Haiti", lat: 25.83, lng: -80.194, anchor: "end" },
  { name: "Wynwood", lat: 25.8005, lng: -80.199, anchor: "end" },
  { name: "Downtown", lat: 25.7743, lng: -80.1937, anchor: "end" },
  { name: "Little Havana", lat: 25.7656, lng: -80.2194, anchor: "end" },
  { name: "Brickell", lat: 25.7617, lng: -80.1918, anchor: "end" },
  { name: "Coconut Grove", lat: 25.728, lng: -80.243, anchor: "end" },
  { name: "Miami Beach", lat: 25.835, lng: -80.141, anchor: "end" },
  { name: "Key Biscayne", lat: 25.6936, lng: -80.1626, anchor: "start" },
];

export const SEVERITY_COLOR: Record<Severity, string> = {
  none: "#4cc38a",
  low: "#f2d14b",
  moderate: "#ff9b3d",
  severe: "#ff4d4d",
};

function inBounds(r: Report) {
  if (r.status === "failed") return false;
  return r.lat <= BOUNDS.north && r.lat >= BOUNDS.south && r.lng >= BOUNDS.west && r.lng <= BOUNDS.east;
}

export function MiamiMap({
  className,
  compact = false,
  scan = true,
  sample,
}: {
  className?: string;
  compact?: boolean;
  scan?: boolean;
  /** Explicitly labeled sample points (used only inside the app preview). */
  sample?: { lat: number; lng: number; severity: Severity }[];
}) {
  const uid = useId().replace(/:/g, "");
  const { reports } = useLiveData();
  const live = reports.status === "ok" ? reports.data.filter(inBounds) : [];
  const station = project(TIDE_STATION.lat, TIDE_STATION.lng);

  return (
    <svg
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      preserveAspectRatio={compact ? "xMidYMid slice" : "xMidYMid meet"}
      className={cn("h-full w-full", className)}
      role="img"
      aria-label={`Simplified map of central Miami and Biscayne Bay${live.length ? ` with ${live.length} live neighbor reports` : ""}, and the NOAA tide station at Virginia Key.`}
    >
      <defs>
        <pattern id={`grid-${uid}`} width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M30 0H0V30" fill="none" stroke="rgba(169,184,211,0.07)" strokeWidth="1" />
        </pattern>
        <linearGradient id={`scan-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#65d9f2" stopOpacity="0" />
          <stop offset="1" stopColor="#65d9f2" stopOpacity="0.28" />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <rect width={VB.w} height={VB.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${uid})`}>
        <rect width={VB.w} height={VB.h} fill="#05122a" />
        {/* bathymetry-like contour rings in the bay and ocean */}
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={path([[25.87, -80.17 + i * 0.012], [25.79, -80.165 + i * 0.01], [25.74, -80.18 + i * 0.008], [25.66, -80.23 + i * 0.012]], false)}
            fill="none"
            stroke="rgba(101,217,242,0.08)"
            strokeWidth="1"
          />
        ))}
        {[0, 1, 2].map((i) => (
          <path
            key={`o${i}`}
            d={path([[25.87, -80.112 + i * 0.006], [25.77, -80.12 + i * 0.006], [25.7, -80.14 + i * 0.008], [25.66, -80.145 + i * 0.008]], false)}
            fill="none"
            stroke="rgba(101,217,242,0.07)"
          />
        ))}
        <g fill="#0b1a33" stroke="rgba(169,184,211,0.35)" strokeWidth="1.2">
          <path d={path(MAINLAND)} />
          <path d={path(MIAMI_BEACH)} />
          <path d={path(VIRGINIA_KEY)} />
          <path d={path(KEY_BISCAYNE)} />
        </g>
        <rect width={VB.w} height={VB.h} fill={`url(#grid-${uid})`} pointerEvents="none" />
        <g fill="none" stroke="rgba(196,184,155,0.35)" strokeWidth="1.4" strokeDasharray="1 3">
          {CAUSEWAYS.map((c, i) => (
            <path key={i} d={path(c, false)} />
          ))}
        </g>

        {!compact && (
          <g fontFamily="Inter Tight Variable, sans-serif" fontSize="13" fontWeight="500" fill="rgba(169,184,211,0.8)">
            {PLACES.map((p) => {
              const q = project(p.lat, p.lng);
              return (
                <g key={p.name}>
                  <circle cx={q.x} cy={q.y} r="2" fill="rgba(238,244,255,0.6)" />
                  <text x={q.x + (p.anchor === "end" ? -8 : 8)} y={q.y + 4} textAnchor={p.anchor ?? "start"}>
                    {p.name}
                  </text>
                </g>
              );
            })}
            <text x="24" y={VB.h - 24} fill="rgba(169,184,211,0.4)">Biscayne Bay</text>
          </g>
        )}

        {/* NOAA tide station — real location */}
        <g>
          <circle cx={station.x} cy={station.y} r="14" fill="none" stroke="#65d9f2" strokeOpacity="0.5">
            <animate attributeName="r" values="6;22;6" dur="4s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="4s" repeatCount="indefinite" />
          </circle>
          <rect x={station.x - 5} y={station.y - 5} width="10" height="10" fill="#65d9f2" transform={`rotate(45 ${station.x} ${station.y})`} />
          {!compact && (
            <text x={station.x + 14} y={station.y + 4} fontFamily="Inter Tight Variable, sans-serif" fontSize="13" fontWeight="500" fill="#65d9f2">
              NOAA {TIDE_STATION.id}
            </text>
          )}
        </g>

        {/* live neighbor reports */}
        {live.map((r) => {
          const q = project(r.lat, r.lng);
          const a = r.analysis;
          // analysis is null while Gemma is still working (status "analyzing") — show a gray pin
          const c = a ? (SEVERITY_COLOR[a.severity] ?? SEVERITY_COLOR.low) : "#7f8ca8";
          const label = a
            ? `${a.type}, ${a.severity}${a.needs_confirmation ? " (unconfirmed)" : ""}`
            : "being analyzed";
          return (
            <g key={r.id}>
              <circle cx={q.x} cy={q.y} r="10" fill={c} fillOpacity="0.18" />
              <circle cx={q.x} cy={q.y} r="4.5" fill={c} stroke="#030814" strokeWidth="1.5" strokeDasharray={!a || a.needs_confirmation ? "2 2" : undefined}>
                <title>{`${r.area || "Report"} — ${label}`}</title>
              </circle>
            </g>
          );
        })}

        {sample?.map((r, i) => {
          const q = project(r.lat, r.lng);
          return (
            <circle key={`s${i}`} cx={q.x} cy={q.y} r="9" fill={SEVERITY_COLOR[r.severity]} fillOpacity="0.85" stroke="#030814" strokeWidth="3" />
          );
        })}

        {scan && (
          <rect width={VB.w} height="160" fill={`url(#scan-${uid})`} className="[animation:scan-map_7s_var(--ease-in-out-quint)_infinite]" style={{ transformBox: "view-box" }} />
        )}
      </g>
    </svg>
  );
}
