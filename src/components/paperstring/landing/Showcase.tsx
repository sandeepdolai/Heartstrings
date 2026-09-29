"use client";

import { MoveHorizontal } from "lucide-react";
import { PageArt, Reveal, SectionHeading } from "./shared";
import { SHOWCASE_PAGES } from "./showcase-data";

/**
 * Horizontal scroll-snap strip of the six showcase pages. On large screens
 * the strip is full-bleed but its first item aligns with the page container.
 */
export function Showcase() {
  return (
    <section id="showcase" className="scroll-mt-24 bg-paper py-20 lg:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Showcase"
            title="Made with PaperString"
            sub="Real pages, real feelings."
          />
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-dim">
            <MoveHorizontal className="h-4 w-4" aria-hidden="true" />
            Scroll sideways to browse
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.15}>
        <ul className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 pt-1 sm:px-6 lg:px-0 lg:pl-[max(1.5rem,calc((100vw_-_72rem)/2_+_1.5rem))] lg:pr-8 lg:[scroll-padding-inline:max(1.5rem,calc((100vw_-_72rem)/2_+_1.5rem))]">
          {SHOWCASE_PAGES.map((page) => (
            <li key={page.src} className="snap-start shrink-0">
              <figure className="group w-56 sm:w-60 lg:w-64">
                <div className="overflow-hidden rounded-xl shadow-[0_6px_24px_-10px_rgba(19,19,19,0.18)] ring-1 ring-silver/30 transition-all duration-200 group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_38px_-14px_rgba(19,19,19,0.3)]">
                  <PageArt
                    src={page.src}
                    alt={page.alt}
                    className="aspect-[9/16] w-full object-cover"
                  />
                </div>
                <figcaption className="mt-3 text-center text-xs text-dim">
                  {page.label}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
