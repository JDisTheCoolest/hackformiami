import { useMemo, useRef, type RefObject } from "react";
import { useCanvasLoop, useReducedMotion } from "@/lib/hooks";
import { lerp, mulberry32 } from "@/lib/utils";

export type OrbState = "idle" | "focused" | "listening" | "processing" | "responding" | "error";

type RGB = [number, number, number];
interface Palette {
  hues: [RGB, RGB, RGB, RGB];
  energy: number;
  spin: number;
}

const BLUE: RGB = [40, 104, 255];
const CYAN: RGB = [101, 217, 242];
const VIOLET: RGB = [143, 123, 255];
const PINK: RGB = [240, 138, 216];

const PALETTES: Record<OrbState, Palette> = {
  idle: { hues: [BLUE, CYAN, VIOLET, PINK], energy: 0.35, spin: 0.25 },
  focused: { hues: [BLUE, CYAN, VIOLET, PINK], energy: 0.55, spin: 0.35 },
  listening: { hues: [CYAN, [180, 240, 255], BLUE, VIOLET], energy: 0.9, spin: 0.5 },
  processing: { hues: [VIOLET, PINK, BLUE, CYAN], energy: 0.75, spin: 1.6 },
  responding: { hues: [BLUE, CYAN, [170, 220, 255], VIOLET], energy: 0.45, spin: 0.2 },
  error: { hues: [[150, 110, 80], [255, 170, 90], [110, 115, 135], [200, 120, 90]], energy: 0.25, spin: 0.12 },
};

const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (x: RGB, y: RGB, t: number): RGB => [
  lerp(x[0], y[0], t),
  lerp(x[1], y[1], t),
  lerp(x[2], y[2], t),
];

/**
 * The 4forces assistant orb. A liquid body of moving light, orbiting particles and —
 * echoing the wordmark's "o" — two quiet eyes. Colours and energy ease between states.
 */
export function OrbCanvas({ state, level }: { state: OrbState; level?: RefObject<number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const stateRef = useRef(state);
  stateRef.current = state;
  const cur = useRef<Palette>({ ...PALETTES.idle, hues: [...PALETTES.idle.hues] as Palette["hues"] });
  const particles = useMemo(() => {
    const r = mulberry32(5);
    return Array.from({ length: 90 }, () => ({ a: r() * Math.PI * 2, rr: 1.08 + r() * 0.5, s: 0.4 + r() * 1.2, z: r() }));
  }, []);
  const blink = useRef({ next: 3, t: 0 });

  useCanvasLoop(
    ref,
    ({ ctx, w, h, t, dt }) => {
      const target = PALETTES[stateRef.current];
      const k = dt === 0 ? 1 : Math.min(1, dt * 3);
      const p = cur.current;
      p.hues = p.hues.map((h, i) => mix(h, target.hues[i], k)) as Palette["hues"];
      p.energy = lerp(p.energy, target.energy, k);
      p.spin = lerp(p.spin, target.spin, k);
      const st = stateRef.current;

      const cx = w / 2;
      const cy = h / 2;
      const lv = st === "listening" ? (level?.current ?? 0) : 0;
      const breathe = Math.sin(t * (0.8 + p.energy)) * 0.025 * (0.5 + p.energy);
      const R = Math.min(w, h) * 0.3 * (1 + breathe + lv * 0.14);

      ctx.clearRect(0, 0, w, h);

      // wide haze in the mixed colours, fading into the page
      const haze = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.3);
      haze.addColorStop(0, rgba(mix(p.hues[0], p.hues[2], 0.5), 0.42 + p.energy * 0.15));
      haze.addColorStop(0.5, rgba(p.hues[3], 0.06));
      haze.addColorStop(1, rgba(p.hues[0], 0));
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h);

      // body: soft, additive colour blobs — no outline, so it melts into the background
      ctx.globalCompositeOperation = "lighter";
      p.hues.forEach((col, i) => {
        const tt = t * (0.35 + p.spin * 0.45) * (0.8 + i * 0.25) + i * 1.7;
        const bx = cx + Math.cos(tt) * R * 0.42 + Math.sin(tt * 1.6 + i) * R * 0.12;
        const by = cy + Math.sin(tt * 1.25) * R * 0.38;
        const r = R * (0.85 + 0.1 * Math.sin(t * 0.9 + i)) * (1 + lv * 0.2);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        g.addColorStop(0, rgba(col, 0.6));
        g.addColorStop(0.5, rgba(col, 0.24));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(bx - r, by - r, r * 2, r * 2);
      });
      // luminous core and a soft spherical sheen
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55);
      core.addColorStop(0, `rgba(225,242,255,${0.14 + p.energy * 0.12})`);
      core.addColorStop(1, "rgba(235,248,255,0)");
      ctx.fillStyle = core;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      const sheen = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, 0, cx - R * 0.35, cy - R * 0.4, R * 0.5);
      sheen.addColorStop(0, "rgba(255,255,255,0.12)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.globalCompositeOperation = "source-over";

      // eyes: dark on the bright core, like the wordmark's "o" in reverse
      const b = blink.current;
      b.t += dt;
      let open = 1;
      if (!reduced && b.t > b.next) {
        const ph = (b.t - b.next) / 0.16;
        open = ph < 1 ? Math.abs(1 - ph * 2) : 1;
        if (ph >= 1) {
          b.t = 0;
          b.next = 3 + Math.random() * 4;
        }
      }
      const eyeAlpha = st === "processing" ? 0 : st === "error" ? 0.4 : 0.85;
      if (eyeAlpha > 0) {
        const ex = st === "focused" ? 0 : Math.sin(t * 0.4) * R * 0.04;
        const ey = st === "listening" ? -R * 0.03 : 0;
        const ry = R * (st === "listening" || st === "focused" ? 0.13 : 0.11) * open;
        ctx.fillStyle = `rgba(6,21,47,${eyeAlpha})`;
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(cx + sx * R * 0.17 + ex, cy + ey, R * 0.062, Math.max(0.5, ry), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // orbiting particles
      const proc = st === "processing" ? 1 : 0;
      for (const q of particles) {
        q.a += dt * q.s * (0.15 + p.spin * 0.9);
        const rr = R * (proc ? 1.05 + q.z * 0.2 : q.rr);
        const x = cx + Math.cos(q.a) * rr;
        const y = cy + Math.sin(q.a) * rr * (proc ? 0.98 : 0.9);
        const al = (0.12 + q.z * 0.45) * (0.4 + p.energy);
        ctx.fillStyle = rgba(p.hues[1], Math.min(1, al));
        const sz = 1 + q.z * 1.6;
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
    },
    { reducedMotion: reduced },
  );

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
