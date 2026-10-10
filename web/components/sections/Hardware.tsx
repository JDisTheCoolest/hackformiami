import { BrainCircuit, Cctv, Map as MapIcon, Smartphone, Volume2, Waves, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLink } from "@/components/ui/app-link";
import { ProvenanceTag } from "@/components/ui/live-status";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { useReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

function Node({
  Icon,
  title,
  body,
  tone = "text-cyan",
  hardware = false,
  children,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  tone?: string;
  hardware?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative rounded-2xl border border-foam/10 bg-[linear-gradient(180deg,rgba(238,244,255,0.05),rgba(238,244,255,0.015))] p-4 backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-foam/[0.06] ring-1 ring-foam/10">
          <Icon className={cn("size-5", tone)} />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-foam">
            {title}
            {hardware && <span className="rounded-md bg-cyan/10 px-1.5 py-0.5 text-[11px] font-medium text-cyan">Raspberry Pi</span>}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-mist">{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Line with a pulse travelling along it: horizontal on desktop, vertical on phones. */
function Flow({ delay = 0 }: { delay?: number }) {
  return (
    <div aria-hidden="true" className="relative mx-auto h-10 w-px lg:mx-0 lg:h-px lg:w-full lg:self-center">
      <span className="absolute inset-0 bg-gradient-to-b from-cyan/10 via-cyan/40 to-cyan/10 lg:bg-gradient-to-r" />
      <span className="ff-flow-dot absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan shadow-[0_0_12px_rgba(101,217,242,0.9)]" style={{ animationDelay: `${delay}ms` }} />
    </div>
  );
}

function Leds() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(2);
  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % 3), 1600);
    return () => window.clearInterval(t);
  }, [reduced]);
  const leds = [
    { c: "#4cc38a", l: "Clear" },
    { c: "#f2d14b", l: "King tide" },
    { c: "#ff4d4d", l: "Alert" },
  ];
  return (
    <div className="mt-3 flex items-center gap-3 border-t border-foam/10 pt-3">
      {leds.map((d, n) => (
        <span key={d.l} className="flex items-center gap-1.5 text-xs text-mist">
          <span
            className="size-2.5 rounded-full transition-[opacity,box-shadow] duration-500"
            style={{ background: d.c, opacity: n === i ? 1 : 0.25, boxShadow: n === i ? `0 0 12px ${d.c}` : "none" }}
          />
          {d.l}
        </span>
      ))}
    </div>
  );
}

function FlowDiagram() {
  return (
    <div
      role="img"
      aria-label="How 4forces works: neighbors in the app and a Raspberry Pi street camera send reports to the 4forces API. Gemma 4 reads each report, the rule clusters them, and NOAA tide data is added. Alerts go out to a Raspberry Pi speaker in English, Spanish and Haitian Creole, and to the live map and app."
      className="grid items-stretch gap-0 lg:grid-cols-[1fr_4rem_1.15fr_4rem_1fr]"
    >
      <div className="flex flex-col justify-center gap-3">
        <Node Icon={Smartphone} title="Neighbors" body="Photo, text or voice from the 4forces app." />
        <Node Icon={Cctv} title="Street camera" body="Sends a photo of its block every 60 seconds." hardware />
      </div>
      <Flow />
      <div className="relative flex flex-col justify-center">
        <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] bg-[radial-gradient(closest-side,rgba(40,104,255,0.25),transparent)]" />
        <div className="relative rounded-2xl border border-cyan/25 bg-deep/80 p-5 shadow-[0_0_60px_-20px_rgba(101,217,242,0.5)] backdrop-blur">
          <p className="flex items-center gap-2 font-semibold text-foam">
            <BrainCircuit className="size-5 text-cyan" /> 4forces API
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between gap-3 rounded-lg bg-foam/[0.04] px-3 py-2">
              <span className="text-foam">Gemma 4 reads each report</span>
              <span className="text-xs text-dim">type · severity · depth</span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-lg bg-foam/[0.04] px-3 py-2">
              <span className="text-foam">Cluster rule</span>
              <span className="text-xs text-dim">3 · 1 km · 60 min</span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-lg bg-foam/[0.04] px-3 py-2">
              <span className="flex items-center gap-1.5 text-foam">
                <Waves className="size-3.5 text-cyan" /> NOAA tide
              </span>
              <span className="text-xs text-dim">king-tide risk</span>
            </li>
          </ul>
        </div>
      </div>
      <Flow delay={900} />
      <div className="flex flex-col justify-center gap-3">
        <Node Icon={Volume2} title="Speaker" body="Siren, then reads the alert in English, Spanish and Haitian Creole." tone="text-sev-severe" hardware>
          <Leds />
        </Node>
        <Node Icon={MapIcon} title="Live map & app" body="Pins by severity, alert banner, tide risk." />
      </div>
    </div>
  );
}

export function Hardware() {
  return (
    <section id="hardware" aria-labelledby="hardware-title" className="relative overflow-hidden border-t hairline bg-abyss py-24 sm:py-32">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Reveal className="lg:col-span-6">
            <SectionLabel>Hardware</SectionLabel>
            <h2 id="hardware-title" className="mt-5 text-balance text-4xl font-semibold leading-[1] tracking-[-0.04em] text-foam sm:text-5xl">
              A camera that watches. A speaker that warns.
            </h2>
          </Reveal>
          <Reveal className="lg:col-span-5 lg:col-start-8" delay={100}>
            <p className="text-lg leading-relaxed text-mist">
              Not everyone is looking at a phone when the water rises. Two Raspberry Pi prototypes close the loop: one
              reports what the street looks like, the other says the alert out loud.
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-14" delay={150}>
          <FlowDiagram />
        </Reveal>

        <div className="mt-12 flex flex-col gap-6 border-t hairline pt-8 lg:flex-row lg:items-center lg:justify-between">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-mist">
            <li className="flex items-center gap-2">
              <ProvenanceTag kind="live">Prototype</ProvenanceTag> Camera and speaker run today
            </li>
            <li className="flex items-center gap-2">
              <ProvenanceTag kind="planned" /> Water-level and other environmental sensors
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-4">
            <p className="max-w-xs text-sm text-dim">Reports from the app and the camera land on the same map; the speaker announces the alert.</p>
            <AppLink context="to test the camera and speaker">Test it in the app</AppLink>
          </div>
        </div>
      </div>
    </section>
  );
}
