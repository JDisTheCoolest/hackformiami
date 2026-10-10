import { useState } from "react";
import { EyeMark, type EyeMood } from "@/components/brand/EyeMark";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  mood?: EyeMood;
  track?: boolean;
  href?: string;
}

/** "4forces" — the o is the EyeMark character. Reads as a single word for screen readers. */
export function Wordmark({ className, mood, track = true, href }: WordmarkProps) {
  const [hover, setHover] = useState(false);
  const content = (
    <span
      aria-hidden="true"
      className="inline-flex items-baseline font-sans font-semibold tracking-[-0.045em] leading-none"
    >
      <span>4f</span>
      <EyeMark
        className="mx-[0.02em] h-[0.74em] w-[0.74em] translate-y-[0.03em] self-baseline"
        mood={mood ?? (hover ? "curious" : "idle")}
        track={track}
      />
      <span>rces</span>
    </span>
  );
  const shared = {
    className: cn("inline-flex items-center", className),
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
    onFocus: () => setHover(true),
    onBlur: () => setHover(false),
  };
  return href ? (
    <a href={href} aria-label="4forces — home" {...shared}>
      {content}
    </a>
  ) : (
    <span role="img" aria-label="4forces" {...shared}>
      {content}
    </span>
  );
}
