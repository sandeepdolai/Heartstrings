"use client";

import { Reveal, SectionShell } from "./shared";
import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";

/**
 * ProcessSection — three movements on a shared timeline: a hairline
 * runs across the top of the row, each step opens with a serif
 * numeral. Open layout; no cards, no icons.
 */

const STEPS = [
  {
    n: "01",
    title: "Bring your photos",
    copy: "Drop a photo onto the page and cut the subject out with a loose trace. It lands as its own layer, ready to place.",
  },
  {
    n: "02",
    title: "Make the page yours",
    copy: "Write in any of 22 typefaces — or your own handwriting. Paint, add stickers, stack layers until the page says what you mean.",
  },
  {
    n: "03",
    title: "Send the book",
    copy: "Share one link. It opens as a paper flip-book your reader pages through — no account, no app, nothing to install.",
  },
] as const;

export function ProcessSection({ user }: { user: PsUser | null }) {
  return (
    <SectionShell
      id="process"
      num="02"
      label="Process"
      title="From first photo to finished book"
      sub="Three steps, start to sent. No manuals, no tutorials — if you can doodle on a napkin, you can make a PaperString."
      aside={
        <button
          type="button"
          onClick={() => psNavigate(user ? "dashboard" : "auth")}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-silver bg-paper px-5 text-sm font-medium text-night transition-colors duration-150 hover:border-night/40 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Try it now
        </button>
      }
    >
      <Reveal delay={0.1}>
        <ol className="relative mt-14 border-t border-night sm:grid sm:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="relative pt-8 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-silver sm:pl-6 sm:pt-8 sm:first:pl-0 sm:[&:not(:first-child)]:border-t-0 sm:[&:not(:first-child)]:border-l"
            >
              {/* the step marker sits on the shared rule */}
              <span
                aria-hidden="true"
                className="absolute -top-[5px] left-0 hidden h-[9px] w-[9px] rounded-[1px] bg-night sm:block sm:first:left-0"
              />
              <span className="ps-serif text-4xl text-night">{step.n}</span>
              <h3 className="mt-4 text-base font-semibold text-night">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-onyx">
                {step.copy}
              </p>
            </li>
          ))}
        </ol>
      </Reveal>
    </SectionShell>
  );
}
