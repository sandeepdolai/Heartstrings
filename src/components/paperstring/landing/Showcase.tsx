"use client";

import { PageArt, Reveal, SectionShell } from "./shared";
import { SHOWCASE_PAGES } from "./showcase-data";

/**
 * Showcase — the artwork, presented as a catalogue: an even grid of
 * figures, each with an index and a caption row. The pages carry the
 * colour; the structure stays quiet.
 */
export function Showcase() {
  return (
    <SectionShell
      id="showcase"
      num="04"
      label="Showcase"
      title="Made in the studio"
      sub="Sample pages, made with the same tools you're about to use — brush, text, photos and stickers."
    >
      <Reveal delay={0.1}>
        <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3">
          {SHOWCASE_PAGES.map((page, i) => (
            <li key={page.src}>
              <figure>
                <div className="overflow-hidden rounded-[4px] border border-silver bg-paper">
                  <PageArt
                    src={page.src}
                    alt={page.alt}
                    className="aspect-[9/16] w-full object-cover"
                  />
                </div>
                <figcaption className="mt-3 flex items-baseline justify-between gap-3 border-t border-silver pt-2.5">
                  <span className="text-[13px] text-night">{page.label}</span>
                  <span
                    aria-hidden="true"
                    className="ps-serif text-xs tabular-nums text-dim"
                  >
                    {String(i + 1).padStart(2, "0")} / {String(SHOWCASE_PAGES.length).padStart(2, "0")}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Reveal>
    </SectionShell>
  );
}
