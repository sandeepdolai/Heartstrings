"use client";

import { ArrowRight } from "lucide-react";
import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { Reveal } from "./shared";

/**
 * ClosingCta — the conversion band: one calm light-blue panel, centered,
 * with a single primary action. The quiet counterpart to the hero.
 */
export function ClosingCta({ user }: { user: PsUser | null }) {
  const openStudio = () => psNavigate(user ? "dashboard" : "auth");

  return (
    <section aria-labelledby="closing-heading" className="bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <div className="rounded-2xl bg-wash px-6 py-14 text-center sm:px-12 sm:py-16">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-onyx">
              Begin
            </p>
            <h3
              id="closing-heading"
              className="mx-auto mt-4 max-w-2xl text-3xl font-semibold leading-[1.12] tracking-tight text-night sm:text-4xl"
            >
              Someone out there is waiting to hear from you.
            </h3>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-onyx">
              Take fifteen quiet minutes. Paint a page, write a note, and
              send it as a little book that unfolds in their hands.
            </p>
            <div className="mt-8">
              <button
                type="button"
                onClick={openStudio}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#1047C7] active:bg-[#1047C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-wash"
              >
                {user ? "Open your studio" : "Start creating — free"}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
              <p className="mt-4 text-xs leading-relaxed text-onyx">
                Free to create. Your reader never needs an account.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
