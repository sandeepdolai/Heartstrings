"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { MoveHorizontal } from "lucide-react";
import { PageArt, Reveal, SectionHeading } from "./shared";
import { SHOWCASE_PAGES } from "./showcase-data";

/**
 * Horizontal scroll-snap strip of the six showcase pages. On large screens
 * the strip is full-bleed but its first item aligns with the page container.
 *
 * Motion: a gentle scroll parallax — the heading drifts one way and the
 * strip the other as the section travels through the viewport (FR-13.1),
 * with a per-card stagger on first reveal. All of it collapses to a static
 * layout under prefers-reduced-motion.
 */
export function Showcase() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Heading settles down 18px while the strip floats up 30px — a whisper of
  // depth, never a race. Clamped ranges keep it composed at any scroll speed.
  const headingY = useTransform(scrollYProgress, [0, 1], [18, -12]);
  const stripY = useTransform(scrollYProgress, [0, 1], [34, -22]);

  return (
    <section
      id="showcase"
      ref={sectionRef}
      className="scroll-mt-24 bg-paper py-20 lg:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <motion.div style={reduce ? undefined : { y: headingY }}>
            <SectionHeading
              eyebrow="Showcase"
              title="Made with PaperString"
              sub="Real pages, real feelings."
            />
          </motion.div>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-dim">
            <MoveHorizontal className="h-4 w-4" aria-hidden="true" />
            Scroll sideways to browse
          </p>
        </Reveal>
      </div>

      <motion.div
        style={reduce ? undefined : { y: stripY }}
        className="mt-10"
      >
        <ul className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 pt-1 sm:px-6 lg:px-0 lg:pl-[max(1.5rem,calc((100vw_-_72rem)/2_+_1.5rem))] lg:pr-8 lg:[scroll-padding-inline:max(1.5rem,calc((100vw_-_72rem)/2_+_1.5rem))]">
          {SHOWCASE_PAGES.map((page, i) => (
            <li key={page.src} className="snap-start shrink-0">
              <Reveal delay={0.08 * i} y={28}>
                <figure className="group w-56 sm:w-60 lg:w-64">
                  <div className="overflow-hidden rounded-xl shadow-[0_6px_24px_-10px_rgba(19,19,19,0.18)] ring-1 ring-silver/30 transition-all duration-200 group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_38px_-14px_rgba(19,19,19,0.3)]">
                    <PageArt
                      src={page.src}
                      alt={page.alt}
                      className="aspect-[9/16] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
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
      </motion.div>
    </section>
  );
}
