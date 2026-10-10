import { Reveal, SectionLabel } from "@/components/ui/reveal";

const STEPS = [
  { k: "Environment", d: "Tides, rain, wind, heat and the ground the city stands on." },
  { k: "Signals", d: "Neighbors' photo, text and voice reports, a Pi street camera, and NOAA tide predictions." },
  { k: "Detection", d: "Gemma 4 reads each report: hazard type, severity, flood depth, whether cars can pass, confidence." },
  { k: "Alerts", d: "Three confident reports of the same hazard within 1 km and 60 minutes raise an alert." },
  { k: "Decisions", d: "Live map, app banner and a neighborhood speaker — in English, Spanish and Haitian Creole." },
];

export function SignalChain() {
  return (
    <section id="system" aria-labelledby="system-title" className="relative border-t hairline bg-abyss py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <SectionLabel>Environmental intelligence</SectionLabel>
            <h2 id="system-title" className="mt-5 text-balance text-4xl font-semibold leading-[1] tracking-[-0.04em] text-foam sm:text-5xl">
              The intelligence layer between{" "}
              nature and the city.
            </h2>
          </Reveal>
          <Reveal className="lg:col-span-6 lg:col-start-7 lg:pt-10" delay={120}>
            <p className="text-lg leading-relaxed text-mist">
              Water, wind, ground and heat all leave signals — a tide running high, a snapped branch, an intersection
              going under. 4forces gathers those signals, interprets them, and turns them into alerts people on the
              block can act on.
            </p>
          </Reveal>
        </div>

        <ol className="relative mt-16 grid gap-px overflow-hidden rounded-2xl border hairline bg-line md:grid-cols-5">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.k} delay={i * 90} className="relative bg-abyss p-6">
              <div className="flex items-center justify-end">
                <span aria-hidden="true" className="relative grid size-3 place-items-center">
                  <span className="absolute size-3 rounded-full bg-cyan/40 [animation:pulse-ring_3s_ease-out_infinite]" style={{ animationDelay: `${i * 0.6}s` }} />
                  <span className="size-1.5 rounded-full bg-cyan" />
                </span>
              </div>
              <h3 className="mt-10 text-xl font-medium tracking-[-0.02em] text-foam">{s.k}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{s.d}</p>
            </Reveal>
          ))}
          {/* travelling signal along the chain */}
          <span aria-hidden="true" className="pointer-events-none absolute left-0 top-0 hidden h-px w-full overflow-hidden md:block">
            <span className="block h-px w-1/4 bg-gradient-to-r from-transparent via-cyan to-transparent [animation:sweep_5s_linear_infinite]" />
          </span>
        </ol>
      </div>
    </section>
  );
}
