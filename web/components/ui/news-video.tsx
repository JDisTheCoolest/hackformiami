import { Play } from "lucide-react";
import { useState } from "react";

/**
 * Click-to-play YouTube embed. Until pressed, only the thumbnail loads — no player script,
 * no autoplay. The report plays with its own controls and source, as broadcast news should.
 */
export function NewsVideo({ id, title, source }: { id: string; title: string; source: string }) {
  const [play, setPlay] = useState(false);
  return (
    <figure className="overflow-hidden rounded-2xl border hairline bg-deep">
      <div className="relative aspect-video bg-abyss">
        {play ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
            title={`${title} — ${source}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlay(true)}
            aria-label={`Play video: ${title} (${source}, on YouTube)`}
            className="group absolute inset-0"
          >
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover opacity-75 saturate-[0.8] transition-opacity duration-500 group-hover:opacity-95"
            />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full bg-foam/90 text-abyss shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-105">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="flex items-baseline justify-between gap-4 p-4">
        <p className="text-foam">{title}</p>
        <p className="shrink-0 text-sm text-dim">{source}</p>
      </figcaption>
    </figure>
  );
}
