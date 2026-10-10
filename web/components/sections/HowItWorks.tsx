import { Reveal, SectionLabel } from "@/components/ui/reveal";

const STEPS = [
  { k: "Observe", d: "A neighbor sees water over the curb, a downed line, smoke. Tide predictions show when the bay runs high." },
  { k: "Collect", d: "They send a photo, a sentence or a voice note from the app, pinned to their location. A Pi street camera sends a photo of its block every minute the same way." },
  { k: "Interpret", d: "Gemma 4 classifies the hazard and severity, estimates flood depth from reference objects like tires, and scores its confidence. Low-confidence reads are marked unconfirmed." },
  { k: "Alert", d: "When three moderate or severe reports of the same hazard, each with at least 50% confidence, land within 1 km and 60 minutes, 4forces raises one alert for that area." },
  { k: "Respond", d: "The alert appears on the map and in the app, and neighborhood speakers sound a siren and read it aloud in English, Spanish and Haitian Creole." },
];

function RuleDiagram() {
  const dots = [
    { x: 168, y: 150, d: "0s", t: "11:40" },
    { x: 222, y: 186, d: "1.2s", t: "11:43" },
    { x: 196, y: 228, d: "2.4s", t: "11:45" },
  ];
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" role="img" aria-label="Diagram of the alert rule: three reports inside a one-kilometre circle within sixty minutes trigger an alert.">
      <defs>
        <radialGradient id="rule-glow">
          <stop offset="0" stopColor="#ff4d4d" stopOpacity="0.25" />
          <stop offset="1" stopColor="#ff4d4d" stopOpacity="0" />
        </radialGradient>
      </defs>
      {[40, 80, 120, 160, 200, 240, 280, 320, 360].map((v) => (
        <g key={v} stroke="rgba(169,184,211,0.06)">
          <line x1={v} y1="0" x2={v} y2="400" />
          <line x1="0" y1={v} x2="400" y2={v} />
        </g>
      ))}
      <circle cx="200" cy="190" r="120" fill="url(#rule-glow)" className="[animation:rule-alert_6s_ease-in-out_infinite]" />
      <circle cx="200" cy="190" r="110" fill="none" stroke="rgba(101,217,242,0.5)" strokeDasharray="3 5" />
      <line x1="200" y1="190" x2="310" y2="190" stroke="rgba(101,217,242,0.5)" />
      <text x="255" y="182" textAnchor="middle" fill="#65d9f2" fontFamily="Inter Tight Variable, sans-serif" fontSize="11">1 km</text>
      {dots.map((p, i) => (
        <g key={i} className="[animation:rule-dot_6s_ease-out_infinite]" style={{ animationDelay: p.d, transformOrigin: `${p.x}px ${p.y}px` }}>
          <circle cx={p.x} cy={p.y} r="16" fill="#ff9b3d" fillOpacity="0.2" />
          <circle cx={p.x} cy={p.y} r="6" fill="#ff9b3d" stroke="#030814" strokeWidth="2" />
          <text x={p.x + 12} y={p.y - 10} fill="rgba(238,244,255,0.75)" fontFamily="Inter Tight Variable, sans-serif" fontSize="10">{p.t}</text>
        </g>
      ))}
      <g className="[animation:rule-alert_6s_ease-in-out_infinite]">
        <rect x="120" y="330" width="160" height="34" rx="8" fill="#ff4d4d" fillOpacity="0.15" stroke="#ff4d4d" strokeOpacity="0.6" />
        <text x="200" y="352" textAnchor="middle" fill="#ffd2d2" fontFamily="Inter Tight Variable, sans-serif" fontSize="11">Alert: 3 reports in 60 min</text>
      </g>
    </svg>
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
          <div className="sticky top-24 aspect-square overflow-hidden rounded-2xl border hairline bg-abyss">
            <RuleDiagram />
            <p className="label-sm absolute left-4 top-4 text-dim">The alert rule</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
