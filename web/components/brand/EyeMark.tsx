import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export type EyeMood = "idle" | "curious" | "alert" | "listening" | "thinking";

interface EyeMarkProps {
  className?: string;
  mood?: EyeMood;
  /** Follow the pointer with the pupils. */
  track?: boolean;
  title?: string;
}

/**
 * The "o" of 4forces: a ring with two understated eyes.
 * Pupils drift toward the pointer, it blinks every few seconds, and widens when curious/alert.
 */
export function EyeMark({ className, mood = "idle", track = true, title }: EyeMarkProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!track || reduced) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = px - (r.left + r.width / 2);
      const dy = py - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 260);
      setLook({ x: (dx / d) * 7 * reach, y: (dy / d) * 6 * reach });
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [track, reduced]);

  useEffect(() => {
    if (reduced) return;
    let t: number;
    const schedule = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        schedule();
      }, 2800 + Math.random() * 4200);
    };
    schedule();
    return () => window.clearTimeout(t);
  }, [reduced]);

  const eyeRy = mood === "alert" ? 11 : mood === "curious" || mood === "listening" ? 10 : 8.5;
  const eyeRx = mood === "thinking" ? 5 : 5.6;
  const thinkingLook = mood === "thinking" ? { x: 5, y: -5 } : look;

  return (
    <svg
      ref={ref}
      viewBox="0 0 100 100"
      className={cn("inline-block overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" strokeWidth="13" />
      <g
        style={{
          transform: `translate(${thinkingLook.x}px, ${thinkingLook.y}px) scaleY(${blink ? 0.12 : 1})`,
          transformOrigin: "50px 50px",
          transition: "transform 160ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <ellipse cx="40" cy="50" rx={eyeRx} ry={eyeRy} fill="currentColor" style={{ transition: "all 220ms" }} />
        <ellipse cx="60" cy="50" rx={eyeRx} ry={eyeRy} fill="currentColor" style={{ transition: "all 220ms" }} />
      </g>
    </svg>
  );
}
