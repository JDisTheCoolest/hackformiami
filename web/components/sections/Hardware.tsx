import { AppLink } from "@/components/ui/app-link";
import { ProvenanceTag } from "@/components/ui/live-status";
import { Reveal, SectionLabel } from "@/components/ui/reveal";

function SpeakerSchematic() {
  return (
    <svg viewBox="0 0 520 380" className="h-full w-full" role="img" aria-label="Schematic: the app and a Raspberry Pi camera send reports to the 4forces API; a Raspberry Pi speaker polls for the latest alert and announces it aloud in three languages.">
      {/* API node */}
      <g>
        <rect x="24" y="40" width="150" height="64" rx="12" fill="#06152f" stroke="rgba(169,184,211,0.25)" />
        <text x="44" y="68" fill="#eef4ff" fontFamily="Inter Tight Variable, sans-serif" fontSize="15" fontWeight="600">4forces API</text>
        <text x="44" y="88" fill="#7f8ca8" fontFamily="Inter Tight Variable, sans-serif" fontSize="10">/api/alerts/latest</text>
      </g>
      {/* poll line */}
      <path id="poll" d="M174 72 C 260 72, 250 190, 300 190" fill="none" stroke="rgba(101,217,242,0.45)" strokeDasharray="3 5" />
      <circle r="4" fill="#65d9f2">
        <animateMotion dur="5s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear">
          <mpath href="#poll" />
        </animateMotion>
      </circle>
      <text x="214" y="122" fill="#65d9f2" fontFamily="Inter Tight Variable, sans-serif" fontSize="10">Polls every 5 s</text>
      {/* device */}
      <g>
        <rect x="300" y="130" width="150" height="150" rx="22" fill="#0b1a33" stroke="rgba(238,244,255,0.3)" />
        {Array.from({ length: 36 }, (_, i) => (
          <circle key={i} cx={330 + (i % 6) * 18} cy={160 + Math.floor(i / 6) * 16} r="2.6" fill="rgba(238,244,255,0.22)" />
        ))}
        <circle cx="430" cy="262" r="4" fill="#4cc38a">
          <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x="375" y="306" textAnchor="middle" fill="#a9b8d3" fontFamily="Inter Tight Variable, sans-serif" fontSize="10">Raspberry Pi speaker</text>
      </g>
      {/* sound */}
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${468 + i * 14} 165 Q ${490 + i * 18} 205 ${468 + i * 14} 245`} fill="none" stroke="#65d9f2" strokeOpacity="0.6" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0;0.7;0" dur="2.4s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
        </path>
      ))}
      {/* languages */}
      {["EN", "ES", "HT"].map((l, i) => (
        <g key={l}>
          <rect x={300 + i * 52} y="326" width="44" height="26" rx="6" fill="none" stroke="rgba(169,184,211,0.3)" />
          <text x={322 + i * 52} y="343" textAnchor="middle" fill="#eef4ff" fontFamily="Inter Tight Variable, sans-serif" fontSize="11">{l}</text>
        </g>
      ))}
      {/* app node */}
      <g>
        <rect x="24" y="250" width="150" height="64" rx="12" fill="#06152f" stroke="rgba(169,184,211,0.25)" />
        <text x="44" y="278" fill="#eef4ff" fontFamily="Inter Tight Variable, sans-serif" fontSize="15" fontWeight="600">App + Pi camera</text>
        <text x="44" y="298" fill="#7f8ca8" fontFamily="Inter Tight Variable, sans-serif" fontSize="10">reports → alerts</text>
      </g>
      <path d="M99 250 L99 104" stroke="rgba(169,184,211,0.3)" strokeDasharray="2 4" />
      <text x="108" y="182" fill="#7f8ca8" fontFamily="Inter Tight Variable, sans-serif" fontSize="10">POST /api/reports</text>
    </svg>
  );
}

export function Hardware() {
  return (
    <section id="hardware" aria-labelledby="hardware-title" className="relative border-t hairline bg-abyss py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1440px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
        <Reveal className="order-2 lg:order-1 lg:col-span-7">
          <div className="aspect-[52/38] rounded-2xl border hairline bg-[radial-gradient(70%_60%_at_70%_50%,rgba(40,104,255,0.12),transparent)] p-4">
            <SpeakerSchematic />
          </div>
        </Reveal>
        <Reveal className="order-1 lg:order-2 lg:col-span-5" delay={100}>
          <SectionLabel>Hardware</SectionLabel>
          <h2 id="hardware-title" className="mt-5 text-balance text-4xl font-semibold leading-[1] tracking-[-0.04em] text-foam sm:text-5xl">
            A camera that watches. A speaker that warns.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-mist">
            Not everyone is looking at a phone when the water rises. Our prototype hardware is two Raspberry Pi
            devices: a street camera that reports what it sees, and a speaker that announces alerts out loud.
          </p>
          <ul className="mt-8 space-y-3 text-mist">
            <li className="flex flex-wrap items-center gap-2">
              <ProvenanceTag kind="live">Prototype</ProvenanceTag> Camera: photographs its block every 60 seconds and sends it in like a neighbor&rsquo;s photo, for Gemma 4 to analyze.
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <ProvenanceTag kind="live">Prototype</ProvenanceTag> Speaker: checks for new alerts every 5 seconds, sounds a siren and reads each one once.
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <ProvenanceTag kind="live">Prototype</ProvenanceTag> Speaks English, Spanish and Haitian Creole; LEDs show green (clear), yellow (king-tide risk), red (alert).
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <ProvenanceTag kind="planned" /> Water-level and other environmental sensors feeding the same pipeline.
            </li>
          </ul>
          <p className="mt-8 text-sm leading-relaxed text-dim">
            The hardware is tested through the app: reports filed there and the camera&rsquo;s photos land on the
            same live map, and when they cluster into an alert, the speaker announces it.
          </p>
          <AppLink className="mt-6" context="to test the alert speaker">
            Test it in the app
          </AppLink>
        </Reveal>
      </div>
    </section>
  );
}
