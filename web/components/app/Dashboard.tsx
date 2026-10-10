import { Activity, AlertTriangle, ArrowUpRight, Bot, Clock3, MapPin, Plus, RadioTower, ShieldCheck, Waves } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/app/AppShell";
import { CameraView } from "@/components/account/CameraView";
import { CityMap } from "@/components/visuals/CityMap";
import { useLiveData } from "@/lib/live-data";
import { formatTime, timeAgo } from "@/lib/utils";

const card = "rounded-2xl border hairline bg-[linear-gradient(145deg,rgba(10,31,69,.78),rgba(6,21,47,.58))] shadow-[0_22px_60px_-38px_rgba(40,104,255,.8)]";
const riskStyle = { low: "text-sev-none", elevated: "text-sev-moderate", high: "text-sev-severe" } as const;

export function Dashboard() {
  const { tide, latestAlert, reports, health, online } = useLiveData();
  const t = tide.status === "ok" ? tide.data : null;
  const alert = latestAlert.status === "ok" ? latestAlert.data : null;
  const items = reports.status === "ok" ? reports.data : [];
  const reportCount = items.length;
  const severeCount = items.filter((report) => report.analysis?.severity === "severe").length;

  return <AppShell>
    <section className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-medium uppercase tracking-[.18em] text-cyan">Four forces · one city</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, Miami.</h2><p className="mt-2 text-sm text-mist">Live local conditions and community-verified hazards around Brickell.</p></div>
      <Link to="/reports/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan px-4 text-sm font-semibold text-abyss shadow-[0_12px_30px_-12px_rgba(101,217,242,.8)]"><Plus className="size-4" /> New report</Link>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <article className={`${card} relative overflow-hidden p-5`}><div className="absolute -right-12 -top-12 size-36 rounded-full bg-cyan/10 blur-2xl" /><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-[.13em] text-mist">Tide risk</span><Waves className="size-5 text-cyan" /></div><p className={`mt-5 text-3xl font-semibold capitalize ${t ? riskStyle[t.risk] : "text-dim"}`}>{t?.risk ?? "Unknown"}</p><p className="mt-2 text-sm text-mist">{t?.next_high ? <>Next high {formatTime(t.next_high.time)} · <span className="text-foam">{t.next_high.height_ft.toFixed(2)} ft</span></> : "NOAA tide data unavailable"}</p><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-foam/10"><span className="block h-full w-[68%] rounded-full bg-gradient-to-r from-electric to-cyan" /></div></article>
      <article className={`${card} p-5`}><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-[.13em] text-mist">Local status</span><RadioTower className="size-5 text-sev-none" /></div><p className="mt-5 text-3xl font-semibold">{online ? "Monitoring" : "Offline"}</p><p className="mt-2 text-sm text-mist">{reportCount} community reports in the last 24 hours</p><div className="mt-5 flex gap-4 text-xs"><span className="text-sev-severe">{severeCount} severe</span><span className="text-dim">API {health.status === "ok" ? "connected" : "unavailable"}</span></div></article>
      <article className={`${card} border-sev-severe/20 p-5`}><div className="flex items-center justify-between"><span className="text-xs uppercase tracking-[.13em] text-mist">Active alerts</span><AlertTriangle className={`size-5 ${alert ? "text-sev-severe" : "text-sev-none"}`} /></div><p className="mt-5 text-3xl font-semibold">{alert ? "1 nearby" : "All clear"}</p><p className="mt-2 line-clamp-2 text-sm text-mist">{alert ? `${alert.type.replaceAll("_", " ")} · ${alert.area || "Miami"} · ${timeAgo(alert.created_at)}` : "No verified 4forces alerts near you."}</p><Link to="/alerts" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-cyan">View alerts <ArrowUpRight className="size-3" /></Link></article>
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <article id="map" className={`${card} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-3 border-b hairline px-5 py-4"><div><h3 className="font-semibold">Live force map</h3><p className="mt-1 text-xs text-dim">Community reports and NOAA station data</p></div><div className="flex items-center gap-3 text-[11px] text-mist"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-sev-severe" /> Severe</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-sev-moderate" /> Elevated</span></div></div><div className="h-[420px] sm:h-[500px] xl:h-[560px]"><CityMap /></div></article>
      <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <article className={`${card} p-5`}><div className="flex items-center justify-between"><h3 className="font-semibold">Recent reports</h3><Link to="/reports" className="text-xs text-cyan">View all</Link></div><div className="mt-4 space-y-1">{items.slice(0, 4).map((report) => <div key={report.id} className="flex gap-3 border-b hairline py-3 last:border-0"><span className={`mt-1 size-2.5 shrink-0 rounded-full ${report.analysis?.severity === "severe" ? "bg-sev-severe" : report.analysis?.severity === "moderate" ? "bg-sev-moderate" : "bg-cyan"}`} /><div className="min-w-0"><p className="truncate text-sm text-foam">{report.analysis?.type.replaceAll("_", " ") || "Report analyzing"}</p><p className="mt-1 truncate text-xs text-dim">{report.area || "Miami"} · {timeAgo(report.created_at)}</p></div></div>)}{!items.length && <p className="py-8 text-center text-sm text-dim">No recent reports available.</p>}</div></article>
        <article className={`${card} p-5`}><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-cyan" /><h3 className="font-semibold">Alert detail</h3></div>{alert ? <><p className="mt-4 text-lg font-semibold capitalize">{alert.type.replaceAll("_", " ")} · {alert.level}</p><p className="mt-2 text-sm leading-6 text-mist">{alert.message.en || `${alert.count} reports near ${alert.area}.`}</p></> : <p className="mt-4 text-sm leading-6 text-mist">No active neighborhood alert. The network continues to monitor new reports.</p>}</article>
      </aside>
    </section>

    <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article className={`${card} p-5`}><div className="flex items-center gap-2"><Activity className="size-5 text-fire" /><h3 className="font-semibold">Community pulse</h3></div><p className="mt-4 text-3xl font-semibold">{reportCount}</p><p className="mt-1 text-sm text-mist">reports received across the live 24-hour window</p><Link to="/reports/new" className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-cyan">Add local context <ArrowUpRight className="size-3" /></Link></article>
      <article className={`${card} p-5`}><div className="flex items-center gap-2"><Clock3 className="size-5 text-cyan" /><h3 className="font-semibold">Virginia Key NOAA</h3></div><p className="mt-4 text-lg font-semibold">{t?.station ?? "Station unavailable"}</p><p className="mt-2 text-sm text-mist">{t?.updated_at ? `Updated ${timeAgo(t.updated_at)}` : "Waiting for official tide observations"}</p><p className="mt-4 text-xs text-dim">{t?.king_tide_window ? "King-tide window is active." : "No king-tide window reported."}</p></article>
      <article className={`${card} p-5 md:col-span-2 xl:col-span-1`}><div className="flex items-center gap-2"><Bot className="size-5 text-ember" /><h3 className="font-semibold">Hazard insight</h3></div><p className="mt-4 text-sm leading-6 text-mist">{severeCount ? `${severeCount} severe report${severeCount === 1 ? "" : "s"} need attention. Confirm conditions before entering affected streets.` : "No severe community reports detected. Keep location and notifications enabled for timely warnings."}</p><div className="mt-5 flex items-center gap-2 text-xs text-dim"><MapPin className="size-3.5" /> Based on the current Miami report window</div></article>
    </section>
    <CameraView />
  </AppShell>;
}
