"use client";

import { Reveal, SectionShell } from "./shared";

/**
 * StandardsSection — trust, earned structurally: three plain
 * commitments written as hairline rows. No invented awards, no
 * fabricated numbers, no borrowed logos — the standards themselves
 * are the statement.
 */

const COMMITMENTS = [
  {
    n: "01",
    title: "Your work saves itself",
    copy: "Every stroke is kept the moment you make it. A closed tab, a dead battery, a dropped phone — the book is where you left it.",
  },
  {
    n: "02",
    title: "Your photos stay yours",
    copy: "What you upload is used for your book and nothing else. It is never sold, never shared, never used to train anything.",
  },
  {
    n: "03",
    title: "Private until you share",
    copy: "A book is visible only through the link you create. Revoke sharing at any time and it goes dark.",
  },
] as const;

export function StandardsSection() {
  return (
    <SectionShell
      id="standards"
      num="05"
      label="Our standards"
      tone="smoke"
      title="Quiet promises, kept"
      sub="A studio is only as good as what it refuses to lose, leak or exaggerate. These are the standards this one is built on."
    >
      <Reveal delay={0.1}>
        <ol className="mt-12 border-t border-silver">
          {COMMITMENTS.map((row, i) => (
            <li
              key={row.n}
              className={
                i === COMMITMENTS.length - 1
                  ? "pt-7"
                  : "border-b border-silver py-7"
              }
            >
              <div className="grid gap-2 sm:grid-cols-[64px_260px_1fr] sm:gap-6">
                <span aria-hidden="true" className="ps-serif text-sm text-dim">
                  {row.n}
                </span>
                <h3 className="text-base font-semibold text-night">
                  {row.title}
                </h3>
                <p className="max-w-xl text-sm leading-relaxed text-onyx">
                  {row.copy}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>
    </SectionShell>
  );
}
