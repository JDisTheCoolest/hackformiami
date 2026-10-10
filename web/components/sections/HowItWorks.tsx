import { Camera, Cctv, Mic, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const STEPS = [
  { k: "Observe", d: "A neighbor sees water over the curb, a downed line, smoke. Tide predictions show when the bay runs high." },
  { k: "Collect", d: "They send a photo, a sentence or a voice note from the app, pinned to their location. A Pi street camera sends a photo of its block every minute the same way." },
  { k: "Interpret", d: "Gemma 4 classifies the hazard and severity, estimates flood depth from reference objects like tires, and scores its confidence. Low-confidence reads are marked unconfirmed." },
  { k: "Alert", d: "When three moderate or severe reports of the same hazard, each with at least 50% confidence, land within 1 km and 60 minutes, 4forces raises one alert for that area." },
  { k: "Respond", d: "The alert appears on the map and in the app, and neighborhood speakers sound a siren and read it aloud in English, Spanish and Haitian Creole." },
];

const RULE_REPORTS = [
  { time: "11:40", source: "Neighbor · photo", dist: "0.2 km", sev: "Severe", conf: 91, img: "/assets/images/flooded-residential-street.jpg", pos: "50% 60%", Icon: Camera },
  { time: "11:43", source: "Neighbor · voice note", dist: "0.5 km", sev: "Moderate", conf: 72, img: null, pos: "", Icon: Mic },
  { time: "11:45", source: "Pi street camera", dist: "0.4 km", sev: "Severe", conf: 88, img: "/assets/images/flood-submerged-car.jpg", pos: "55% 60%", Icon: Cctv },
];

/** Animated walk-through of the backend's alert rule: reports arrive, the rule fills, an alert goes out. */
function RuleDemo() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [step, setStep] = useState(reduced ? 4 : 0);

  useEffect(() => {
    if (reduced) return setStep(4);
    if (!inView) return;
    const t = window.setTimeout(() => setStep((s) => (s >= 4 ? 0 : s + 1)), step === 4 ? 4200 : step === 0 ? 700 : 1300);
    return () => window.clearTimeout(t);
  }, [step, inView, reduced]);

  const count = Math.min(step, 3);
  return (
    <div ref={ref} className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-sm text-mist">The alert rule</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-foam">3 confident reports · 1 km · 60 min</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-3xl font-semibold tabular-nums tracking-[-0.04em] text-foam">
            {count}
            <span className="text-dim">/3</span>
          </span>
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1 overflow-hidden rounded-full bg-foam/10">
            <span
              className={cn("block h-full rounded-full transition-transform duration-700 ease-[var(--ease-out-expo)] origin-left", count > i ? "scale-x-100" : "scale-x-0", step === 4 ? "bg-sev-severe" : "bg-sev-moderate")}
            />
          </span>
        ))}
      </div>

      <ol className="mt-5 space-y-2.5">
        {RULE_REPORTS.map((r, i) => (
          <li
            key={r.time}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-foam/10 bg-foam/[0.04] p-2.5 transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)]",
              count > i ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            )}
          >
            <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-trench">
              {r.img ? <img src={r.img} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: r.pos }} /> : null}
              <span className={cn("relative grid size-6 place-items-center rounded-full", r.img ? "bg-abyss/70" : "bg-cyan/15")}>
                <r.Icon className="size-3.5 text-cyan" />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-foam">
                Flood · {r.sev}
                <span className="size-1.5 rounded-full" style={{ background: r.sev === "Severe" ? "#ff4d4d" : "#ff9b3d" }} />
              </span>
              <span className="block truncate text-xs text-mist">
                {r.source} · {r.dist} away
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-xs tabular-nums text-dim">{r.time}</span>
              <span className="block text-sm font-semibold tabular-nums text-foam">{r.conf}%</span>
            </span>
          </li>
        ))}
      </ol>

      <div
        className={cn(
          "glass-capsule mt-auto flex items-center gap-3 rounded-2xl p-3 transition-[opacity,transform] duration-700 ease-[var(--ease-out-expo)]",
          step === 4 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
        style={{ background: "linear-gradient(90deg, rgba(255,77,77,0.22), rgba(8,12,26,0.7))" }}
      >
        <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-sev-severe/25">
          {step === 4 && <span className="absolute inset-0 rounded-full bg-sev-severe/30 [animation:pulse-ring_2s_ease-out_infinite]" />}
          <Volume2 className="relative size-5 text-sev-severe" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foam">Flood alert sent · Brickell Bay Dr</span>
          <span className="block text-xs text-mist">Map, app and neighborhood speakers</span>
        </span>
        <span className="hidden gap-1 sm:flex">
          {["EN", "ES", "HT"].map((l) => (
            <span key={l} className="rounded-md bg-foam/10 px-1.5 py-0.5 text-[11px] font-medium text-foam">
              {l}
            </span>
          ))}
        </span>
      </div>
      <p className="mt-3 text-xs text-dim">Example sequence. Real alerts come from real reports.</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="relative border-t hairline bg-deep/30 py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
        <div className="lg:col-span-6">
          <Reveal>
            <SectionLabel>How detection works</SectionLabel>
            <h2 id="how-title" className="mt-5 text-balance text-4xl font-semibold leading-[1] tracking-[-0.04em] text-foam sm:text-6xl">
              From one photo to a neighborhood alert.
            </h2>
          </Reveal>
          <ol className="mt-12 border-t hairline">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.k} delay={i * 70} className="grid gap-2 border-b hairline py-6 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <h3 className="text-xl font-medium tracking-[-0.02em] text-foam">{s.k}</h3>
                <p className="leading-relaxed text-mist">{s.d}</p>
              </Reveal>
            ))}
          </ol>
          <p className="mt-6 text-sm text-dim">
            Thresholds are configurable in the backend. 4forces alerts come from neighbors and AI, not from official agencies.
          </p>
        </div>
        <Reveal className="lg:col-span-5 lg:col-start-8" delay={150}>
          <div className="sticky top-24 min-h-[34rem] overflow-hidden rounded-2xl border hairline bg-[radial-gradient(80%_60%_at_100%_100%,rgba(255,77,77,0.12),transparent_60%),#030814]">
            <RuleDemo />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
