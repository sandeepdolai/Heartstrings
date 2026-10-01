"use client";

import { useRef } from "react";
import { MoveHorizontal } from "lucide-react";
import { PageArt, Reveal, SectionHeading } from "./shared";
import { SHOWCASE_PAGES } from "./showcase-data";

/**
 * Horizontal scroll-snap strip of the six showcase pages. On large screens
 * the strip is full-bleed but its first item aligns with the page container.
 * Static by design — the artwork, not motion, carries the section.
 */
export function Showcase() {
  const stripRef = useRef<HTMLUListElement | null>(null);

  return (
    <section
      id="showcase"
      className="scroll-mt-24 border-t border-silver bg-smoke py-20 lg:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="Showcase"
            title="Made with PaperString"
            sub="Real pages, made with the tools you're about to use."
          />
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-dim">
            <MoveHorizontal className="h-4 w-4" aria-hidden="true" />
            Scroll sideways to browse
          </p>
        </Reveal>
      </div>

      <div ref={stripRef} className="mt-10">
        <ul className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 pt-1 sm:px-6 lg:px-0 lg:pl-[max(1.5rem,calc((100vw_-_72rem)/2_+_1.5rem))] lg:pr-8 lg:[scroll-padding-inline:max(1.5rem,calc((100vw_-_72rem)/2_+_1.5rem))]">
          {SHOWCASE_PAGES.map((page, i) => (
            <li key={page.src} className="snap-start shrink-0">
              <Reveal delay={0.06 * i} y={16}>
                <figure className="group w-56 sm:w-60 lg:w-64">
                  <div className="overflow-hidden rounded-lg border border-silver bg-paper transition-colors duration-150 group-hover:border-night/25">
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
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
