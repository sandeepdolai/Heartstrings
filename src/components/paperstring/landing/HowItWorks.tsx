"use client";

import { BookOpen, Brush, Send } from "lucide-react";
import { Reveal, SectionHeading } from "./shared";

const STEPS = [
  {
    n: "01",
    icon: Brush,
    title: "Paint your heart out",
    copy: "Brush, text and stickers on layered pages — express yourself across as many pages as the feeling needs.",
  },
  {
    n: "02",
    icon: Send,
    title: "Save & share one link",
    copy: "When your book is ready, one link goes anywhere — a text, an email, a note tucked under a pillow.",
  },
  {
    n: "03",
    icon: BookOpen,
    title: "They flip through your book",
    copy: "Recipients open it with a paper-flip — no account, no app, just your message, page by page.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 bg-paper py-20 lg:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="Three steps to someone's heart"
            sub="No manuals, no tutorials. If you can doodle on a napkin, you can make a PaperString."
          />
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.12} className="h-full">
              <article className="group h-full rounded-2xl border border-silver/30 bg-paper p-6 transition-all duration-200 hover:-translate-y-1 hover:border-silver/50 hover:shadow-lift-lg sm:p-8">
                <div className="flex items-start justify-between">
                  <span className="ps-serif text-4xl text-silver transition-all duration-300 group-hover:text-dim group-hover:italic motion-reduce:transition-none">
                    {step.n}
                  </span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-silver/40 bg-smoke/60 text-night transition-all duration-300 group-hover:rotate-6 group-hover:scale-110 group-hover:border-night group-hover:bg-night group-hover:text-smoke group-hover:shadow-[0_10px_24px_-10px_rgba(19,19,19,0.45)] motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100">
                    <step.icon
                      className="h-5 w-5"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </span>
                </div>
                <h3 className="mt-6 ps-serif text-xl text-night">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-dim">
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
