import { useRef, useState, type KeyboardEvent } from "react";
import { ScanView, type Detection, type Reading } from "@/components/visuals/ScanView";
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
  hex: string;
  scan: {
    src?: string;
    natural?: { w: number; h: number };
    position?: [number, number];
    alt?: string;
    detections: Detection[];
    reading: Reading;
  };
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
    hex: "#65d9f2",
    scan: {
      src: "/assets/images/flooded-residential-street.jpg",
      natural: { w: 1200, h: 675 },
      position: [0.5, 0.55],
      alt: "Aerial view of a car driving through a flooded residential street.",
      detections: [
        { x: 43.5, y: 44, w: 14.5, h: 29, label: "Vehicle in flood water", detail: "Bow wave at the bumper · cars should avoid" },
        { x: 64, y: 18, w: 28, h: 46, label: "Road under water", detail: "Lane markings submerged" },
        { x: 3, y: 25, w: 30, h: 32, label: "Standing water", detail: "Lawns and driveways flooded" },
      ],
      reading: { title: "Flood detected · severe", confidence: 91, caption: "confidence" },
    },
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
    hex: "#cfdcf2",
    scan: {
      src: "/assets/images/miami-storm-skyline.jpg",
      natural: { w: 962, h: 667 },
      position: [0.5, 0.45],
      alt: "Palm trees bending in strong wind in front of the downtown Miami skyline.",
      detections: [
        { x: 34, y: 26, w: 29, h: 45, label: "Palm canopy bent", detail: "Sustained strong wind", at: "inside" },
        { x: 63, y: 29, w: 27, h: 40, label: "Fronds pushed flat", detail: "Gusts likely", at: "inside" },
        { x: 36, y: 72, w: 38, h: 19, label: "Skyline", detail: "Low cloud, poor visibility", at: "right" },
      ],
      reading: { title: "Storm conditions · moderate", confidence: 78, caption: "confidence" },
    },
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
    hex: "#9db48a",
    scan: {
      src: "/assets/images/miami-urban-street.jpg",
      natural: { w: 660, h: 371 },
      position: [0.5, 0.5],
      alt: "A busy downtown Miami street with pedestrians, police motorcycles and a fire truck.",
      detections: [
        { x: 57, y: 37, w: 15, h: 34, label: "Response vehicles", detail: "Police motorcycles in the lane", at: "below" },
        { x: 84, y: 2, w: 15, h: 16, label: "Fire engine" },
        { x: 2, y: 15, w: 46, h: 55, label: "Crowd", detail: "Dense foot traffic at the curb", at: "inside" },
      ],
      reading: { title: "Road partly blocked", confidence: 82, caption: "confidence" },
    },
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
    hex: "#ff8a3d",
    scan: {
      src: "/assets/images/wildfire-night.jpg",
      natural: { w: 1600, h: 1066 },
      position: [0.5, 0.55],
      alt: "A wildfire burning through trees on a hillside at night under a glowing smoke plume.",
      detections: [
        { x: 15, y: 19, w: 78, h: 30, label: "Smoke plume", detail: "Tall, wind-driven column", at: "inside" },
        { x: 42, y: 52, w: 52, h: 20, label: "Active fire line", detail: "Spreading along the ridge", at: "below" },
        { x: 23, y: 53, w: 11, h: 31, label: "Power line in fire path", at: "right" },
      ],
      reading: { title: "Wildfire detected · severe", confidence: 94, caption: "confidence" },
    },
  },
];

export function ForceStage() {
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const force = FORCES[active];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (active + dir + FORCES.length) % FORCES.length;
    setPicked(true);
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
                  onClick={() => {
                    setPicked(true);
                    setActive(i);
                  }}
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
                <ScanView
                  {...force.scan}
                  accent={force.hex}
                  onCycleEnd={() => !picked && setActive((a) => (a + 1) % FORCES.length)}
                />
              </div>
              <div className="absolute bottom-6 right-6 hidden gap-2 sm:flex">
                <ProvenanceTag kind="illustrative" className="bg-abyss/60 backdrop-blur">Example AI reading · not live</ProvenanceTag>
              </div>
            </div>

            <p className="mt-3 text-xs text-dim sm:hidden">Example AI reading on a team photo — not live data.</p>
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
