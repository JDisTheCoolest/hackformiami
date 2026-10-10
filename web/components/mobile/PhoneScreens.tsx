import { Camera, ChevronDown, Mic, Type } from "lucide-react";
import { EyeMark } from "@/components/brand/EyeMark";
import { MiamiMap, SEVERITY_COLOR } from "@/components/visuals/MiamiMap";
import { useLiveData } from "@/lib/live-data";
import { cn, formatTime, timeAgo } from "@/lib/utils";
import type { Alert, Tide } from "@/types";

/**
 * Website-side visual preview of the 4forces app UI (the real app lives in app/).
 * Uses live API data when reachable; otherwise clearly labeled sample values taken from
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
    en: "Flood alert: 3 neighbors reported flooding near Brickell Bay Dr.",
    es: "Alerta de inundación: 3 vecinos reportaron inundación cerca de Brickell Bay Dr.",
    ht: "Alèt inondasyon: 3 vwazen rapòte inondasyon toupre Brickell Bay Dr.",
  },
  report_ids: [],
  created_at: new Date(Date.now() - 6 * 60000).toISOString(),
  test: false,
};

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-[7%] pt-[4.2%] text-[9px] font-semibold text-foam">
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

function Header({ sample }: { sample: boolean }) {
  return (
    <div className="mt-[9%] flex items-center justify-between px-[6%]">
      <div>
        <p className="flex items-baseline text-[15px] font-semibold tracking-[-0.045em] text-foam" aria-label="4forces">
          4f
          <EyeMark className="mx-[0.5px] h-[11px] w-[11px]" track={false} />
          rces
        </p>
        <p className="mt-0.5 flex items-center gap-0.5 text-[9px] text-mist">
          Miami, Florida <ChevronDown className="size-2.5" />
        </p>
      </div>
      <span
        className={cn(
          "rounded-[4px] border px-1.5 py-0.5 text-[8px] font-medium",
          sample ? "border-sev-low/40 text-sev-low" : "border-sev-none/40 text-sev-none",
        )}
      >
        {sample ? "Sample data" : "Live"}
      </span>
    </div>
  );
}

const riskTone = { low: "text-sev-none", elevated: "text-sev-moderate", high: "text-sev-severe" } as const;

export function OverviewScreen() {
  const { tide, latestAlert } = useLiveData();
  const liveTide = tide.status === "ok" ? tide.data : null;
  const t = liveTide ?? SAMPLE_TIDE;
  const liveAlert = latestAlert.status === "ok";
  const alert = liveAlert ? latestAlert.data : SAMPLE_ALERT;
  const sample = !liveTide;

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#0a1f45_0%,#030814_55%)]">
      <StatusBar />
      <Header sample={sample} />
      <div className="mx-[5%] mt-[5%] rounded-[10px] border border-cyan/20 bg-cyan/[0.06] p-2">
        <p className="text-[8px] font-medium text-cyan">Tide · {t.station}</p>
        <p className="mt-0.5 text-[11px] font-medium leading-tight text-foam">
          Risk <span className={riskTone[t.risk]}>{t.risk}</span>
          {t.king_tide_window && <span className="text-mist"> · king-tide window</span>}
        </p>
        {t.next_high && (
          <p className="text-[9px] text-mist">
            Next high {formatTime(t.next_high.time)} · {t.next_high.height_ft.toFixed(2)} ft
          </p>
        )}
      </div>
      <div className="relative mx-[5%] mt-[4%] h-[34%] overflow-hidden rounded-[10px] border hairline">
        <MiamiMap compact scan={false} sample={sample ? [{ lat: 25.7655, lng: -80.1885, severity: "severe" }, { lat: 25.7642, lng: -80.19, severity: "moderate" }, { lat: 25.767, lng: -80.187, severity: "severe" }] : undefined} />
        <span className="absolute left-1.5 top-1.5 rounded-[4px] bg-abyss/80 px-1 text-[7.5px] font-medium text-mist">Reports · 24 h</span>
      </div>
      <div className="mx-[5%] mt-[4%] grid grid-cols-3 gap-1.5">
        {[
          { k: "Tide risk", v: t.risk[0].toUpperCase() + t.risk.slice(1), tone: riskTone[t.risk] },
          { k: "Rain chance", v: "Not connected", tone: "text-dim" },
          { k: "Wind", v: "Planned", tone: "text-dim" },
        ].map((c) => (
          <div key={c.k} className="rounded-[8px] border hairline bg-foam/[0.03] p-1.5">
            <p className="text-[7.5px] font-medium text-dim">{c.k}</p>
            <p className={cn("mt-0.5 text-[10px] font-medium", c.tone)}>{c.v}</p>
          </div>
        ))}
      </div>
      <p className="mx-[6%] mt-[4%] text-[8px] font-medium text-dim">Active alerts</p>
      <div className="mx-[5%] mt-1 rounded-[10px] border border-sev-severe/30 bg-sev-severe/[0.08] p-2">
        {alert ? (
          <>
            <p className="flex items-center gap-1 text-[10px] font-semibold text-foam">
              <span className="size-1.5 rounded-full" style={{ background: SEVERITY_COLOR[alert.level] }} />
              {alert.type === "flood" ? "Flood" : alert.type.replace(/_/g, " ")} · {alert.area || "Nearby"}
            </p>
            <p className="mt-0.5 text-[8.5px] leading-snug text-mist">
              {alert.count} neighbor reports · {timeAgo(alert.created_at)}
              {!liveAlert && " · sample"}
              {liveAlert && alert.test && " · test alert"}
            </p>
          </>
        ) : (
          <p className="text-[9px] text-mist">No 4forces alerts right now.</p>
        )}
      </div>
    </div>
  );
}

export function AlertScreen() {
  const { latestAlert } = useLiveData();
  const live = latestAlert.status === "ok" && latestAlert.data;
  const a = live || SAMPLE_ALERT;
  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#3a0d12_0%,#14060c_40%,#030814_80%)]">
      <StatusBar />
      <Header sample={!live} />
      <div className="mx-[5%] mt-[8%]">
        <p className="text-[8px] font-medium text-sev-severe">{a.level} · {a.type.replace(/_/g, " ")}</p>
        <p className="mt-1 text-[19px] font-semibold leading-[1.05] tracking-[-0.03em] text-foam">
          {a.type === "flood" ? "Flooding" : a.type === "fire" ? "Fire" : a.type.replace(/_/g, " ")} near {a.area || "you"}
        </p>
        <p className="mt-1 text-[9px] text-mist">
          {a.count} confident neighbor reports within 1 km · {timeAgo(a.created_at)}
        </p>
      </div>
      <div className="mx-[5%] mt-[6%] space-y-1.5">
        {(["en", "es", "ht"] as const).map((l) => (
          <div key={l} className="rounded-[8px] border hairline bg-foam/[0.04] p-1.5">
            <p className="text-[7.5px] font-medium text-dim">{l === "en" ? "English" : l === "es" ? "Español" : "Kreyòl"}</p>
            <p className="mt-0.5 text-[8.5px] leading-snug text-foam">{a.message[l] ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="mx-[5%] mt-auto mb-[9%] rounded-[10px] bg-foam p-2 text-center text-[9.5px] font-semibold text-abyss">
        Never walk or drive through flood water.
      </div>
    </div>
  );
}

export function ReportScreen() {
  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#06152f_0%,#030814_70%)]">
      <StatusBar />
      <Header sample />
      <div className="mx-[5%] mt-[8%]">
        <p className="text-[17px] font-semibold leading-tight tracking-[-0.03em] text-foam">Report what you see</p>
        <p className="mt-1 text-[9px] text-mist">Photo, text or voice — or all three.</p>
      </div>
      <div className="mx-[5%] mt-[5%] grid grid-cols-3 gap-1.5">
        {[
          { I: Camera, k: "Photo" },
          { I: Type, k: "Text" },
          { I: Mic, k: "Voice" },
        ].map(({ I, k }) => (
          <div key={k} className="flex flex-col items-center gap-1 rounded-[10px] border hairline bg-foam/[0.04] py-2.5">
            <I className="size-3.5 text-cyan" />
            <span className="text-[8.5px] text-foam">{k}</span>
          </div>
        ))}
      </div>
      <div className="mx-[5%] mt-[5%] overflow-hidden rounded-[10px] border hairline">
        <img src="/assets/images/flooded-residential-street.jpg" alt="" className="h-[72px] w-full object-cover" />
        <div className="space-y-1 p-2">
          <p className="text-[7.5px] font-medium text-cyan">AI reading · sample</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8.5px]">
            <span className="text-dim">Hazard</span>
            <span className="text-foam">Flood</span>
            <span className="text-dim">Depth</span>
            <span className="text-foam">~10 in</span>
            <span className="text-dim">Cars can pass</span>
            <span className="text-sev-severe">No</span>
            <span className="text-dim">Confidence</span>
            <span className="text-foam">0.90</span>
          </div>
        </div>
      </div>
      <div className="mx-[5%] mt-auto mb-[9%] rounded-[10px] bg-cyan p-2 text-center text-[9.5px] font-semibold text-abyss">Send report</div>
    </div>
  );
}
