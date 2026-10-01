"use client";

import { BookOpen, Brush, Send } from "lucide-react";
import { Reveal, SectionHeading } from "./shared";

const STEPS = [
  {
    n: "01",
    icon: Brush,
    title: "Create your pages",
    copy: "Brush, text, photos and stickers on layered pages — as many pages as the message needs.",
  },
  {
    n: "02",
    icon: Send,
    title: "Share one link",
    copy: "When your book is ready, one link goes anywhere — a text, an email, a note under a pillow.",
  },
  {
    n: "03",
    icon: BookOpen,
    title: "They flip through it",
    copy: "Recipients open a paper-flip book — no account, no app, just your message, page by page.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 border-t border-silver bg-smoke py-20 lg:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Three steps, start to sent"
            sub="No manuals, no tutorials. If you can doodle on a napkin, you can make a PaperString."
          />
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.1} className="h-full">
              <article className="h-full rounded-lg border border-silver bg-paper p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="ps-serif text-3xl text-dim/45">{step.n}</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-silver bg-smoke text-night">
                    <step.icon
                      className="h-5 w-5"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </span>
                </div>
                <h3 className="mt-6 text-base font-semibold text-night">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-onyx">
                  {step.copy}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
