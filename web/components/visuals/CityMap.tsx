import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { CARTO_KEY, TIDE_STATION } from "@/lib/config";
import { useLiveData } from "@/lib/live-data";
import { cn } from "@/lib/utils";
import type { Report, Severity } from "@/types";

export const SEVERITY_COLOR: Record<Severity, string> = {
  none: "#4cc38a",
  low: "#f2d14b",
  moderate: "#ff9b3d",
  severe: "#ff4d4d",
};

export interface MapPoint {
  lat: number;
  lng: number;
  severity: Severity | "analyzing";
  label: string;
}

const ANALYZING = "#7f8ca8";

function reportPoint(r: Report): MapPoint | null {
  if (r.status === "failed") return null;
  const a = r.analysis;
  return {
    lat: r.lat,
    lng: r.lng,
    severity: a ? a.severity : "analyzing",
    label: `${r.area || "Report"} — ${a ? `${a.type.replace(/_/g, " ")}, ${a.severity}${a.needs_confirmation ? " (unconfirmed)" : ""}` : "being analyzed"}`,
  };
}

const pinIcon = (color: string, size: number, pulse: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span class="ff-pin${pulse ? " ff-pin--pulse" : ""}" style="--c:${color};width:${size}px;height:${size}px"></span>`,
  });

const stationIcon = (label: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<span class="ff-station"></span>${label ? '<span class="ff-station-label">NOAA tide station · Virginia Key</span>' : ""}`,
  });

/** Basemap shared by every map on the site: CARTO Dark Matter with VITE_CARTO_KEY, else Esri's keyless dark gray. */
export function addBasemap(m: L.Map, labels = true) {
  if (CARTO_KEY) {
    // CARTO Dark Matter (needs a free key since 2026): base without labels + labels on top
    const carto = (style: string) =>
      `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}.png?key=${encodeURIComponent(CARTO_KEY)}`;
    L.tileLayer(carto("dark_nolabels"), {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(m);
    if (labels) L.tileLayer(carto("dark_only_labels"), { maxZoom: 18, pane: "shadowPane" }).addTo(m);
  } else {
    // Esri World Dark Gray Canvas: keyless raster basemap, attribution required
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxNativeZoom: 16,
      maxZoom: 18,
      attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
    }).addTo(m);
  }
}

/**
 * Real map of Miami (Leaflet; CARTO Dark Matter with VITE_CARTO_KEY, else Esri World Dark Gray Canvas), tinted to the brand.
 * Plots live neighbor reports from the API; `sample` points are only for the labeled app preview.
 */
export function CityMap({
  compact = false,
  sample,
  className,
}: {
  compact?: boolean;
  sample?: MapPoint[];
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const { reports } = useLiveData();

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      center: compact ? [25.765, -80.19] : [25.772, -80.185],
      zoom: compact ? 13 : 12,
      zoomControl: !compact,
      scrollWheelZoom: false,
      dragging: !compact,
      doubleClickZoom: !compact,
      touchZoom: !compact,
      keyboard: !compact,
      attributionControl: true,
    });
    m.attributionControl.setPrefix(false);
    addBasemap(m, !compact);
    L.marker([TIDE_STATION.lat, TIDE_STATION.lng], { icon: stationIcon(!compact), keyboard: false, interactive: false }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const live = reports.status === "ok" ? reports.data.map(reportPoint).filter((p): p is MapPoint => !!p) : [];
    const points = live.length ? live : (sample ?? []);
    points.forEach((p) => {
      const color = p.severity === "analyzing" ? ANALYZING : SEVERITY_COLOR[p.severity];
      L.marker([p.lat, p.lng], {
        icon: pinIcon(color, compact ? 12 : 16, p.severity === "severe"),
        title: p.label,
        alt: p.label,
        keyboard: !compact,
      }).addTo(g);
    });
  }, [reports, sample, compact]);

  return (
    <div className={cn("ff-map relative h-full w-full overflow-hidden", compact && "ff-map--compact", className)}>
      <div ref={el} className="absolute inset-0" />
      {/* slow scan sweep over the live map */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[500] overflow-hidden">
        <div className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent to-cyan/[0.07] [animation:scan-sweep_8s_linear_infinite]">
          <div className="absolute inset-x-0 bottom-0 h-px bg-cyan/40" />
        </div>
      </div>
    </div>
  );
}
