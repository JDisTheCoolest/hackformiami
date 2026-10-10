import { ArrowUp, ImagePlus, Mic, MicOff, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { OrbCanvas, type OrbState } from "@/components/visuals/OrbCanvas";
import { AppLink } from "@/components/ui/app-link";
import { ProvenanceTag } from "@/components/ui/live-status";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { answer, detectForce, type AssistantAnswer } from "@/lib/assistant";
import { useReducedMotion } from "@/lib/hooks";
import { useLiveData } from "@/lib/live-data";
import { cn } from "@/lib/utils";
import type { ForceId } from "@/types";

const EXAMPLES = [
  "What hazards should I know about in Miami?",
  "Is my neighborhood at risk of flooding?",
  "What environmental alerts are active near me?",
  "Explain the difference between a flood warning and a flood watch.",
  "Is the wind getting stronger?",
];

const MAX_IMAGE_MB = 10; // same limit as the backend's report upload

const GLOW: Record<ForceId | "none", string> = {
  water: "rgba(101,217,242,0.55)",
  air: "rgba(207,220,242,0.5)",
  land: "rgba(157,180,138,0.55)",
  fire: "rgba(255,138,61,0.55)",
  none: "rgba(40,104,255,0.45)",
};

// Minimal typing for the Web Speech API (not in TS's DOM lib).
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognitionLike;
const getSpeechCtor = (): SpeechCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

function renderRich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i} className="font-semibold text-foam">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export function Assistant() {
  const live = useLiveData();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState<"idle" | "listening" | "processing" | "responding" | "error">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ q: string; a: AssistantAnswer } | null>(null);
  const [image, setImage] = useState<{ url: string; name: string; size: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const level = useRef(0);
  const audioCleanup = useRef<(() => void) | null>(null);
  const timer = useRef<number>(0);

  const orbState: OrbState =
    phase === "idle" ? (focused || query ? "focused" : "idle") : phase === "listening" ? "listening" : phase;
  const force = detectForce(query) ?? result?.a.force ?? (image ? "water" : null);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      recRef.current?.abort();
      audioCleanup.current?.();
    },
    [],
  );
  useEffect(() => () => void (image && URL.revokeObjectURL(image.url)), [image]);

  const submit = (text = query) => {
    const q = text.trim();
    if (!q && !image) {
      setNotice("Type a question, use the microphone, or attach a photo.");
      inputRef.current?.focus();
      return;
    }
    setNotice(null);
    setPhase("processing");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        setResult({ q: q || "Photo attached", a: answer(q, live, Boolean(image)) });
        setPhase("responding");
      },
      reduced ? 200 : 1300,
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const stopListening = () => {
    recRef.current?.stop();
    audioCleanup.current?.();
    audioCleanup.current = null;
    level.current = 0;
  };

  const startListening = async () => {
    if (phase === "listening") return stopListening();
    const Ctor = getSpeechCtor();
    if (!Ctor) {
      setPhase("error");
      setNotice("Voice input isn't supported in this browser. You can still type your question.");
      window.setTimeout(() => setPhase("idle"), 2400);
      return;
    }
    setNotice(null);
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = text;
      }
      setQuery(text);
    };
    rec.onerror = (e) => {
      const blocked = e.error === "not-allowed" || e.error === "service-not-allowed";
      setNotice(
        blocked
          ? "Microphone access was blocked. You can allow it in your browser settings, or type instead."
          : e.error === "no-speech"
            ? "I didn't hear anything. Try again or type your question."
            : `Voice input stopped (${e.error}). You can type your question instead.`,
      );
      setPhase("error");
      window.setTimeout(() => setPhase((p) => (p === "error" ? "idle" : p)), 2400);
    };
    rec.onend = () => {
      audioCleanup.current?.();
      audioCleanup.current = null;
      level.current = 0;
      recRef.current = null;
      if (finalText.trim()) submit(finalText);
      else setPhase((p) => (p === "listening" ? "idle" : p));
    };
    recRef.current = rec;
    try {
      rec.start(); // the browser asks for microphone permission here, only after the click
      setPhase("listening");
    } catch {
      setPhase("error");
      setNotice("Couldn't start voice input. You can type your question instead.");
      return;
    }
    // Optional: drive the orb's pulse from the input level. Fails silently if unavailable.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recRef.current !== rec) {
        // recognition already ended while we waited for the stream — release the mic immediately
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const ac = new AudioContext();
      const an = ac.createAnalyser();
      an.fftSize = 256;
      ac.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      let raf = 0;
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += (v - 128) ** 2;
        level.current = Math.min(1, Math.sqrt(sum / buf.length) / 30);
        raf = requestAnimationFrame(tick);
      };
      tick();
      audioCleanup.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        void ac.close();
      };
    } catch {
      /* level meter is decorative */
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("That file isn't an image. Choose a JPG, PNG, WebP or HEIC photo.");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setNotice(`That photo is larger than ${MAX_IMAGE_MB} MB. Choose a smaller one.`);
      return;
    }
    setNotice(null);
    setImage({ url: URL.createObjectURL(file), name: file.name, size: file.size });
  };

  const removeImage = () => {
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const statusText =
    phase === "listening"
      ? "Listening… tap the microphone again to stop."
      : phase === "processing"
        ? "Thinking…"
        : phase === "responding"
          ? "Answer ready."
          : phase === "error"
            ? (notice ?? "Something went wrong.")
            : focused
              ? "Ask about flooding, tides, alerts, wind, fire — or attach a photo."
              : "Ready.";

  return (
    <section id="assistant" aria-labelledby="assistant-title" className="relative overflow-hidden border-t hairline bg-abyss py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_35%,rgba(40,104,255,0.16),transparent_70%)]" />
      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionLabel className="justify-center">Live demo · Ask 4forces</SectionLabel>
          <h2 id="assistant-title" className="mt-5 text-balance text-4xl font-semibold leading-[1] tracking-[-0.04em] text-foam sm:text-6xl">
            Ask the city what it&rsquo;s feeling.
          </h2>
          <p className="mt-5 text-mist">
            A preview of the 4forces assistant. Type, speak or attach a photo. Answers are marked{" "}
            <em className="not-italic text-foam">live</em> only when they come from real data.
          </p>
        </Reveal>

        <div className="mt-10 grid items-start gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="relative mx-auto aspect-square w-full max-w-[30rem]">
              <OrbCanvas key={reduced ? orbState : "orb"} state={orbState} level={level} />
              <p className="label-sm absolute inset-x-0 top-3 text-center text-dim">
                <span className="sr-only">Assistant state: </span>
                {orbState}
              </p>
            </div>

            <form onSubmit={onSubmit} className="relative mx-auto -mt-4 max-w-[38rem]" aria-describedby="assistant-status">
              {/* voice-glow: the composer's lower edge lights up in the colour of the force being discussed */}
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute -inset-x-6 -bottom-6 h-24 rounded-full blur-2xl transition-opacity duration-700",
                  phase === "listening" || phase === "processing" || focused ? "opacity-100" : "opacity-40",
                )}
                style={{ background: `radial-gradient(60% 60% at 50% 70%, ${GLOW[force ?? "none"]}, transparent 70%)` }}
              />
              <div className="relative rounded-2xl border border-foam/15 bg-deep/80 p-2 backdrop-blur-xl transition-colors focus-within:border-foam/35">
                {image && (
                  <div className="mb-2 flex items-center gap-3 rounded-xl border hairline bg-abyss/60 p-2">
                    <img src={image.url} alt="Your attached photo (preview)" className="size-14 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foam">{image.name}</p>
                      <p className="text-xs text-dim">{(image.size / 1024 / 1024).toFixed(1)} MB · stays on this device</p>
                    </div>
                    <button type="button" onClick={() => fileRef.current?.click()} className="grid size-10 place-items-center rounded-lg text-mist hover:bg-foam/10 hover:text-foam" aria-label="Replace photo">
                      <RefreshCw className="size-4" />
                    </button>
                    <button type="button" onClick={removeImage} className="grid size-10 place-items-center rounded-lg text-mist hover:bg-foam/10 hover:text-foam" aria-label="Remove photo">
                      <X className="size-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0])} />
                  <button type="button" onClick={() => fileRef.current?.click()} className="grid size-11 shrink-0 place-items-center rounded-xl text-mist transition-colors hover:bg-foam/10 hover:text-foam" aria-label={image ? "Replace attached photo" : "Attach a photo"}>
                    <ImagePlus className="size-5" />
                  </button>
                  <label htmlFor="assistant-input" className="sr-only">
                    Ask 4forces a question
                  </label>
                  <input
                    ref={inputRef}
                    id="assistant-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="Is my neighborhood at risk of flooding?"
                    autoComplete="off"
                    className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[1rem] text-foam placeholder:text-dim focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={startListening}
                    aria-pressed={phase === "listening"}
                    aria-label={phase === "listening" ? "Stop voice input" : "Ask with your voice"}
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-xl transition-colors",
                      phase === "listening" ? "bg-cyan/20 text-cyan" : "text-mist hover:bg-foam/10 hover:text-foam",
                    )}
                  >
                    {phase === "listening" ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                  </button>
                  <button
                    type="submit"
                    disabled={phase === "processing"}
                    aria-label="Ask"
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-foam text-abyss transition-[background-color,transform] hover:bg-white active:scale-95 disabled:opacity-50"
                  >
                    <ArrowUp className="size-5" />
                  </button>
                </div>
              </div>
              <p id="assistant-status" role="status" aria-live="polite" className={cn("mt-3 min-h-5 text-center text-sm", phase === "error" || notice ? "text-sev-moderate" : "text-dim")}>
                {notice && phase !== "error" ? notice : statusText}
              </p>
            </form>

            <ul className="mx-auto mt-4 flex max-w-[40rem] flex-wrap justify-center gap-2" aria-label="Example questions">
              {EXAMPLES.map((ex) => (
                <li key={ex}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(ex);
                      submit(ex);
                    }}
                    className="rounded-lg border hairline px-3 py-2 text-left text-sm text-mist transition-colors hover:border-foam/25 hover:text-foam"
                  >
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 lg:pt-16">
            <div aria-live="polite" className="min-h-[18rem] rounded-2xl border hairline bg-deep/50 p-6">
              {!result && phase !== "processing" && (
                <div className="flex h-full min-h-[15rem] flex-col justify-between">
                  <p className="label-sm text-dim">Response</p>
                  <p className="text-mist">Answers appear here, with where the information came from.</p>
                  <div className="flex flex-wrap gap-2">
                    <ProvenanceTag kind="live">Live data</ProvenanceTag>
                    <ProvenanceTag kind="sample">Demo answer</ProvenanceTag>
                  </div>
                </div>
              )}
              {phase === "processing" && (
                <div className="space-y-3" aria-label="Thinking">
                  <p className="label-sm text-dim">Thinking</p>
                  {[90, 75, 82].map((w, i) => (
                    <div key={i} className="h-3 animate-pulse rounded bg-foam/10" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
              )}
              {result && phase !== "processing" && (
                <article className="[animation:stage-in_700ms_var(--ease-out-expo)_both]">
                  <div className="flex flex-wrap items-center gap-2">
                    {result.a.provenance === "live" ? (
                      <ProvenanceTag kind="live">Live data</ProvenanceTag>
                    ) : result.a.provenance === "unavailable" ? (
                      <ProvenanceTag kind="planned">Service unavailable</ProvenanceTag>
                    ) : (
                      <ProvenanceTag kind="sample">Demo answer</ProvenanceTag>
                    )}
                    {result.a.force && <span className="label-sm text-dim">{result.a.force}</span>}
                  </div>
                  <h3 className="mt-4 text-lg font-medium leading-snug text-foam">&ldquo;{result.q}&rdquo;</h3>
                  <div className="mt-3 space-y-3 text-[0.95rem] leading-relaxed text-mist">
                    {result.a.text.map((t, i) => (
                      <p key={i}>{renderRich(t)}</p>
                    ))}
                  </div>
                  {result.a.sources.length > 0 && (
                    <p className="mt-4 border-t hairline pt-3 text-xs text-dim">Source: {result.a.sources.join(" · ")}</p>
                  )}
                  {result.a.suggestApp && <AppLink variant="outline" className="mt-5" context="to see the live map and submit reports">Open the live map in the app</AppLink>}
                </article>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-dim">
              This website preview has no AI connection of its own and never uploads your photo — photos are analyzed
              only when you submit a report in the app. Voice input uses your browser&rsquo;s speech recognition, which
              in some browsers (such as Chrome) processes audio on the browser maker&rsquo;s servers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
