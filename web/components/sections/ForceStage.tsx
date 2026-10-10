import { useRef, useState, type KeyboardEvent } from "react";
import { AirField, FireField, LandField, WaterField } from "@/components/visuals/ForceVisuals";
import { ProvenanceTag } from "@/components/ui/live-status";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import type { ForceId } from "@/types";

interface Force {
  id: ForceId;
  name: string;
  line: string;
  watches: string;
  today: string[];
  planned: string[];
  accent: string;
  ring: string;
  Visual: () => React.JSX.Element;
}

const FORCES: Force[] = [
  {
    id: "water",
    name: "Water",
    line: "Flooding, king tides, heavy rain and coastal surge.",
    watches: "Street flooding and the tide that drives it — Miami's most frequent hazard.",
    today: [
      "Flood reports analyzed for depth in inches and whether cars can pass",
      "NOAA tide predictions for Virginia Key with king-tide risk",
    ],
    planned: ["Street-level water-level sensors", "Rainfall feeds"],
    accent: "text-cyan",
    ring: "bg-cyan",
    Visual: WaterField,
  },
  {
    id: "air",
    name: "Air",
    line: "Severe wind, storms and hurricanes.",
    watches: "Storm damage on the ground, where atmospheric hazards meet streets and homes.",
    today: ["Storm-damage reports classified from photos, text or voice"],
    planned: ["Wind and pressure data", "Official NWS watches and warnings with source and time"],
    accent: "text-air",
    ring: "bg-air",
    Visual: AirField,
  },
  {
    id: "land",
    name: "Land",
    line: "Downed trees and power lines, erosion, exposed infrastructure.",
    watches: "The ground and the infrastructure on it — what blocks a road or endangers a block.",
    today: ["Downed-tree and downed-power-line reports, mapped and clustered into alerts"],
    planned: ["Elevation and terrain layers to show which blocks flood first"],
    accent: "text-land",
    ring: "bg-land",
    Visual: LandField,
  },
  {
    id: "fire",
    name: "Fire",
    line: "Fires and extreme heat.",
    watches: "Visible fire and smoke reported by neighbors, and the heat that stresses the city.",
    today: ["Fire reports detected from photos, text or voice"],
    planned: ["Heat-index data", "Wildfire and smoke feeds"],
    accent: "text-fire",
    ring: "bg-fire",
    Visual: FireField,
  },
];

export function ForceStage() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const force = FORCES[active];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (active + dir + FORCES.length) % FORCES.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <section id="forces" aria-labelledby="forces-title" className="relative border-t hairline bg-deep/40 py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionLabel>The Four Forces</SectionLabel>
            <h2 id="forces-title" className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1] tracking-[-0.04em] text-foam sm:text-6xl">
              Four forces. One connected view of risk.
            </h2>
          </div>
          <p className="max-w-md text-mist">
            Every force runs through the same pipeline — report, interpret, cluster, alert — so a flooded street and a
            downed line show up in one place.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-12">
          <div role="tablist" aria-label="Choose a force" aria-orientation="vertical" onKeyDown={onKey} className="flex gap-2 overflow-x-auto pb-1 lg:col-span-4 lg:flex-col lg:overflow-visible">
            {FORCES.map((f, i) => {
              const selected = i === active;
              return (
                <button
                  key={f.id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  role="tab"
                  id={`force-tab-${f.id}`}
                  aria-selected={selected}
                  aria-controls="force-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(i)}
                  className={cn(
                    "group relative flex min-w-[9.5rem] flex-1 flex-col rounded-2xl border p-4 text-left transition-colors duration-300 lg:min-w-0 lg:flex-none lg:p-6",
                    selected ? "border-foam/25 bg-foam/[0.06]" : "border-line hover:border-foam/15 hover:bg-foam/[0.03]",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full transition-opacity", f.ring, selected ? "opacity-100" : "opacity-30")} />
                  <span className={cn("mt-3 text-2xl font-semibold tracking-[-0.03em] lg:text-4xl", selected ? f.accent : "text-foam")}>
                    {f.name}
                  </span>
                  <span className="mt-2 hidden text-sm leading-relaxed text-mist lg:block">{f.line}</span>
                </button>
              );
            })}
          </div>

          <div id="force-panel" role="tabpanel" aria-labelledby={`force-tab-${force.id}`} className="lg:col-span-8">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border hairline bg-abyss sm:aspect-[16/10]">
              <div key={force.id} className="absolute inset-0 [animation:stage-in_900ms_var(--ease-out-expo)_both]">
                <force.Visual />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,8,20,0)_65%,rgba(3,8,20,0.45)_100%)]" />
              <p
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute -bottom-[0.18em] left-4 select-none text-[clamp(4rem,14vw,11rem)] font-semibold leading-none tracking-[-0.06em] opacity-90 mix-blend-screen sm:left-6",
                  force.accent,
                )}
              >
                {force.name}
              </p>
              <div className="absolute right-4 top-4 flex gap-2">
                <ProvenanceTag kind="illustrative">Illustrative visual</ProvenanceTag>
              </div>
            </div>

            <div className="mt-6 grid gap-6 rounded-2xl border hairline p-6 sm:grid-cols-3">
              <div>
                <p className="label-sm text-dim">What it watches</p>
                <p className="mt-2 text-foam">{force.watches}</p>
              </div>
              <div>
                <p className="label-sm flex items-center gap-2 text-dim">
                  In the prototype <ProvenanceTag kind="live">Today</ProvenanceTag>
                </p>
                <ul className="mt-2 space-y-2 text-sm text-mist">
                  {force.today.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span aria-hidden="true" className={cn("mt-2 size-1 shrink-0 rounded-full", force.ring)} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="label-sm flex items-center gap-2 text-dim">
                  Next <ProvenanceTag kind="planned" />
                </p>
                <ul className="mt-2 space-y-2 text-sm text-dim">
                  {force.planned.map((t) => (
                    <li key={t} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-dim" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
