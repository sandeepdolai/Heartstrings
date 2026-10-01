"use client";

import { Reveal, SectionShell } from "./shared";

/**
 * WhySection — the problem, then the answer. An editorial two-column
 * split separated by a vertical hairline: left names the problem every
 * visitor recognises; right lists what the studio does about it, as
 * numbered rows.
 */

const ANSWERS = [
  {
    n: "a",
    title: "Cut the background from any photo",
    copy: "Trace loosely around a subject — person, pet, bouquet — and it becomes a clean cutout you can place anywhere on the page.",
  },
  {
    n: "b",
    title: "Write in type, or in your own hand",
    copy: "22 curated typefaces with size, rotation and curve control — or draw your words with a pressure-aware brush and a stylus.",
  },
  {
    n: "c",
    title: "Send it as one link",
    copy: "The finished book opens as a paper flip-book on any device. Your reader never signs up, installs, or pays.",
  },
] as const;

export function WhySection() {
  return (
    <SectionShell
      id="why"
      num="01"
      label="The problem"
      title={
        <>
          The photos live on your phone.
          <br />
          The words stay unsent.
        </>
      }
      sub="A birthday worth remembering gets a text thread. Sixty vacation photos stay in the cloud. The card you meant to make never gets made — because the tools were either too little or too much."
    >
      <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-0">
        {/* left — the answer, stated as a claim */}
        <Reveal className="lg:pr-12">
          <p className="text-2xl font-semibold leading-snug tracking-tight text-night sm:text-[1.75rem]">
            One studio for the whole message.
          </p>
          <p className="mt-4 max-w-md text-base leading-relaxed text-onyx">
            PaperString is built for the note that deserves more than a
            text — the photos, the handwriting and the effort, together on
            pages you compose yourself.
          </p>
        </Reveal>

        {/* right — what that means, concretely */}
        <Reveal delay={0.1} className="lg:border-l lg:border-silver lg:pl-12">
          <ol>
            {ANSWERS.map((row, i) => (
              <li
                key={row.n}
                className={
                  i === 0
                    ? "pb-7"
                    : i === ANSWERS.length - 1
                      ? "pt-7"
                      : "border-t border-silver py-7"
                }
              >
                <div className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="ps-serif mt-0.5 text-sm text-dim"
                  >
                    {row.n}.
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-night">
                      {row.title}
                    </h3>
                    <p className="mt-1.5 max-w-md text-sm leading-relaxed text-onyx">
                      {row.copy}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </SectionShell>
  );
}
