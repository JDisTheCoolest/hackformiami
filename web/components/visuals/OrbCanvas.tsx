import { useMemo, useRef, type RefObject } from "react";
import { useCanvasLoop, useReducedMotion } from "@/lib/hooks";
import { lerp, mulberry32 } from "@/lib/utils";

export type OrbState = "idle" | "focused" | "listening" | "processing" | "responding" | "error";

interface Palette {
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  energy: number;
  spin: number;
}

const PALETTES: Record<OrbState, Palette> = {
  idle: { a: [40, 104, 255], b: [101, 217, 242], c: [120, 90, 255], energy: 0.35, spin: 0.25 },
  focused: { a: [40, 104, 255], b: [140, 230, 250], c: [150, 120, 255], energy: 0.55, spin: 0.35 },
  listening: { a: [60, 160, 255], b: [120, 240, 255], c: [230, 245, 255], energy: 0.85, spin: 0.5 },
  processing: { a: [40, 104, 255], b: [238, 244, 255], c: [101, 217, 242], energy: 0.7, spin: 1.6 },
  responding: { a: [30, 90, 230], b: [101, 217, 242], c: [180, 230, 255], energy: 0.45, spin: 0.2 },
  error: { a: [120, 100, 90], b: [255, 170, 90], c: [90, 100, 120], energy: 0.25, spin: 0.12 },
};

const rgba = (c: [number, number, number], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (x: [number, number, number], y: [number, number, number], t: number): [number, number, number] => [
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
  const cur = useRef<Palette>({ ...PALETTES.idle });
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
      p.a = mix(p.a, target.a, k);
      p.b = mix(p.b, target.b, k);
      p.c = mix(p.c, target.c, k);
      p.energy = lerp(p.energy, target.energy, k);
      p.spin = lerp(p.spin, target.spin, k);
      const st = stateRef.current;

      const cx = w / 2;
      const cy = h / 2;
      const lv = st === "listening" ? (level?.current ?? 0) : 0;
      const breathe = Math.sin(t * (0.8 + p.energy)) * 0.02 * (0.5 + p.energy);
      const R = Math.min(w, h) * 0.3 * (1 + breathe + lv * 0.12);

      ctx.clearRect(0, 0, w, h);

      // halo
      const halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.1);
      halo.addColorStop(0, rgba(p.a, 0.32 + p.energy * 0.15));
      halo.addColorStop(0.45, rgba(p.c, 0.08));
      halo.addColorStop(1, rgba(p.a, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      // liquid body: wobbling outline
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const wob =
          1 + (Math.sin(a * 3 + t * 1.1) * 0.012 + Math.sin(a * 5 - t * 0.9) * 0.008) * (1 + p.energy * 2 + lv * 4);
        const x = cx + Math.cos(a) * R * wob;
        const y = cy + Math.sin(a) * R * wob;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const base = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R);
      base.addColorStop(0, "#0d2a7a");
      base.addColorStop(1, "#040b22");
      ctx.fillStyle = base;
      ctx.fill();
      ctx.clip();

      ctx.globalCompositeOperation = "lighter";
      const blobs: [[number, number, number], number, number, number][] = [
        [p.a, 0.9, 0.0, 0.62],
        [p.b, 1.3, 2.1, 0.5],
        [p.c, 0.7, 4.2, 0.55],
        [p.b, 1.7, 1.0, 0.32],
      ];
      blobs.forEach(([col, sp, ph, size], i) => {
        const tt = t * sp * (0.3 + p.spin * 0.4) + ph;
        const bx = cx + Math.cos(tt) * R * 0.38 + Math.sin(tt * 1.7 + i) * R * 0.12;
        const by = cy + Math.sin(tt * 1.3) * R * 0.34;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, R * size * (1.4 + p.energy * 0.4));
        g.addColorStop(0, rgba(col, 0.75));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      });
      ctx.globalCompositeOperation = "source-over";

      // eyes (hidden while processing — it's busy looking around)
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
      const eyeAlpha = st === "processing" ? 0 : st === "error" ? 0.35 : 0.85;
      if (eyeAlpha > 0) {
        const ex = st === "focused" ? 0 : Math.sin(t * 0.4) * R * 0.04;
        const ey = st === "listening" ? -R * 0.03 : 0;
        const ry = R * (st === "listening" || st === "focused" ? 0.13 : 0.11) * open;
        ctx.fillStyle = `rgba(238,244,255,${eyeAlpha})`;
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(cx + sx * R * 0.17 + ex, cy + ey, R * 0.065, Math.max(0.5, ry), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // rim
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, rgba(p.b, 0.75));
      rim.addColorStop(0.5, "rgba(255,255,255,0.08)");
      rim.addColorStop(1, rgba(p.c, 0.5));
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // orbiting particles
      const proc = st === "processing" ? 1 : 0;
      for (const q of particles) {
        q.a += dt * q.s * (0.15 + p.spin * 0.9);
        const rr = R * (proc ? 1.12 + q.z * 0.18 : q.rr);
        const x = cx + Math.cos(q.a) * rr;
        const y = cy + Math.sin(q.a) * rr * (proc ? 0.98 : 0.9);
        const al = (0.15 + q.z * 0.5) * (0.4 + p.energy);
        ctx.fillStyle = rgba(p.b, Math.min(1, al));
        const s = 1 + q.z * 1.6;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    },
    { reducedMotion: reduced },
  );

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
