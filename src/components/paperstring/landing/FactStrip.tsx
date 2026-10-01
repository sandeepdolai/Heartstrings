"use client";

import { Reveal } from "./shared";

/**
 * FactStrip — a spec-sheet band under the hero. Real product facts,
 * evenly divided by hairlines. No invented statistics.
 */
const FACTS = [
  { value: "2160 × 3840", label: "Print-ready page render" },
  { value: "22", label: "Curated typefaces" },
  { value: "Unlimited", label: "Pages per book" },
  { value: "Zero", label: "Apps your reader needs" },
] as const;

export function FactStrip() {
  return (
    <section aria-label="At a glance" className="border-t border-silver bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <dl className="grid grid-cols-2 border-x border-silver md:grid-cols-4 md:divide-x md:divide-silver">
            {FACTS.map((fact) => (
              <div key={fact.label} className="border-b border-silver px-5 py-6 md:border-b-0 md:px-6 md:py-8">
                <dt className="order-2 mt-2 text-[11px] uppercase tracking-[0.14em] text-onyx">
                  {fact.label}
                </dt>
                <dd className="ps-serif order-1 text-2xl text-night sm:text-[1.7rem]">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
