import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCanvasLoop, useInView, useReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/** A region the "AI" locks onto. Coordinates are percentages of the source image. */
export interface Detection {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  detail?: string;
  /** where the message capsule sits relative to the box (default: right, or left if no room) */
  at?: "right" | "left" | "below" | "inside";
}

export interface Reading {
  title: string;
  /** 0–100 */
  confidence: number;
  caption: string;
}

interface ScanViewProps {
  /** Photo to scan. Omit to scan `background` instead (percentages then refer to the panel). */
  src?: string;
  natural?: { w: number; h: number };
  position?: [number, number];
  alt?: string;
  background?: ReactNode;
  detections: Detection[];
  reading: Reading;
  accent: string;
  onCycleEnd?: () => void;
}

type Phase = "scan" | "lock" | "reset";

function capsulePosition(at: NonNullable<Detection["at"]>, b: { left: number; top: number; width: number; height: number }, w: number, labelInside: boolean) {
  switch (at) {
    case "left":
      return { right: w - b.left + 12, top: Math.max(8, b.top + 6) };
    case "below":
      return { left: b.left, top: b.top + b.height + 10 };
    case "inside":
      return { left: b.left + 10, top: b.top + b.height - 42 };
    default:
      return { left: b.left + b.width + 12, top: Math.max(8, labelInside ? b.top + 34 : b.top + 6) };
  }
}
const SCAN_MS = 2600;
const HOLD_MS = 5600;
const RESET_MS = 700;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * "AI vision" treatment for a photo: a scan line sweeps the frame, glitch tiles break the
 * image apart along it, detected regions lock into crisp windows with brackets and glass
 * message capsules, and a reading capsule counts up. Purely illustrative — see the label.
 */
export function ScanView({
  src,
  natural,
  position = [0.5, 0.5],
  alt = "",
  background,
  detections,
  reading,
  accent,
  onCycleEnd,
}: ScanViewProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(wrap);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>(reduced ? "lock" : "scan");
  const [cycle, setCycle] = useState(0);
  const [count, setCount] = useState(reduced ? reading.confidence : 0);
  const cycleEnd = useRef(onCycleEnd);
  cycleEnd.current = onCycleEnd;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // object-fit: cover mapping from image percentages to panel pixels
  const boxes: Box[] = useMemo(() => {
    const nw = natural?.w ?? size.w;
    const nh = natural?.h ?? size.h;
    if (!size.w || !nw) return detections.map(() => ({ left: 0, top: 0, width: 0, height: 0 }));
    const s = Math.max(size.w / nw, size.h / nh);
    const ox = (size.w - nw * s) * position[0];
    const oy = (size.h - nh * s) * position[1];
    return detections.map((d) => {
      const left = ox + (d.x / 100) * nw * s;
      const top = oy + (d.y / 100) * nh * s;
      const width = (d.w / 100) * nw * s;
      const height = (d.h / 100) * nh * s;
      // clamp to the visible (cropped) frame; drop regions that are mostly cropped away
      const l = Math.max(6, left);
      const t = Math.max(6, top);
      const r = Math.min(size.w - 6, left + width);
      const b = Math.min(size.h - 6, top + height);
      const visible = Math.max(0, r - l) * Math.max(0, b - t);
      if (visible < width * height * 0.55) return { left: 0, top: 0, width: 0, height: 0 };
      return { left: l, top: t, width: r - l, height: b - t };
    });
  }, [detections, natural, position, size]);

  // phase timeline: scan → lock (hold) → reset → next cycle
  useEffect(() => {
    if (reduced) {
      setPhase("lock");
      setCount(reading.confidence);
      return;
    }
    if (!inView) return;
    const ms = phase === "scan" ? SCAN_MS : phase === "lock" ? HOLD_MS : RESET_MS;
    const t = window.setTimeout(() => {
      if (phase === "scan") setPhase("lock");
      else if (phase === "lock") {
        setPhase("reset");
        cycleEnd.current?.();
      } else {
        setCount(0);
        setCycle((c) => c + 1);
        setPhase("scan");
      }
    }, ms);
    return () => window.clearTimeout(t);
  }, [phase, inView, reduced, reading.confidence]);

  // count the reading up once the scan has locked
  useEffect(() => {
    if (phase !== "lock" || reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      setCount(Math.round(reading.confidence * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, reading.confidence, reduced]);

  // low-res copy of the photo for pixelated glitch tiles
  const mosaic = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const m = document.createElement("canvas");
      m.width = 72;
      m.height = Math.max(1, Math.round((72 * img.naturalHeight) / img.naturalWidth));
      m.getContext("2d")?.drawImage(img, 0, 0, m.width, m.height);
      mosaic.current = m;
    };
    img.src = src;
  }, [src]);

  const phaseStart = useRef(performance.now());
  useEffect(() => {
    phaseStart.current = performance.now();
  }, [phase, cycle]);

  useCanvasLoop(
    canvas,
    ({ ctx, w, h }) => {
      ctx.clearRect(0, 0, w, h);
      if (reduced) return;
      const elapsed = performance.now() - phaseStart.current;
      const m = mosaic.current;
      const nw = natural?.w ?? w;
      const nh = natural?.h ?? h;
      const s = Math.max(w / nw, h / nh);
      const ox = (w - nw * s) * position[0];
      const oy = (h - nh * s) * position[1];

      const block = (x: number, y: number, bw: number, bh: number, shift: number) => {
        if (m) {
          // sample the matching patch of the low-res photo and blow it up — macroblocks
          const sx = ((x - ox) / (nw * s)) * m.width;
          const sy = ((y - oy) / (nh * s)) * m.height;
          const sw = Math.max(1, (bw / (nw * s)) * m.width);
          const sh = Math.max(1, (bh / (nh * s)) * m.height);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(m, sx, sy, sw, sh, x + shift, y, bw, bh);
        }
        if (Math.random() < 0.55) {
          // normal-map style iridescent tint
          const g = ctx.createLinearGradient(x, y, x + bw, y + bh);
          g.addColorStop(0, "rgba(143,123,255,0.55)");
          g.addColorStop(0.5, "rgba(101,217,242,0.45)");
          g.addColorStop(1, "rgba(240,138,216,0.5)");
          ctx.globalCompositeOperation = m ? "color" : "source-over";
          ctx.fillStyle = g;
          ctx.fillRect(x + shift, y, bw, bh);
          ctx.globalCompositeOperation = "source-over";
        }
      };

      if (phase === "scan") {
        const y = (elapsed / SCAN_MS) * h;
        const n = w < 600 ? 8 : 14;
        for (let i = 0; i < n; i++) {
          const bh = 6 + Math.random() * 26;
          const by = y - 70 + Math.random() * 90;
          const bw = 30 + Math.random() * Math.min(220, w * 0.3);
          block(Math.random() * (w - bw), by, bw, bh, (Math.random() - 0.5) * 30);
        }
        // regions just before they lock break up first
        boxes.forEach((b) => {
          if (!b.width) return;
          const cy = b.top + b.height / 2;
          if (Math.abs(cy - y) < 70) {
            for (let i = 0; i < 4; i++) {
              const bw = b.width * (0.2 + Math.random() * 0.5);
              const bh = b.height * (0.08 + Math.random() * 0.2);
              block(b.left + Math.random() * (b.width - bw), b.top + Math.random() * (b.height - bh), bw, bh, (Math.random() - 0.5) * 12);
            }
          }
        });
      } else if (phase === "lock") {
        // the model keeps "looking": brief flickers inside a locked region
        const shown = boxes.filter((b) => b.width > 0);
        if (elapsed % 1700 < 110 && shown.length) {
          const b = shown[Math.floor(elapsed / 1700) % shown.length];
          for (let i = 0; i < 3; i++) {
            const bw = b.width * (0.15 + Math.random() * 0.3);
            const bh = b.height * (0.06 + Math.random() * 0.12);
            block(b.left + Math.random() * (b.width - bw), b.top + Math.random() * (b.height - bh), bw, bh, 0);
          }
        }
      }
    },
    { reducedMotion: false, running: inView && !reduced },
  );

  // windows open one frame after the scan starts so the CSS transition runs, each delayed
  // until the scan line reaches it
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (phase !== "scan") return;
    setArmed(false);
    let r2 = 0;
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setArmed(true))));
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [phase, cycle]);

  const locked = phase === "lock";
  const open = reduced || locked || (phase === "scan" && armed);
  const delayFor = (b: Box) =>
    phase === "scan" && size.h ? Math.max(0, ((b.top + b.height / 2) / size.h) * SCAN_MS - 150) : 0;
  const clip = (b: Box, full: boolean) =>
    full
      ? `inset(${b.top}px ${size.w - b.left - b.width}px ${size.h - b.top - b.height}px ${b.left}px round 6px)`
      : `inset(${b.top + b.height / 2}px ${size.w - b.left - b.width / 2}px ${size.h - b.top - b.height / 2}px ${b.left + b.width / 2}px round 6px)`;

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden">
      {/* base */}
      <div
        className="absolute inset-0 transition-[filter] duration-700"
        style={{
          filter: src
            ? locked
              ? "brightness(0.42) saturate(0.45)"
              : phase === "scan"
                ? "brightness(0.78) saturate(0.85)"
                : "brightness(0.6)"
            : locked
              ? "brightness(0.8)"
              : "none",
        }}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: `${position[0] * 100}% ${position[1] * 100}%` }}
          />
        ) : (
          background
        )}
      </div>

      {/* crisp, full-colour windows on detected regions */}
      {src &&
        boxes.map((b, i) => b.width > 0 && (
          <img
            key={i}
            src={src}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover transition-[clip-path] duration-500 ease-[var(--ease-out-expo)]"
            style={{
              objectPosition: `${position[0] * 100}% ${position[1] * 100}%`,
              clipPath: clip(b, open),
              transitionDelay: `${open ? delayFor(b) : 0}ms`,
            }}
          />
        ))}

      <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 h-full w-full" />

      {/* scan line */}
      {phase === "scan" && !reduced && (
        <div key={cycle} aria-hidden="true" className="absolute inset-x-0 h-24 -translate-y-full [animation:scan-sweep_2600ms_linear_both]">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-cyan/15" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-cyan shadow-[0_0_18px_2px_rgba(101,217,242,0.7)]" />
        </div>
      )}

      {/* brackets, labels and glass message capsules */}
      {boxes.map((b, i) => {
        if (!b.width) return null;
        const d = detections[i];
        const right = b.left + b.width + 230 < size.w;
        const labelInside = b.top < 30;
        return (
          <div key={i} aria-hidden="true">
            <div
              className={cn("absolute transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
              style={{ left: b.left, top: b.top, width: b.width, height: b.height, transitionDelay: `${open ? delayFor(b) + 150 : 0}ms` }}
            >
              {[
                "left-0 top-0 border-l-2 border-t-2 rounded-tl-md",
                "right-0 top-0 border-r-2 border-t-2 rounded-tr-md",
                "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-md",
                "right-0 bottom-0 border-r-2 border-b-2 rounded-br-md",
              ].map((c) => (
                <span key={c} className={cn("absolute size-4", c)} style={{ borderColor: accent }} />
              ))}
              <span className="absolute inset-0 rounded-md border border-white/10" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm leading-none" style={{ color: accent }}>
                +
              </span>
              <span
                className={cn(
                  "absolute left-0 whitespace-nowrap rounded-[5px] px-1.5 py-0.5 text-[11.5px] font-medium text-abyss",
                  labelInside ? "left-2 top-2" : "-top-6",
                )}
                style={{ background: accent }}
              >
                {d.label}
              </span>
            </div>
            {d.detail && locked && (
              <div
                className="glass-capsule absolute hidden whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] text-foam sm:block"
                style={{
                  ...capsulePosition(d.at ?? (right ? "right" : "left"), b, size.w, labelInside),
                  animation: `cloud-in 600ms var(--ease-out-expo) ${250 + i * 220}ms both`,
                }}
              >
                {d.detail}
              </div>
            )}
          </div>
        );
      })}

      {/* reading capsule */}
      <div
        className={cn(
          "glass-capsule absolute bottom-4 left-4 flex items-center gap-3 rounded-full py-2 pl-2 pr-5 transition-[opacity,transform] duration-500 sm:bottom-6 sm:left-6",
          locked || reduced ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
        style={{ transitionDelay: locked ? "450ms" : "0ms" }}
      >
        <span
          aria-hidden="true"
          className="relative size-9 shrink-0 rounded-full"
          style={{ background: `radial-gradient(circle at 35% 30%, #fff 0%, ${accent} 35%, #2868ff 75%, #06152f 100%)`, boxShadow: `0 0 24px ${accent}` }}
        />
        <span className="leading-tight">
          <span className="block text-[13px] text-mist">{reading.title}</span>
          <span className="block text-[17px] font-semibold tracking-[-0.02em] text-foam">
            <span className="tabular-nums">{count}%</span> <span className="text-[13px] font-normal text-mist">{reading.caption}</span>
          </span>
        </span>
      </div>
    </div>
  );
}
