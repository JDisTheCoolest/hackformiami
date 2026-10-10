import { useEffect, useRef, useState, type RefObject } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function useInView<T extends Element>(ref: RefObject<T | null>, rootMargin = "0px", once = false) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) io.disconnect();
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, once]);
  return inView;
}

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D;
  /** CSS pixel size */
  w: number;
  h: number;
  /** seconds since start */
  t: number;
  /** seconds since previous frame (capped) */
  dt: number;
}

/**
 * Runs a 2D canvas render loop only while the canvas is on screen and the tab is visible.
 * With reduced motion, renders a single still frame (re-rendered on resize).
 */
export function useCanvasLoop(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  draw: (frame: CanvasFrame) => void,
  opts: { reducedMotion: boolean; maxDpr?: number; stillTime?: number; running?: boolean } = { reducedMotion: false },
) {
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const { reducedMotion, maxDpr = 2, stillTime = 4, running = true } = opts;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = false;
    let last = performance.now();
    let t = stillTime;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reducedMotion || !visible) drawRef.current({ ctx, w, h, t, dt: 0 });
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      drawRef.current({ ctx, w, h, t, dt });
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!running || reducedMotion || raf || document.hidden || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    resize();
    drawRef.current({ ctx, w, h, t, dt: 0 });

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [canvasRef, reducedMotion, maxDpr, stillTime, running]);
}

/** 0 → 1 progress of an element scrolling through the viewport (for subtle scroll-linked effects). */
export function useScrollProgress<T extends HTMLElement>(ref: RefObject<T | null>, enabled = true) {
  const progress = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      progress.current = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref, enabled]);
  return progress;
}
