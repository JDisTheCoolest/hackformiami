import { useRef } from "react";
import { useHeroScenes } from "@/components/sections/HeroScenes";
import { AppLink } from "@/components/ui/app-link";
import { LiveStatus } from "@/components/ui/live-status";
import { useScrollProgress } from "@/lib/hooks";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const progress = useScrollProgress(ref);
  const scenes = useHeroScenes({ scroll: progress, sectionRef: ref });

  return (
    <section
      ref={ref}
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[radial-gradient(120%_80%_at_70%_0%,#0b2266_0%,#06152f_45%,#030814_100%)]"
    >
      {scenes.background}
      {/* legibility veil behind the copy, shared by every scene */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[3] bg-[linear-gradient(90deg,rgba(3,8,20,0.86)_0%,rgba(3,8,20,0.5)_42%,rgba(3,8,20,0.05)_72%)] max-md:bg-[linear-gradient(180deg,rgba(3,8,20,0.8)_0%,rgba(3,8,20,0.45)_55%,rgba(3,8,20,0.2)_100%)]"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-40 bg-gradient-to-t from-abyss/80 to-transparent" />

      <div className="relative z-[4] mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 pb-6 pt-24 sm:px-6 sm:pt-28 lg:px-10 lg:pt-28">
        <div className="max-w-[52rem]">
          <p className="label-sm text-mist">
            <span className="text-foam">Four Forces. One City.</span> Miami, Florida
          </p>
          <h1
            id="hero-title"
            className="mt-5 text-balance text-[2.7rem] font-semibold leading-[0.95] tracking-[-0.045em] text-foam sm:text-6xl lg:text-[4.6rem] 2xl:text-[5.4rem]"
          >
            See the signals before they become emergencies.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-relaxed text-mist sm:text-lg">
            4forces is an early-warning network for Miami. Neighbors&rsquo; reports, AI interpretation and NOAA tide
            data become clear, local alerts across water, air, land and fire.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <AppLink context="to report conditions and test the alert hardware" />
            <a
              href="#forces"
              className="inline-flex h-14 items-center rounded-[14px] border border-foam/20 px-6 text-[1.0625rem] font-medium text-foam backdrop-blur-sm transition-colors hover:border-foam/50 hover:bg-foam/5"
            >
              Explore the Four Forces
            </a>
            <a href="#how" className="px-2 text-sm text-mist underline-offset-4 hover:text-foam hover:underline">
              How It Works
            </a>
          </div>
          <p className="mt-4 max-w-[30rem] text-sm leading-relaxed text-dim">
            The app is where reports are filed, the live map runs, and our prototype camera and alert speaker are tested.
          </p>
        </div>

        <div className="mt-auto flex flex-col gap-4 pt-10 md:flex-row md:items-end md:justify-between">
          <LiveStatus />
          {scenes.controls}
        </div>
      </div>
    </section>
  );
}
