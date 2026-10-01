"use client";

import { ArrowRight } from "lucide-react";
import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { Reveal } from "./shared";

/**
 * ClosingCta — a near-black editorial close. Left-aligned: the
 * invitation and its reasons on the left, the action on the right.
 */
export function ClosingCta({ user }: { user: PsUser | null }) {
  const openStudio = () => psNavigate(user ? "dashboard" : "auth");

  return (
    <section aria-labelledby="closing-heading" className="border-t border-night bg-night">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <Reveal>
          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-silver">
                Begin
              </p>
              <h3
                id="closing-heading"
                className="ps-serif mt-4 text-3xl leading-[1.1] tracking-tight text-smoke sm:text-5xl"
              >
                Someone out there is waiting to hear from you.
              </h3>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-silver">
                Take fifteen quiet minutes. Paint a page, write a note, and
                send it as a little book that unfolds in their hands.
              </p>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={openStudio}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-paper px-8 text-sm font-medium text-night transition-colors duration-150 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smoke focus-visible:ring-offset-2 focus-visible:ring-offset-night"
              >
                {user ? "Open your studio" : "Start creating — free"}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
              <p className="mt-4 text-xs leading-relaxed text-silver/70">
                Free to create. Your reader never needs an account.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
