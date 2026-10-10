import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { FireField, GustField, LandField } from "@/components/visuals/ForceVisuals";
import { ParticleWave } from "@/components/visuals/ParticleWave";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { ForceId } from "@/types";

interface Scene {
  id: ForceId;
  name: string;
  caption: string;
  tone: string;
  bar: string;
  ms: number;
}

export const SCENES: Scene[] = [
  { id: "water", name: "Water", caption: "Floods, king tides, surge", tone: "text-cyan", bar: "bg-cyan", ms: 9000 },
  { id: "air", name: "Air", caption: "Wind, storms, hurricanes", tone: "text-air", bar: "bg-air", ms: 9000 },
  { id: "land", name: "Land", caption: "Streets, trees, power lines", tone: "text-land", bar: "bg-land", ms: 8000 },
  { id: "fire", name: "Fire", caption: "Fire and extreme heat", tone: "text-fire", bar: "bg-fire", ms: 8000 },
];

const TRANSITION_MS = 2400;

function Photo({ src, active, position }: { src: string; active: boolean; position: string }) {
  return (
    <img
      src={src}
      alt=""
      decoding="async"
      className={cn(
        "absolute inset-0 h-full w-full object-cover",
        position,
        active ? "[animation:kenburns_14s_linear_both]" : "",
      )}
    />
  );
}

/**
 * The hero background: four scenes that dissolve into each other — water (particle wave),
 * air (wind footage over the storm-skyline photo), land (street photo with contours), fire (heat field).
 */
export function useHeroScenes({ scroll, sectionRef }: { scroll: RefObject<number>; sectionRef: RefObject<HTMLElement | null> }) {
  const reduced = useReducedMotion();
  const inView = useInView(sectionRef);
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const playing = !reduced && !userPaused && inView;
  const timer = useRef(0);

  const go = useCallback((next: number) => {
    setIndex((cur) => {
      if (cur === next) return cur;
      setPrev(cur);
      return next;
    });
  }, []);

  // advance after the current scene's duration
  useEffect(() => {
    if (!playing) return;
    timer.current = window.setTimeout(() => go((index + 1) % SCENES.length), SCENES[index].ms);
    return () => window.clearTimeout(timer.current);
  }, [index, playing, go]);

  // forget the outgoing scene once it has faded so its canvas/video can stop
  useEffect(() => {
    if (prev === null) return;
    const t = window.setTimeout(() => setPrev(null), TRANSITION_MS + 200);
    return () => window.clearTimeout(t);
  }, [prev]);

  const live = (i: number) => i === index || i === prev;
  const nextIndex = (index + 1) % SCENES.length;

  const layer = (i: number) =>
    cn(
      "absolute inset-0 transition-[opacity,transform,filter] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[opacity,transform]",
      i === index ? "z-[2] opacity-100 scale-100 blur-0" : "z-[1] opacity-0 scale-[1.05] blur-[10px]",
    );
  const style = { transitionDuration: `${TRANSITION_MS}ms` };

  return {
    background: (
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        {/* WATER */}
        <div className={layer(0)} style={style}>
          <ParticleWave scroll={scroll} running={live(0)} />
        </div>
        {/* AIR */}
        <div className={layer(1)} style={style}>
          <Photo src="/assets/images/miami-storm-skyline.jpg" active={index === 1} position="object-[50%_35%]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,20,40,0.35),rgba(3,8,20,0.55))] mix-blend-multiply" />
          {live(1) && <GustField running={live(1)} />}
        </div>
        {/* LAND */}
        <div className={layer(2)} style={style}>
          <Photo src="/assets/images/miami-urban-street.jpg" active={index === 2} position="object-[50%_45%]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,28,22,0.55),rgba(3,8,20,0.7))]" />
          <div className="absolute inset-0 opacity-40 mix-blend-screen">
            {live(2) && <LandField transparent running={live(2)} />}
          </div>
        </div>
        {/* FIRE */}
        <div className={layer(3)} style={style}>{(live(3) || nextIndex === 3) && <FireField running={live(3)} />}</div>
      </div>
    ),
    controls: (
      <div className="flex items-end gap-3">
        <div role="group" aria-label="Background scenes" className="grid flex-1 grid-cols-4 gap-px overflow-hidden rounded-xl border hairline bg-line md:w-[34rem] md:flex-none">
          {SCENES.map((s, i) => {
            const active = i === index;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => go(i)}
                className="group relative bg-abyss/70 px-3 pb-3 pt-2.5 text-left backdrop-blur-md transition-colors hover:bg-abyss/50"
              >
                <span className={cn("block text-sm font-medium transition-colors", active ? s.tone : "text-mist group-hover:text-foam")}>{s.name}</span>
                <span className="mt-0.5 hidden text-xs leading-snug text-dim lg:block">{s.caption}</span>
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-foam/5">
                  {active && (
                    <span
                      key={`${index}-${playing}`}
                      className={cn("block h-full origin-left", s.bar)}
                      style={
                        playing
                          ? { animation: `progress ${s.ms}ms linear both` }
                          : { transform: "scaleX(1)", opacity: 0.6 }
                      }
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {!reduced && (
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? "Play background scenes" : "Pause background scenes"}
            className="grid size-[3.25rem] shrink-0 place-items-center rounded-xl border hairline bg-abyss/70 text-mist backdrop-blur-md transition-colors hover:text-foam"
          >
            {userPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        )}
      </div>
    ),
    scene: SCENES[index],
  };
}
