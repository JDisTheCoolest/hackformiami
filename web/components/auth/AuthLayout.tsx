import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Wordmark } from "@/components/brand/Wordmark";

export function AuthLayout({ eyebrow, title, description, children, footer }: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-abyss px-4 py-10 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(40,104,255,0.22),transparent_34%),radial-gradient(circle_at_88%_92%,rgba(101,217,242,0.13),transparent_30%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.22)_1px,transparent_1px)] [background-size:64px_64px]" />
      <section className="relative w-full max-w-md rounded-[28px] border border-foam/15 bg-deep/75 p-6 shadow-[0_28px_100px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-9">
        <Link to="/" className="inline-flex" aria-label="Return to 4forces home">
          <Wordmark className="text-2xl text-foam" track={false} />
        </Link>
        <p className="label-sm mt-10 uppercase tracking-[0.18em] text-cyan">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-foam">{title}</h1>
        <p className="mt-3 leading-6 text-mist">{description}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-7 border-t hairline pt-6 text-center text-sm text-mist">
          <Link to="/" className="mr-4 font-medium text-mist hover:text-foam">← Back to Home</Link>
          {footer}
        </div>
      </section>
    </main>
  );
}

export const fieldClass = "h-12 w-full rounded-xl border border-foam/15 bg-abyss/65 px-4 text-foam placeholder:text-dim outline-none transition focus:border-cyan/70 focus:ring-4 focus:ring-cyan/10";
export const buttonClass = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foam px-5 font-semibold text-abyss transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60";
