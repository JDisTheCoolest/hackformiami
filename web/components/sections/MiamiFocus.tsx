import { CityMap, SEVERITY_COLOR } from "@/components/visuals/CityMap";
import { ProvenanceTag } from "@/components/ui/live-status";
import { NewsVideo } from "@/components/ui/news-video";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { useLiveData } from "@/lib/live-data";
import { cn, formatTime } from "@/lib/utils";

const PHOTOS = [
  {
    src: "/assets/images/miami-storm-skyline.jpg",
    alt: "Palm trees bending in strong wind in front of the downtown Miami skyline under a dark storm sky.",
    force: "Air",
    tone: "text-air",
    caption: "Wind and storms arrive over the bay before they reach the street.",
    credit: "Photo: Getty Images",
    span: "sm:col-span-2 sm:row-span-2",
    pos: "object-[50%_40%]",
  },
  {
    src: "/assets/images/flooded-residential-street.jpg",
    alt: "Aerial view of a car driving through a flooded residential street lined with palm trees.",
    force: "Water",
    tone: "text-cyan",
    caption: "Tidal and rain flooding turn residential streets into channels.",
    pos: "object-[50%_60%]",
  },
  {
    src: "/assets/images/flood-submerged-car.jpg",
    alt: "A red car partly submerged in floodwater in a parking area, with a police car behind it.",
    force: "Water",
    tone: "text-cyan",
    caption: "Water is often deeper than it looks. Never drive through flood water.",
    pos: "object-[60%_60%]",
  },
  {
    src: "/assets/images/miami-urban-street.jpg",
    alt: "A busy downtown Miami street with pedestrians, police motorcycles and a fire truck in the distance.",
    force: "Land",
    tone: "text-land",
    caption: "Streets, crowds and infrastructure are what a hazard actually reaches.",
    span: "sm:col-span-2",
    pos: "object-[50%_45%]",
  },
  {
    src: "/assets/images/wildfire-night.jpg",
    alt: "A wildfire burning through trees on a hillside at night under a glowing smoke plume, with a power line in the foreground.",
    force: "Fire",
    tone: "text-fire",
    caption: "Dry brush, wind and power lines are how a spark becomes a fire front.",
    pos: "object-[55%_60%]",
  },
];

export function MiamiFocus() {
  const { reports, tide, online } = useLiveData();
  const reportCount = reports.status === "ok" ? reports.data.length : null;

  return (
    <section id="miami" aria-labelledby="miami-title" className="relative border-t hairline bg-abyss py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <Reveal className="max-w-3xl">
          <SectionLabel>Miami in focus</SectionLabel>
          <h2 id="miami-title" className="mt-5 text-balance text-4xl font-semibold leading-[1] tracking-[-0.04em] text-foam sm:text-6xl">
            One city, surrounded by water.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-mist">
            Miami sits a few feet above sea level between Biscayne Bay and the Atlantic. Tides, rain, wind and heat
            meet the same streets — which is why we start here.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <figure className="overflow-hidden rounded-2xl border hairline bg-[#05122a]">
              <div className="relative aspect-[6/7]">
                <CityMap />
              </div>
              <figcaption className="space-y-3 border-t hairline p-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <ProvenanceTag kind="illustrative">Basemap: Esri · OpenStreetMap</ProvenanceTag>
                  <ProvenanceTag kind="official">NOAA tide station 8723214</ProvenanceTag>
                </div>
                {online && reportCount !== null ? (
                  <p className="flex flex-wrap items-center gap-2 text-mist">
                    <ProvenanceTag kind="live" />
                    {reportCount === 0
                      ? "No neighbor reports in the last 24 hours."
                      : `${reportCount} neighbor report${reportCount === 1 ? "" : "s"} in the last 24 hours, colored by severity.`}
                  </p>
                ) : (
                  <p className="text-dim">
                    Live reports appear here when the 4forces API is reachable. No markers are shown without real data.
                  </p>
                )}
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mist" aria-label="Severity colors">
                  {(Object.keys(SEVERITY_COLOR) as (keyof typeof SEVERITY_COLOR)[]).map((k) => (
                    <li key={k} className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: SEVERITY_COLOR[k] }} />
                      {k}
                    </li>
                  ))}
                </ul>
                {tide.status === "ok" && (
                  <p className="text-mist">
                    Tide at {tide.data.station}: risk <strong className="text-foam">{tide.data.risk}</strong>
                    {tide.data.next_high && (
                      <>
                        , next high {formatTime(tide.data.next_high.time)} ({tide.data.next_high.height_ft.toFixed(2)} ft)
                      </>
                    )}
                    {tide.data.king_tide_window && " · king-tide window"}. Source: NOAA CO-OPS via 4forces API.
                  </p>
                )}
              </figcaption>
            </figure>
          </Reveal>

          <div className="grid auto-rows-[minmax(13rem,1fr)] gap-4 sm:grid-cols-3 lg:col-span-7">
            {PHOTOS.map((p, i) => (
              <Reveal as="figure" key={p.src} delay={i * 80} className={cn("group relative overflow-hidden rounded-2xl border hairline", p.span)}>
                <img
                  src={p.src}
                  alt={p.alt}
                  loading="lazy"
                  decoding="async"
                  className={cn("absolute inset-0 h-full w-full object-cover saturate-[0.85] transition-transform duration-[1.6s] ease-[var(--ease-out-expo)] group-hover:scale-[1.04]", p.pos)}
                />
                <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,8,20,0)_40%,rgba(3,8,20,0.9)_100%)]" />
                <figcaption className="absolute inset-x-0 bottom-0 p-4">
                  <span className={cn("label-sm", p.tone)}>{p.force}</span>
                  <p className="mt-1 text-sm leading-snug text-foam">{p.caption}</p>
                  {p.credit && <p className="mt-1 text-[0.6875rem] text-dim">{p.credit}</p>}
                </figcaption>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className="mt-20">
          <h3 className="text-2xl font-semibold tracking-[-0.03em] text-foam">It has already happened here</h3>
          <p className="mt-2 max-w-xl text-mist">Real Miami events, as local and national news reported them.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <NewsVideo id="ZkEntEavR70" title="Flooding impacts residents across Miami-Dade and Broward" source="WPLG Local 10" />
            <NewsVideo id="UMFSvQ1XtKM" title="Miami skyline slammed by 100 mph winds" source="CNN" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
