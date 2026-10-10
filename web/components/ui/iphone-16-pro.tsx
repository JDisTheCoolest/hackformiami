/**
 * iPhone 16 Pro SVG frame.
 * Adapted from "iphone-16-pro" by designali-in on 21st.dev (MIT License).
 * Changes for 4forces:
 *  - viewBox is fixed at 0 0 200 400 (the paths are drawn in that space), so width/height
 *    only set the rendered size and the frame scales correctly.
 *  - clip-path id is unique per instance (useId) — safe with several phones on one page.
 *  - optional `children` render real HTML inside the screen (see PhoneFrame).
 */
import { useId, type ReactNode, type SVGProps } from "react";
import { cn } from "@/lib/utils";

export interface Iphone16ProProps extends SVGProps<SVGSVGElement> {
  width?: number | string;
  height?: number | string;
  src?: string;
  /** Paint the screen rect. Disable when HTML content sits underneath the frame. */
  screen?: boolean;
}

export const SCREEN = { x: 14.08, y: 12.81, w: 171.98, h: 374.37, r: 24.62 };

export function Iphone16Pro({ width = 200, height = 400, src, screen = true, ...props }: Iphone16ProProps) {
  const clipId = `iphone-screen-${useId().replace(/:/g, "")}`;
  return (
    <svg width={width} height={height} viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        fill="#2b2f36"
        d="M196.11,128.09c0-.25-.2-.45-.45-.45-.11.04-.37.03-.69,0V36.69c0-17.84-14.46-32.31-32.31-32.31H37.48C19.63,4.39,5.17,18.85,5.17,36.69v48.99c-.3.02-.55.03-.66-.02-.25,0-.45.2-.45.45,0,0,0,17.29,0,17.29-.03.41.5.49,1.11.48v13.63c-.61,0-1.14.08-1.11.48,0,0,0,28.54,0,28.54-.03.42.5.49,1.11.48v7.95c-.61,0-1.14.08-1.11.48,0,0,0,28.54,0,28.54-.03.42.5.49,1.11.48v178.86c0,17.84,14.46,32.31,32.31,32.31h125.2c17.84,0,32.31-14.46,32.31-32.31v-188.87c.32-.02.58-.03.69.04,1.26.1.03-45.94.45-46.38ZM186.07,362.63c0,13.56-10.99,24.56-24.56,24.56H38.64c-13.56,0-24.56-10.99-24.56-24.56V37.37c0-13.56,10.99-24.56,24.56-24.56h122.87c13.56,0,24.56,10.99,24.56,24.56v325.26Z"
      />
      <path
        fill="#000000"
        d="M161.38,7.29H38.78c-16.54,0-29.95,13.41-29.95,29.95v325.52c0,16.54,13.41,29.95,29.95,29.95h122.6c16.54,0,29.95-13.41,29.95-29.95V37.24c0-16.54-13.41-29.95-29.95-29.95ZM186.07,362.57c0,13.6-11.02,24.62-24.62,24.62H38.7c-13.6,0-24.62-11.02-24.62-24.62V37.43c0-13.6,11.02-24.62,24.62-24.62h122.75c13.6,0,24.62,11.02,24.62,24.62v325.14Z"
      />
      {screen && <rect fill="currentColor" x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx={SCREEN.r} ry={SCREEN.r} />}
      {src && (
        <image
          href={src}
          x={SCREEN.x}
          y={SCREEN.y}
          width={SCREEN.w}
          height={SCREEN.h}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      )}
      <path fill="#000000" d="M119.61,33.86h-38.93c-10.48-.18-10.5-15.78,0-15.96,0,0,38.93,0,38.93,0,4.41,0,7.98,3.57,7.98,7.98,0,4.41-3.57,7.98-7.98,7.98Z" />
      <path fill="#080d4c" d="M118.78,29.21c-4.32.06-4.32-6.73,0-6.66,4.32-.06,4.32,6.73,0,6.66Z" />
      <defs>
        <clipPath id={clipId}>
          <rect x={SCREEN.x} y={SCREEN.y} width={SCREEN.w} height={SCREEN.h} rx={SCREEN.r} ry={SCREEN.r} />
        </clipPath>
      </defs>
    </svg>
  );
}

/** Phone frame with live HTML content clipped to the screen, under the dynamic island. */
export function PhoneFrame({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <figure className={cn("relative aspect-[1/2]", className)} aria-label={label}>
      <div
        className="absolute overflow-hidden bg-abyss"
        style={{
          left: pct(SCREEN.x, 200),
          top: pct(SCREEN.y, 400),
          width: pct(SCREEN.w, 200),
          height: pct(SCREEN.h, 400),
          borderRadius: `${pct(SCREEN.r, SCREEN.w)} / ${pct(SCREEN.r, SCREEN.h)}`,
        }}
      >
        {children}
      </div>
      <Iphone16Pro width="100%" height="100%" screen={false} className="pointer-events-none absolute inset-0" aria-hidden="true" />
    </figure>
  );
}
