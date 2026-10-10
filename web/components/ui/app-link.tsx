import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { APP_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

interface AppLinkProps {
  variant?: "primary" | "outline" | "compact";
  className?: string;
  children?: ReactNode;
  /** Short context for assistive tech, e.g. "to test the alert speaker" */
  context?: string;
}

/**
 * Every "Go to the App" CTA on the site renders through this component so they share
 * one destination (APP_URL from lib/config.ts / VITE_APP_URL).
 */
export function AppLink({ variant = "primary", className, children = "Go to the App", context }: AppLinkProps) {
  return (
    <a
      href={APP_URL}
      aria-label={context ? `Go to the 4forces app ${context}` : undefined}
      data-app-link
      className={cn(
        "group relative inline-flex items-center justify-center gap-3 overflow-hidden font-medium tracking-[-0.01em] transition-[background-color,color,box-shadow,transform] duration-300 ease-[var(--ease-out-expo)] active:scale-[0.98]",
        variant === "primary" &&
          "h-14 rounded-[14px] bg-foam pl-6 pr-2 text-[1.0625rem] text-abyss shadow-[0_0_0_1px_rgba(255,255,255,0.4),0_18px_60px_-12px_rgba(101,217,242,0.55)] hover:bg-white hover:shadow-[0_0_0_1px_rgba(255,255,255,0.7),0_22px_70px_-10px_rgba(101,217,242,0.8)]",
        variant === "outline" &&
          "h-14 rounded-[14px] border border-foam/25 pl-6 pr-2 text-[1.0625rem] text-foam hover:border-foam/60 hover:bg-foam/5",
        variant === "compact" &&
          "h-10 rounded-[10px] bg-foam pl-4 pr-1.5 text-sm text-abyss hover:bg-white",
        className,
      )}
    >
      {/* sweep of light on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-cyan/40 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100"
      />
      <span className="relative">{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-[10px] transition-colors",
          variant === "compact" ? "size-7 rounded-[7px] bg-abyss text-foam" : "size-10",
          variant === "primary" && "bg-abyss text-cyan",
          variant === "outline" && "bg-foam/10 text-foam",
        )}
      >
        <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-6 group-hover:translate-x-6" />
        <ArrowUpRight className="absolute size-4 -translate-x-6 translate-y-6 transition-transform duration-300 group-hover:translate-x-0 group-hover:translate-y-0" />
      </span>
    </a>
  );
}
