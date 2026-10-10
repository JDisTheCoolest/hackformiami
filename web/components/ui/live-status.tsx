import { useLiveData } from "@/lib/live-data";
import { cn } from "@/lib/utils";

/** Honest one-line connection status for the 4forces backend. */
export function LiveStatus({ className }: { className?: string }) {
  const { health } = useLiveData();
  const state =
    health.status === "loading"
      ? { dot: "bg-mist animate-pulse", text: "Connecting to the 4forces API…" }
      : health.status === "ok"
        ? {
            dot: "bg-sev-none",
            text: health.data.mock
              ? "API online · AI analysis in mock mode"
              : `API online · AI analysis by ${health.data.model}`,
          }
        : { dot: "bg-dim", text: "API offline · showing sample data" };
  return (
    <p role="status" className={cn("label-sm flex items-center gap-2 text-mist", className)}>
      <span className="relative flex size-2">
        {health.status === "ok" && (
          <span className="absolute inset-0 rounded-full bg-sev-none [animation:pulse-ring_2.4s_ease-out_infinite]" />
        )}
        <span className={cn("relative size-2 rounded-full", state.dot)} />
      </span>
      {state.text}
    </p>
  );
}

const PROVENANCE_LABEL = {
  live: "Live",
  official: "Official source",
  sample: "Sample data",
  illustrative: "Illustrative",
  planned: "Planned",
} as const;

export function ProvenanceTag({
  kind,
  className,
  children,
}: {
  kind: keyof typeof PROVENANCE_LABEL;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "label-sm inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-0.5 text-[0.625rem]",
        kind === "live" && "border-sev-none/40 text-sev-none",
        kind === "official" && "border-cyan/40 text-cyan",
        kind === "sample" && "border-sev-low/40 text-sev-low",
        kind === "illustrative" && "border-mist/30 text-mist",
        kind === "planned" && "border-dim/40 text-dim",
        className,
      )}
    >
      {kind === "live" && <span className="size-1.5 rounded-full bg-sev-none" />}
      {children ?? PROVENANCE_LABEL[kind]}
    </span>
  );
}
