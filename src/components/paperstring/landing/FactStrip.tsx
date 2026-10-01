"use client";

import { Reveal } from "./shared";

/**
 * FactStrip — a quiet spec band under the hero. Real product facts,
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
    <section aria-label="At a glance" className="bg-smoke">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <dl className="grid grid-cols-2 md:grid-cols-4 md:divide-x md:divide-silver">
            {FACTS.map((fact) => (
              <div key={fact.label} className="px-1 py-7 md:px-6 md:py-9 md:first:pl-1 md:last:pr-1">
                <dt className="order-2 mt-2 text-[11px] uppercase tracking-[0.14em] text-onyx">
                  {fact.label}
                </dt>
                <dd className="order-1 text-2xl font-semibold tracking-tight text-night sm:text-[1.7rem]">
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
