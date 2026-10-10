import { useEffect, useMemo, useRef } from "react";
import { useCanvasLoop, useReducedMotion } from "@/lib/hooks";
import { makeNoise2D, mulberry32 } from "@/lib/utils";

const canvasClass = "absolute inset-0 h-full w-full";

/* ───────────────────────────── WATER ─────────────────────────────
   Horizontal water-surface lines disturbed by expanding ripples, with a slow
   rising/falling level line — the idea of a gauge reading a changing surface. */
export function WaterField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const drops = useMemo(() => {
    const r = mulberry32(7);
    return Array.from({ length: 5 }, (_, i) => ({ x: 0.15 + r() * 0.7, y: 0.25 + r() * 0.55, born: i * 1.7 }));
  }, []);

  useCanvasLoop(
    ref,
    ({ ctx, w, h, t }) => {
      ctx.fillStyle = "#04102a";
      ctx.fillRect(0, 0, w, h);
      const level = h * (0.52 + Math.sin(t * 0.25) * 0.06);
      const lines = w < 600 ? 26 : 38;
      for (let i = 0; i < lines; i++) {
        const y0 = (i / (lines - 1)) * h;
        const below = y0 > level;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          let dy = Math.sin(x * 0.01 + t * 0.6 + i * 0.3) * 1.5;
          for (const d of drops) {
            const age = (t - d.born) % 8.5;
            if (age < 0) continue;
            const dx = x - d.x * w;
            const dyy = y0 - d.y * h;
            const r = Math.sqrt(dx * dx + dyy * dyy);
            const front = age * 70;
            const env = Math.exp(-((r - front) ** 2) / 1800) * Math.max(0, 1 - age / 8.5);
            dy += Math.sin(r * 0.09 - age * 5) * 9 * env;
          }
          if (x === 0) ctx.moveTo(x, y0 + dy);
          else ctx.lineTo(x, y0 + dy);
        }
        ctx.strokeStyle = below ? `rgba(101,217,242,${0.18 + (i / lines) * 0.3})` : "rgba(120,150,220,0.12)";
        ctx.lineWidth = below ? 1.1 : 0.8;
        ctx.stroke();
      }
      // level line
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(0, level);
      ctx.lineTo(w, level);
      ctx.strokeStyle = "rgba(238,244,255,0.55)";
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(238,244,255,0.75)";
      ctx.font = "500 12px 'Inter Tight Variable', sans-serif";
      ctx.fillText("Water level", 16, level - 8);
    },
    { reducedMotion: reduced },
  );
  return <canvas ref={ref} aria-hidden="true" className={canvasClass} />;
}

/* ────────────────────────────── AIR ──────────────────────────────
   A cyclonic flow field: streaks circulate counter-clockwise around a low-pressure
   centre (as hurricanes do in the northern hemisphere), drawn over drifting isobars. */
export function AirField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const noise = useMemo(() => makeNoise2D(11), []);
  const parts = useRef<{ x: number; y: number; life: number }[]>([]);

  useCanvasLoop(
    ref,
    ({ ctx, w, h, t, dt }) => {
      const cx = w * 0.72 + Math.sin(t * 0.05) * w * 0.03;
      const cy = h * 0.42;
      if (parts.current.length === 0 || dt === 0) {
        ctx.fillStyle = "#070d1d";
        ctx.fillRect(0, 0, w, h);
        const r = mulberry32(3);
        parts.current = Array.from({ length: w < 600 ? 450 : 900 }, () => ({ x: r() * w, y: r() * h, life: r() * 200 }));
      }
      // fade trails
      ctx.fillStyle = "rgba(7,13,29,0.09)";
      ctx.fillRect(0, 0, w, h);

      // isobars
      ctx.lineWidth = 1;
      for (let k = 1; k <= 7; k++) {
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.08) {
          const rr = k * Math.min(w, h) * 0.075 * (1 + 0.12 * noise(Math.cos(a) * 1.5 + k, Math.sin(a) * 1.5 + t * 0.05));
          const x = cx + Math.cos(a) * rr * 1.35;
          const y = cy + Math.sin(a) * rr;
          if (a === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(207,220,242,${0.05})`;
        ctx.stroke();
      }

      // a still frame (first paint / reduced motion) pre-simulates streaks so wind is still visible
      const iterations = dt === 0 ? 40 : 1;
      const step = dt === 0 ? 1 : reduced ? 0 : Math.min(dt, 0.033) * 60;
      ctx.strokeStyle = "rgba(225,236,255,0.55)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let it = 0; it < iterations; it++)
      for (const p of parts.current) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.hypot(dx, dy) + 1;
        // tangential (counter-clockwise on screen with y down → (dy, -dx)) + inflow + noise + trade wind
        const swirl = Math.min(1, 260 / d);
        const n = noise(p.x * 0.004, p.y * 0.004 + t * 0.08) * Math.PI;
        let vx = (dy / d) * 2.4 * swirl - (dx / d) * 0.5 * swirl + Math.cos(n) * 0.7 - 0.9;
        let vy = (-dx / d) * 2.4 * swirl - (dy / d) * 0.5 * swirl + Math.sin(n) * 0.7;
        const sp = Math.hypot(vx, vy) || 1;
        vx = (vx / sp) * (1 + swirl * 1.8);
        vy = (vy / sp) * (1 + swirl * 1.8);
        ctx.moveTo(p.x, p.y);
        p.x += vx * step;
        p.y += vy * step;
        ctx.lineTo(p.x, p.y);
        p.life -= step;
        if (p.life < 0 || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10 || d < 14) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.life = 120 + Math.random() * 200;
        }
      }
      ctx.stroke();

      ctx.fillStyle = "rgba(238,244,255,0.85)";
      ctx.font = "600 14px 'Inter Tight Variable', sans-serif";
      ctx.fillText("L", cx - 4, cy + 5);
    },
    { reducedMotion: reduced, stillTime: 0 },
  );
  return <canvas ref={ref} aria-hidden="true" className={canvasClass} />;
}

/* ──────────────────────────── AIR · GUSTS ────────────────────────────
   Transparent wind streaks for laying over a photo: fine lines driven left-to-right
   through turbulence, trails faded with destination-out so the photo shows through. */
export function GustField({ running = true }: { running?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const noise = useMemo(() => makeNoise2D(29), []);
  const parts = useRef<{ x: number; y: number; life: number; v: number }[]>([]);

  useCanvasLoop(
    ref,
    ({ ctx, w, h, t, dt }) => {
      if (parts.current.length === 0 || dt === 0) {
        ctx.clearRect(0, 0, w, h);
        const r = mulberry32(8);
        parts.current = Array.from({ length: w < 700 ? 260 : 520 }, () => ({ x: r() * w, y: r() * h, life: r() * 160, v: 0.6 + r() * 0.8 }));
      }
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.075)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      const iterations = dt === 0 ? 30 : 1;
      const step = dt === 0 ? 1 : reduced ? 0 : Math.min(dt, 0.033) * 60;
      const gust = 1 + Math.max(0, Math.sin(t * 0.7)) * 0.9; // wind arrives in gusts
      ctx.strokeStyle = "rgba(230,240,255,0.32)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let it = 0; it < iterations; it++)
        for (const p of parts.current) {
          const n = noise(p.x * 0.003 - t * 0.2, p.y * 0.006) * 0.9;
          const vx = (3.2 + n) * p.v * gust;
          const vy = (Math.sin(n * 3) * 0.6 + 0.35) * p.v;
          ctx.moveTo(p.x, p.y);
          p.x += vx * step;
          p.y += vy * step;
          ctx.lineTo(p.x, p.y);
          p.life -= step;
          if (p.life < 0 || p.x > w + 20 || p.y > h + 20) {
            p.x = -20 - Math.random() * w * 0.3;
            p.y = Math.random() * h;
            p.life = 140 + Math.random() * 180;
          }
        }
      ctx.stroke();
    },
    { reducedMotion: reduced, stillTime: 0, running },
  );
  return <canvas ref={ref} aria-hidden="true" className={canvasClass} />;
}

/* ────────────────────────────── LAND ─────────────────────────────
   Topographic contours (marching squares over a slowly drifting elevation field).
   Cells under a "low ground" threshold are dotted in cyan to suggest exposure. */
export function LandField({ transparent = false, running = true }: { transparent?: boolean; running?: boolean } = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const noise = useMemo(() => makeNoise2D(23), []);

  useCanvasLoop(
    ref,
    ({ ctx, w, h, t }) => {
      if (transparent) ctx.clearRect(0, 0, w, h);
      else {
        ctx.fillStyle = "#0a110e";
        ctx.fillRect(0, 0, w, h);
      }
      const cell = w < 600 ? 16 : 13;
      const cols = Math.ceil(w / cell) + 1;
      const rows = Math.ceil(h / cell) + 1;
      const field = new Float32Array(cols * rows);
      const drift = t * 0.03;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const x = i * cell;
          const y = j * cell;
          field[j * cols + i] =
            noise(x * 0.0045 + drift, y * 0.0045) * 0.65 + noise(x * 0.012, y * 0.012 - drift) * 0.25 + (x / w) * 0.35 - 0.1;
        }

      // street grid (infrastructure)
      if (!transparent) {
      ctx.strokeStyle = "rgba(196,184,155,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 46) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += 46) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
      }

      // low ground dots
      ctx.fillStyle = "rgba(101,217,242,0.55)";
      for (let j = 0; j < rows; j += 1)
        for (let i = 0; i < cols; i += 1) if (field[j * cols + i] < -0.32 && (i + j) % 2 === 0) ctx.fillRect(i * cell - 1, j * cell - 1, 2, 2);

      const levels = [-0.3, -0.18, -0.06, 0.06, 0.18, 0.3, 0.42, 0.54];
      levels.forEach((lv, li) => {
        ctx.beginPath();
        for (let j = 0; j < rows - 1; j++)
          for (let i = 0; i < cols - 1; i++) {
            const a = field[j * cols + i];
            const b = field[j * cols + i + 1];
            const c = field[(j + 1) * cols + i + 1];
            const d = field[(j + 1) * cols + i];
            const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const x = i * cell;
            const y = j * cell;
            const top = [x + cell * ((lv - a) / (b - a)), y] as const;
            const right = [x + cell, y + cell * ((lv - b) / (c - b))] as const;
            const bottom = [x + cell * ((lv - d) / (c - d)), y + cell] as const;
            const left = [x, y + cell * ((lv - a) / (d - a))] as const;
            const seg = (p: readonly [number, number], q: readonly [number, number]) => {
              ctx.moveTo(p[0], p[1]);
              ctx.lineTo(q[0], q[1]);
            };
            switch (idx) {
              case 1: case 14: seg(left, bottom); break;
              case 2: case 13: seg(bottom, right); break;
              case 3: case 12: seg(left, right); break;
              case 4: case 11: seg(top, right); break;
              case 5: seg(left, top); seg(bottom, right); break;
              case 6: case 9: seg(top, bottom); break;
              case 7: case 8: seg(left, top); break;
              case 10: seg(left, bottom); seg(top, right); break;
            }
          }
        const major = li % 3 === 0;
        ctx.strokeStyle = li === 0 ? "rgba(101,217,242,0.6)" : major ? "rgba(196,184,155,0.5)" : "rgba(157,180,138,0.32)";
        ctx.lineWidth = major ? 1.2 : 0.8;
        ctx.stroke();
      });
    },
    { reducedMotion: reduced, running },
  );
  return <canvas ref={ref} aria-hidden="true" className={canvasClass} />;
}

/* ────────────────────────────── FIRE ─────────────────────────────
   An original raw-WebGL heat field: domain-warped fBm rising from the base,
   mapped through a restrained ember palette, with faint isotherm lines.
   Renders at reduced resolution, pauses off-screen, falls back to a CSS gradient. */
const FIRE_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  float t = mod(u_time, 200.0) * 0.5;
  // vertically stretched noise rising over time -> flame tongues
  vec2 p = vec2(uv.x * aspect * 3.0, uv.y * 2.2 - t);
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.3)), fbm(p + vec2(4.7, -t * 0.2)));
  float n = fbm(p * 1.4 + q * 1.8);
  float heat = (1.0 - uv.y * 1.5) + (n - 0.5) * 1.6;
  float md = distance(uv * vec2(aspect, 1.0), u_mouse * vec2(aspect, 1.0));
  heat += 0.25 * exp(-md * md * 18.0);
  heat = clamp(heat, 0.0, 1.2);
  vec3 col = vec3(0.012, 0.018, 0.045);
  col = mix(col, vec3(0.28, 0.05, 0.035), smoothstep(0.12, 0.38, heat));
  col = mix(col, vec3(0.82, 0.27, 0.1), smoothstep(0.38, 0.7, heat));
  col = mix(col, vec3(1.0, 0.72, 0.36), smoothstep(0.7, 1.0, heat));
  col = mix(col, vec3(1.0, 0.93, 0.8), smoothstep(1.02, 1.2, heat));
  // faint isotherms: the field reads as a measurement, not just decoration
  float band = fract(heat * 8.0);
  float line = smoothstep(0.06, 0.0, band) * step(0.15, heat) * (1.0 - smoothstep(0.9, 1.1, heat));
  col += vec3(1.0, 0.62, 0.32) * line * 0.16;
  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

export function FireField({ running = true }: { running?: boolean } = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const fallback = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false });
    if (!gl || gl.isContextLost()) {
      fallback.current = true;
      canvas.style.display = "none";
      return;
    }
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn("[4forces] shader:", gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FIRE_FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[4forces] fire shader unavailable, using CSS fallback:", gl.getProgramInfoLog(prog));
      canvas.style.display = "none";
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const mouse = { x: -5, y: -5 };

    // render at reduced resolution: the field is soft, so this is invisible and much cheaper
    const SCALE = 0.5;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * SCALE));
      canvas.height = Math.max(1, Math.round(r.height * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const render = (time: number) => {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    let raf = 0;
    let visible = false;
    const t0 = performance.now();
    const loop = () => {
      render((performance.now() - t0) / 1000 + 20);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (reduced || !running) return render(24);
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const ro = new ResizeObserver(() => {
      resize();
      render(24);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = 1 - (e.clientY - r.top) / r.height;
    };
    const onVis = () => (document.hidden ? stop() : start());
    canvas.addEventListener("pointermove", onMove);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      // Context is released when the canvas unmounts. Don't force-lose it here: a re-run
      // of this effect on the same canvas would get the dead context back.
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, [reduced, running]);

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_110%,#e0652a_0%,#5a1408_40%,#04060d_75%)]"
      />
      <canvas ref={ref} aria-hidden="true" className={`${canvasClass} [image-rendering:auto]`} />
    </>
  );
}
