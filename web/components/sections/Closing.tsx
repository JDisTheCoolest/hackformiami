import { Wordmark } from "@/components/brand/Wordmark";
import { AppLink } from "@/components/ui/app-link";
import { Reveal, SectionLabel } from "@/components/ui/reveal";

export function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="border-t hairline bg-deep/30 py-24 sm:py-28">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
        <Reveal className="lg:col-span-5">
          <SectionLabel>About</SectionLabel>
          <h2 id="about-title" className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-foam sm:text-4xl">
            Built in a day in Miami.
          </h2>
        </Reveal>
        <Reveal className="space-y-4 text-mist lg:col-span-6 lg:col-start-7" delay={100}>
          <p>
            4forces started at Hack for Humanity: Miami in October 2026, in the &ldquo;Four Forces, One City&rdquo;
            track. A three-person team split the work: the app and backend, this website, and the hardware and deployment.
          </p>
          <p>
            It is an early prototype. Water is the most developed force today; air, land and fire share the same
            reporting and alert pipeline, with dedicated data sources still to come.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="relative isolate overflow-hidden border-t hairline">
      <img
        src="/assets/images/coastal-shoreline.jpg"
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_70%] opacity-50 mix-blend-luminosity"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#030814_0%,rgba(6,21,47,0.75)_45%,#030814_100%)]" />
      <div className="mx-auto flex max-w-[1440px] flex-col items-center px-4 py-28 text-center sm:px-6 sm:py-40 lg:px-10">
        <Reveal>
          <p className="label-sm text-mist">Miami, Florida</p>
          <h2 id="final-title" className="mt-6 text-balance text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-foam sm:text-7xl lg:text-8xl">
            Four Forces. <span className="text-cyan">One City.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-mist">
            Open the app to see the live map, send a report, and watch an alert travel from a photo to a speaker.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <AppLink context="to see the live map and test the hardware" />
            <a href="#forces" className="inline-flex h-14 items-center rounded-[14px] border border-foam/25 px-6 text-[1.0625rem] font-medium text-foam transition-colors hover:border-foam/60 hover:bg-foam/5">
              Explore the Four Forces
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t hairline bg-abyss">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-12 lg:px-10">
        <div className="md:col-span-4">
          <Wordmark className="text-3xl text-foam" track={false} />
          <p className="mt-3 max-w-xs text-sm text-mist">Four Forces. One City. An early-warning prototype for Miami.</p>
          <p className="mt-6 text-sm text-dim">Contact: coming soon</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-6 text-sm md:col-span-4">
          <ul className="space-y-2">
            {[
              ["#forces", "The Four Forces"],
              ["#how", "How It Works"],
              ["#assistant", "Live Demo"],
              ["#app", "The App"],
              ["#about", "About"],
            ].map(([h, l]) => (
              <li key={h}>
                <a href={h} className="text-mist hover:text-foam">{l}</a>
              </li>
            ))}
          </ul>
          <ul className="space-y-2 text-dim">
            <li>
              <AppLink variant="compact" />
            </li>
            <li>Privacy — coming soon</li>
            <li>Terms — coming soon</li>
          </ul>
        </nav>
        <div className="space-y-3 text-xs leading-relaxed text-dim md:col-span-4">
          <p>
            4forces is a prototype, not an official warning service. In an emergency, call 911. For official watches and
            warnings, follow the National Weather Service and Miami-Dade County emergency management.
          </p>
          <p>
            Data: tide predictions from NOAA CO-OPS (station 8723214, Virginia Key) via the 4forces API; reports from
            neighbors, analyzed by Gemma 4. Map coastline is simplified and illustrative. Visuals marked
            &ldquo;sample&rdquo; or &ldquo;illustrative&rdquo; are not observations.
          </p>
          <p>Photographs supplied by the team for this prototype; usage rights to be confirmed before public release.
            News videos are embedded from YouTube (WPLG Local 10, CNN) and load only when played.</p>
        </div>
      </div>
      <div className="border-t hairline">
        <p className="mx-auto max-w-[1440px] px-4 py-5 text-xs text-dim sm:px-6 lg:px-10">© 2026 4forces · Hack for Humanity: Miami</p>
      </div>
    </footer>
  );
}
