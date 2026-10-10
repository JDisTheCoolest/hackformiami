import { AlertTriangle, ArrowUp, Languages, SmilePlus, Users } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ProvenanceTag } from "@/components/ui/live-status";
import { Reveal, SectionLabel } from "@/components/ui/reveal";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/* ── Glass speech bubble whose unread count fills it with glossy spheres ── */
const SPHERES = [
  [44, 66], [60, 68], [76, 66], [36, 52], [52, 54], [68, 54], [84, 52], [46, 40], [62, 41], [78, 40],
];

function GlassBubble({ count }: { count: number }) {
  return (
    <div className="relative size-40">
      <svg viewBox="0 0 120 110" className="h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id="bubble-glass" cx="35%" cy="25%" r="80%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="0.6" stopColor="#a9b8d3" stopOpacity="0.08" />
            <stop offset="1" stopColor="#65d9f2" stopOpacity="0.12" />
          </radialGradient>
          <radialGradient id="sphere" cx="35%" cy="30%" r="70%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.35" stopColor="#9ff0ff" />
            <stop offset="1" stopColor="#2868ff" />
          </radialGradient>
          <clipPath id="bubble-clip">
            <ellipse cx="60" cy="50" rx="46" ry="38" />
          </clipPath>
        </defs>
        <g clipPath="url(#bubble-clip)">
          {SPHERES.slice(0, Math.min(count, SPHERES.length)).map(([x, y], i) => (
            <g key={i} className="[animation:sphere-drop_700ms_cubic-bezier(.3,1.4,.5,1)_both]" style={{ transformOrigin: `${x}px ${y}px` }}>
              <circle cx={x} cy={y} r="7.6" fill="url(#sphere)" />
              <ellipse cx={x - 2.4} cy={y - 3} rx="2.4" ry="1.5" fill="#fff" opacity="0.85" />
            </g>
          ))}
        </g>
        <path
          d="M60 12c25.4 0 46 17 46 38s-20.6 38-46 38c-5.6 0-11-.8-16-2.4-4.6 4.6-12 8.2-21 8.6 3.8-3.6 6.2-7.8 6.8-12.6C18.8 74.8 14 63 14 50c0-21 20.6-38 46-38Z"
          fill="url(#bubble-glass)"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="1.2"
        />
        <path d="M30 32c6-9 17-14 28-14" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </svg>
      <span className="absolute right-3 top-3 grid min-w-7 place-items-center rounded-full bg-sev-severe px-2 py-0.5 text-sm font-semibold tabular-nums text-white shadow-[0_6px_20px_rgba(255,77,77,0.5)]">
        {count}
      </span>
    </div>
  );
}

/* ── Example conversation ── */
const EMOJIS = ["⚠️", "🙏", "👍", "❤️", "😮"];

interface Msg {
  id: string;
  who: string;
  initials: string;
  color: string;
  time: string;
  text: string;
  translation?: string;
  photo?: string;
  system?: boolean;
  reactions: Record<string, number>;
}

const SCRIPT: Msg[] = [
  { id: "m1", who: "Maria G.", initials: "MG", color: "#65d9f2", time: "7:06 PM", text: "Water's over the curb on Brickell Bay Dr. Sent a report with a photo.", photo: "/assets/images/flooded-residential-street.jpg", reactions: { "👍": 4, "🙏": 2 } },
  { id: "m2", who: "Jean P.", initials: "JP", color: "#f2d14b", time: "7:09 PM", text: "Same at SE 8th St, a car just stalled. Going around via S Miami Ave.", reactions: { "⚠️": 6 } },
  { id: "m3", who: "4forces", initials: "4f", color: "#ff4d4d", time: "7:18 PM", text: "Flood alert · Brickell Bay Dr. 3 confident reports within 1 km. Avoid the area; never drive through flood water.", system: true, reactions: { "🙏": 9 } },
  { id: "m4", who: "Dev R.", initials: "DR", color: "#9db48a", time: "7:20 PM", text: "The Brickell Ave underpass is closed. Don't try it.", reactions: { "⚠️": 5, "❤️": 1 } },
  { id: "m5", who: "Mme. Joseph", initials: "MJ", color: "#f08ad8", time: "7:24 PM", text: "Mèsi pou avètisman an. M ap rete lakay mwen.", translation: "Thanks for the warning. I'm staying home.", reactions: { "🙏": 3 } },
  { id: "m6", who: "Camila S.", initials: "CS", color: "#8f7bff", time: "7:26 PM", text: "Anyone on 10th need help moving a car into the garage? I have space.", reactions: { "❤️": 7 } },
];

interface Flyer {
  id: number;
  emoji: string;
  x: number;
  y: number;
  dx: number;
  rot: number;
}

export function Community() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const listRef = useRef<HTMLOListElement>(null);
  const [visible, setVisible] = useState(reduced ? SCRIPT.length : 0);
  const [typing, setTyping] = useState(false);
  const [mine, setMine] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>(() =>
    Object.fromEntries(SCRIPT.map((m) => [m.id, { ...m.reactions }])),
  );
  const [myReacts, setMyReacts] = useState<Record<string, string[]>>({});
  const [picker, setPicker] = useState<string | null>(null);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [draft, setDraft] = useState("");

  // messages arrive one by one, with a typing indicator in between
  useEffect(() => {
    if (reduced || !inView || visible >= SCRIPT.length) return;
    setTyping(true);
    const t = window.setTimeout(() => {
      setTyping(false);
      setVisible((v) => v + 1);
    }, visible === 0 ? 600 : 1500);
    return () => window.clearTimeout(t);
  }, [visible, inView, reduced]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [visible, mine, typing, reduced]);

  const launch = (emoji: string, from: HTMLElement | null) => {
    if (!from || !ref.current || reduced) return;
    const a = from.getBoundingClientRect();
    const b = ref.current.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setFlyers((f) => [...f, { id, emoji, x: a.left - b.left + a.width / 2, y: a.top - b.top, dx: (Math.random() - 0.5) * 80, rot: (Math.random() - 0.5) * 60 }]);
    window.setTimeout(() => setFlyers((f) => f.filter((x) => x.id !== id)), 1300);
  };

  const react = (msgId: string, emoji: string, el: HTMLElement | null) => {
    const already = myReacts[msgId]?.includes(emoji);
    setReactions((r) => ({ ...r, [msgId]: { ...r[msgId], [emoji]: Math.max(0, (r[msgId]?.[emoji] ?? 0) + (already ? -1 : 1)) } }));
    setMyReacts((m) => ({ ...m, [msgId]: already ? m[msgId].filter((e) => e !== emoji) : [...(m[msgId] ?? []), emoji] }));
    if (!already) launch(emoji, el);
    setPicker(null);
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const id = `me${Date.now()}`;
    setMine((m) => [...m, { id, who: "You", initials: "You", color: "#eef4ff", time: "now", text, reactions: {} }]);
    setReactions((r) => ({ ...r, [id]: {} }));
    setDraft("");
  };

  const messages = [...SCRIPT.slice(0, visible), ...mine];

  return (
    <section id="community" aria-labelledby="community-title" className="relative overflow-hidden border-t hairline bg-[linear-gradient(180deg,#030814_0%,#06152f_100%)] py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-12 lg:px-10">
        <Reveal className="lg:col-span-5">
          <SectionLabel>Community</SectionLabel>
          <h2 id="community-title" className="mt-5 text-balance text-4xl font-semibold leading-[1] tracking-[-0.04em] text-foam sm:text-6xl">
            Warn the people <span className="text-cyan">around you.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-mist">
            Every alert area gets a neighborhood thread. Share what you see, confirm what others report, and react so the
            most useful warnings rise to the top, in English, Spanish or Haitian Creole.
          </p>
          <div className="mt-8 flex items-center gap-5">
            <GlassBubble count={messages.length} />
            <div>
              <p className="text-2xl font-semibold tabular-nums tracking-[-0.03em] text-foam">{messages.length} new</p>
              <p className="text-sm text-mist">from your block tonight</p>
            </div>
          </div>
          <ul className="mt-8 space-y-2 text-sm text-mist">
            <li className="flex items-center gap-2">
              <Users className="size-4 text-cyan" /> Threads follow alert areas, not follower lists
            </li>
            <li className="flex items-center gap-2">
              <Languages className="size-4 text-cyan" /> Messages translated between EN, ES and HT
            </li>
          </ul>
          <ProvenanceTag kind="planned" className="mt-8">
            Concept · planned for the app
          </ProvenanceTag>
        </Reveal>

        <Reveal className="lg:col-span-7" delay={120}>
          <div ref={ref} className="relative">
            <div aria-hidden="true" className="absolute -inset-8 rounded-[3rem] bg-[radial-gradient(closest-side,rgba(40,104,255,0.22),transparent)]" />
            <div className="relative overflow-hidden rounded-3xl border border-foam/10 bg-deep/70 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
              {/* header */}
              <div className="flex items-center gap-3 border-b border-foam/10 px-5 py-4">
                <div className="flex -space-x-2">
                  {SCRIPT.filter((m) => !m.system).slice(0, 4).map((m) => (
                    <span key={m.id} className="grid size-7 place-items-center rounded-full text-[10px] font-semibold text-abyss ring-2 ring-deep" style={{ background: m.color }}>
                      {m.initials}
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foam">Brickell Bay Dr · flood area</p>
                  <p className="text-xs text-mist">38 neighbors · 2 street cameras</p>
                </div>
                <ProvenanceTag kind="sample">Example conversation</ProvenanceTag>
              </div>

              {/* messages */}
              <ol ref={listRef} className="h-[30rem] space-y-4 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite" aria-label="Neighborhood thread">
                {messages.map((m) => {
                  const r = reactions[m.id] ?? {};
                  const me = m.who === "You";
                  return (
                    <li key={m.id} className={cn("flex gap-3 [animation:cloud-in_500ms_var(--ease-out-expo)_both]", me && "flex-row-reverse")}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-abyss" style={{ background: m.color }}>
                        {m.system ? <AlertTriangle className="size-4" /> : m.initials}
                      </span>
                      <div className={cn("group min-w-0 max-w-[85%]", me && "items-end text-right")}>
                        <p className="text-xs text-dim">
                          <span className="font-medium text-mist">{m.who}</span> · {m.time}
                        </p>
                        <div
                          className={cn(
                            "relative mt-1 inline-block rounded-2xl px-3.5 py-2.5 text-left text-[0.95rem] leading-snug",
                            m.system
                              ? "border border-sev-severe/40 bg-[linear-gradient(90deg,rgba(255,77,77,0.2),rgba(255,77,77,0.06))] text-foam"
                              : me
                                ? "rounded-tr-md bg-cyan text-abyss"
                                : "rounded-tl-md bg-foam/[0.07] text-foam",
                          )}
                        >
                          {m.photo && <img src={m.photo} alt="Flooded street photo shared by a neighbor" className="mb-2 h-32 w-full rounded-xl object-cover sm:w-72" />}
                          {m.text}
                          {m.translation && <span className="mt-1 block text-xs text-mist">Translated from Kreyòl: {m.translation}</span>}
                          {/* react button */}
                          {!me && (
                            <button
                              type="button"
                              aria-label={`React to ${m.who}'s message`}
                              aria-expanded={picker === m.id}
                              onClick={() => setPicker((p) => (p === m.id ? null : m.id))}
                              className="absolute -right-3 -top-3 grid size-7 place-items-center rounded-full border border-foam/15 bg-deep text-mist opacity-0 shadow-lg transition-opacity hover:text-foam focus-visible:opacity-100 group-hover:opacity-100"
                            >
                              <SmilePlus className="size-4" />
                            </button>
                          )}
                          {picker === m.id && (
                            <div role="menu" className="glass-capsule absolute -top-12 right-0 z-10 flex gap-1 rounded-full p-1 [animation:cloud-in_250ms_var(--ease-out-expo)_both]">
                              {EMOJIS.map((em) => (
                                <button
                                  key={em}
                                  type="button"
                                  role="menuitem"
                                  aria-label={`React with ${em}`}
                                  onClick={(e) => react(m.id, em, e.currentTarget)}
                                  className="grid size-8 place-items-center rounded-full text-lg transition-transform hover:scale-125"
                                >
                                  {em}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {Object.entries(r).some(([, n]) => n > 0) && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {Object.entries(r)
                              .filter(([, n]) => n > 0)
                              .map(([em, n]) => {
                                const mineR = myReacts[m.id]?.includes(em);
                                return (
                                  <button
                                    key={em}
                                    type="button"
                                    aria-pressed={mineR}
                                    aria-label={`${em} ${n}${mineR ? ", including you" : ""}`}
                                    onClick={(e) => react(m.id, em, e.currentTarget)}
                                    className={cn(
                                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums transition-colors",
                                      mineR ? "border-cyan/60 bg-cyan/15 text-foam" : "border-foam/10 bg-foam/[0.04] text-mist hover:border-foam/25",
                                    )}
                                  >
                                    <span className="text-sm">{em}</span>
                                    {n}
                                  </button>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
                {typing && (
                  <li className="flex items-center gap-3" aria-label="Someone is typing">
                    <span className="size-8 rounded-full bg-foam/10" />
                    <span className="flex gap-1 rounded-2xl bg-foam/[0.07] px-3.5 py-3">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="size-1.5 rounded-full bg-mist [animation:typing_1s_ease-in-out_infinite]" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </span>
                  </li>
                )}
              </ol>

              {/* composer */}
              <form onSubmit={send} className="flex items-center gap-2 border-t border-foam/10 p-3">
                <label htmlFor="community-input" className="sr-only">
                  Message your block
                </label>
                <input
                  id="community-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message your block…"
                  autoComplete="off"
                  className="h-11 min-w-0 flex-1 rounded-xl bg-foam/[0.05] px-4 text-foam placeholder:text-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
                />
                <button type="submit" aria-label="Send" className="grid size-11 place-items-center rounded-xl bg-foam text-abyss transition-transform active:scale-95">
                  <ArrowUp className="size-5" />
                </button>
              </form>
            </div>

            {/* emoji launched upward */}
            {flyers.map((f) => (
              <span
                key={f.id}
                aria-hidden="true"
                className="pointer-events-none absolute z-20 text-3xl [animation:emoji-fly_1200ms_cubic-bezier(.2,.8,.3,1)_both]"
                style={{ left: f.x, top: f.y, ["--dx" as string]: `${f.dx}px`, ["--rot" as string]: `${f.rot}deg` }}
              >
                {f.emoji}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-dim">Example conversation with fictional neighbors. Anything you type stays on this page.</p>
        </Reveal>
      </div>
    </section>
  );
}
