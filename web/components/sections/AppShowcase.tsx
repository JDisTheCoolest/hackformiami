import { useEffect, useRef, useState } from "react";
import { AlertScreen, OverviewScreen, ReportScreen } from "@/components/mobile/PhoneScreens";
import { AppLink } from "@/components/ui/app-link";
import { PhoneFrame } from "@/components/ui/iphone-16-pro";
import { ProvenanceTag } from "@/components/ui/live-status";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const SCREENS = [
  { key: "overview", label: "Overview", text: "Tide risk, the live report map and active alerts for your part of Miami.", C: OverviewScreen },
  { key: "alert", label: "Alert", text: "When neighbors' reports cluster, an alert goes out in English, Spanish and Haitian Creole.", C: AlertScreen },
  { key: "report", label: "Report", text: "Send a photo, a sentence or a voice note. AI estimates hazard, depth and whether cars can pass.", C: ReportScreen },
];

export function AppShowcase() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (paused || reduced || !inView) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % SCREENS.length), 5200);
    return () => window.clearInterval(t);
  }, [paused, reduced, inView]);

  return (
    <section id="app" aria-labelledby="app-title" className="relative overflow-hidden border-t hairline bg-[linear-gradient(180deg,#030814_0%,#06152f_100%)] py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1440px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
        <Reveal className="lg:col-span-5">
          <SectionLabel>The app</SectionLabel>
          <h2 id="app-title" className="mt-5 text-balance text-4xl font-semibold leading-[1] tracking-[-0.04em] text-foam sm:text-6xl">
            Your block, in your pocket.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-mist">
            The 4forces app is where neighbors report, where the live map runs, and where our prototype alert hardware
            is tested end to end. Works in the browser — add it to your home screen.
          </p>

          <div role="tablist" aria-label="App screens" className="mt-8 space-y-1">
            {SCREENS.map((s, n) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={n === i}
                aria-controls="phone-preview"
                onClick={() => {
                  setI(n);
                  setPaused(true);
                }}
                className={cn(
                  "relative block w-full overflow-hidden rounded-xl border px-5 py-4 text-left transition-colors",
                  n === i ? "border-foam/20 bg-foam/[0.05]" : "border-transparent hover:bg-foam/[0.03]",
                )}
              >
                <span className={cn("font-medium", n === i ? "text-foam" : "text-mist")}>{s.label}</span>
                {n === i && <span className="mt-1 block text-sm text-mist">{s.text}</span>}
                {n === i && !paused && !reduced && (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px origin-left bg-cyan [animation:progress_5.2s_linear_both]" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <AppLink context="to try the app" />
            <ProvenanceTag kind="sample">Preview uses sample data unless the API is live</ProvenanceTag>
          </div>
        </Reveal>

        <div ref={ref} className="relative flex justify-center lg:col-span-7" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
          <div aria-hidden="true" className="absolute top-1/2 left-1/2 size-[36rem] max-w-[120vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(40,104,255,0.28),transparent_65%)]" />
          {/* contour rings behind the device */}
          <svg aria-hidden="true" viewBox="0 0 400 400" className="absolute top-1/2 left-1/2 w-[38rem] max-w-[130vw] -translate-x-1/2 -translate-y-1/2 opacity-60">
            {[60, 90, 120, 150, 180].map((r) => (
              <ellipse key={r} cx="200" cy="200" rx={r} ry={r * 0.82} fill="none" stroke="rgba(101,217,242,0.12)" />
            ))}
          </svg>
          <Reveal>
            <PhoneFrame
              label={`4forces app preview: ${SCREENS[i].label} screen`}
              className="w-[min(78vw,330px)] drop-shadow-[0_40px_80px_rgba(0,0,0,0.6)]"
            >
              <div id="phone-preview" className="relative h-full">
                {SCREENS.map((s, n) => (
                  <div
                    key={s.key}
                    aria-hidden={n !== i}
                    className={cn(
                      "absolute inset-0 transition-[opacity,transform] duration-700 ease-[var(--ease-out-expo)]",
                      n === i ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0",
                    )}
                  >
                    <s.C />
                  </div>
                ))}
              </div>
            </PhoneFrame>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
