import { useMemo, useRef, type RefObject } from "react";
import { useCanvasLoop, useReducedMotion } from "@/lib/hooks";
import { mulberry32 } from "@/lib/utils";

interface Particle {
  s: number; // 0..1 position along the swell
  d: number; // vertical position inside the foam band (-0.25 .. 1)
  size: number;
  speed: number;
  phase: number;
  color: 0 | 1 | 2; // white / pale rose / pale cyan
}

const COLORS = ["#f4f8ff", "#f3cfe4", "#a8ecfb"];
const NODE_S = [0.3, 0.45, 0.58, 0.7, 0.8];

/**
 * Hero visual: a deep-blue swell whose crest is built from hundreds of drifting particles —
 * an original take on the "wave with a luminous particle crest" reference.
 * A handful of particles act as measurement nodes joined by a faint network.
 */
export function ParticleWave({ scroll, running = true }: { scroll?: RefObject<number>; running?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const pointer = useRef({ x: -9999, y: -9999, active: false });

  const particles = useMemo(() => {
    const rand = mulberry32(42);
    const list: Particle[] = [];
    for (let i = 0; i < 2400; i++) {
      // bias positions toward the crest so foam is dense near the peak
      const s = Math.pow(rand(), 0.62);
      const g = (rand() + rand() + rand()) / 3; // ~gaussian
      const c = rand();
      list.push({
        s,
        d: g * 1.25 - 0.25,
        size: 0.5 + Math.pow(rand(), 3) * 2.1,
        speed: 0.004 + rand() * 0.012,
        phase: rand() * Math.PI * 2,
        color: c < 0.72 ? 0 : c < 0.86 ? 1 : 2,
      });
    }
    return list;
  }, []);

  useCanvasLoop(
    canvasRef,
    ({ ctx, w, h, t }) => {
      const mobile = w < 720;
      const sp = Math.min(1, scroll?.current ?? 0);
      const horizon = mobile ? h - 60 : h * 0.68;
      const amp = (mobile ? Math.min(h * 0.13, 110) : h * 0.3) * (1 - sp * 0.5);
      const peakX = w * (mobile ? 0.62 : 0.68) + Math.sin(t * 0.12) * w * 0.012;
      const span = w * (mobile ? 0.9 : 0.6);
      const R = amp * 0.36; // curl radius

      const ripple = (x: number, k: number) =>
        (Math.sin(x * 0.011 + t * 0.7) * 4 + Math.sin(x * 0.027 - t * 1.1) * 2 + Math.sin(x * 0.004 + t * 0.25) * 7) * k;
      const p = pointer.current;
      const lift = (x: number) => {
        if (!p.active) return 0;
        const dx = (x - p.x) / 140;
        return Math.exp(-dx * dx) * 12 * Math.max(0, 1 - Math.abs(p.y - horizon) / (h * 0.5));
      };
      const backF = (x: number) => Math.exp(-(((x - peakX) / span) ** 2) * 2.2);
      const backY = (x: number) => horizon - amp * backF(x) - ripple(x, 0.4 + backF(x)) - lift(x);
      const peakY = backY(peakX);
      const cx = peakX + R * 0.1;
      const cy = peakY + R;
      const CURL_END = 2.5;
      const curlR = (a: number) => R * (1 - 0.32 * (a / CURL_END));
      const curlPt = (a: number, off = 0) => {
        const r = curlR(a) + off;
        return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
      };
      const footX = cx + R * 2.1;
      const frontY = (x: number) =>
        horizon - amp * 0.07 * Math.exp(-(((x - footX) / (span * 0.4)) ** 2)) - ripple(x, 0.35) - lift(x);

      ctx.clearRect(0, 0, w, h);

      // Deep glow behind the swell
      const glow = ctx.createRadialGradient(peakX, peakY + amp * 0.3, 10, peakX, peakY + amp * 0.4, w * 0.55);
      glow.addColorStop(0, "rgba(40,104,255,0.32)");
      glow.addColorStop(0.5, "rgba(26,64,180,0.10)");
      glow.addColorStop(1, "rgba(3,8,20,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Water body: back of the wave → curling lip → face → sea in front
      const step = mobile ? 8 : 6;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= peakX; x += step) ctx.lineTo(x, backY(x));
      for (let a = 0; a <= CURL_END; a += 0.08) {
        const q = curlPt(a);
        ctx.lineTo(q.x, q.y);
      }
      const end = curlPt(CURL_END);
      ctx.quadraticCurveTo(end.x - R * 0.2, horizon - R * 0.1, footX, frontY(footX));
      for (let x = footX; x <= w + step; x += step) ctx.lineTo(x, frontY(x));
      ctx.lineTo(w, h);
      ctx.closePath();
      const body = ctx.createLinearGradient(0, peakY, 0, h);
      body.addColorStop(0, "#1745c4");
      body.addColorStop(0.3, "#0d2a80");
      body.addColorStop(1, "#030a1d");
      ctx.fillStyle = body;
      ctx.fill();

      ctx.save();
      ctx.clip();
      // The barrel: darker hollow under the lip
      const barrel = ctx.createRadialGradient(cx + R * 0.15, cy + R * 0.2, 2, cx + R * 0.15, cy + R * 0.25, R * 1.1);
      barrel.addColorStop(0, "rgba(3,10,40,0.85)");
      barrel.addColorStop(0.6, "rgba(6,20,70,0.35)");
      barrel.addColorStop(1, "rgba(6,20,70,0)");
      ctx.fillStyle = barrel;
      ctx.fillRect(cx - R * 1.4, cy - R * 1.2, R * 3, R * 3);
      // Face strands sweeping into the barrel
      ctx.lineWidth = 1;
      for (let i = 0; i < 22; i++) {
        const k = i / 21;
        const x0 = peakX - R * 1.6 + k * R * 1.4;
        ctx.beginPath();
        ctx.moveTo(x0, backY(x0) + 3);
        ctx.quadraticCurveTo(cx - R * 0.2 + k * R * 0.5, cy + R * 0.9, footX - R * 0.5 + k * R * 0.6, horizon + 6);
        ctx.strokeStyle = `rgba(130,175,255,${0.05 + k * 0.08})`;
        ctx.stroke();
      }
      // Swell lines in the open water
      for (let k = 0; k < 9; k++) {
        const yBase = horizon + 22 + k * k * 4.2 + k * 8;
        if (yBase > h) break;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 10) {
          const y = yBase + Math.sin(x * (0.006 + k * 0.0012) + t * (0.35 + k * 0.05) + k) * (3 + k * 0.9);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(110,150,255,${0.13 - k * 0.009})`;
        ctx.stroke();
      }
      ctx.restore();

      // Foam particles riding the crest and around the lip
      const SPLIT = 0.74;
      const count = Math.floor(particles.length * (mobile ? 0.55 : 1));
      const fade = 1 - sp * 0.6;
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = COLORS[c];
        for (let i = 0; i < count; i++) {
          const pt = particles[i];
          if (pt.color !== c) continue;
          const s = (pt.s + (reduced ? 0 : t * pt.speed * 0.22)) % 1;
          let x: number;
          let y: number;
          let f: number;
          if (s < SPLIT) {
            x = (s / SPLIT) * peakX;
            f = backF(x);
            if (f < 0.1) continue;
            const thick = 4 + 46 * Math.pow(f, 2);
            y = backY(x) - thick * pt.d;
          } else {
            const a = ((s - SPLIT) / (1 - SPLIT)) * CURL_END;
            f = 1 - (a / CURL_END) * 0.55;
            const thick = (44 * (1 - a / CURL_END) + 6) * pt.d;
            const q = curlPt(a, thick);
            x = q.x;
            y = q.y;
          }
          y += Math.sin(t * 0.8 + pt.phase) * 1.1;
          const tw = 0.6 + 0.4 * Math.sin(t * 2.2 + pt.phase * 3);
          ctx.globalAlpha = Math.min(1, (0.35 + f * 0.75) * tw) * fade;
          const size = pt.size * (0.75 + f * 0.55);
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;

      if (mobile) return;
      // Measurement nodes: a sparse network floating above the crest
      const nodes = NODE_S.map((s, i) => {
        const x = s * peakX + Math.sin(t * 0.3 + i) * 5;
        return { x, y: backY(x) - 46 * Math.pow(backF(x), 2) - 22 };
      });
      ctx.strokeStyle = "rgba(101,217,242,0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      nodes.forEach((n, i) => (i === 0 ? ctx.moveTo(n.x, n.y) : ctx.lineTo(n.x, n.y)));
      ctx.stroke();
      ctx.setLineDash([]);
      nodes.forEach((n, i) => {
        const pulse = reduced ? 0.4 : (t * 0.45 + i * 0.37) % 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 3 + pulse * 18, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(101,217,242,${0.55 * (1 - pulse) * fade})`;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = "#65d9f2";
        ctx.fill();
      });
    },
    { reducedMotion: reduced, running },
  );

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top, active: true };
      }}
      onPointerLeave={() => (pointer.current.active = false)}
    />
  );
}
