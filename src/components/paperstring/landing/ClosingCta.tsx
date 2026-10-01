"use client";

import { ArrowRight } from "lucide-react";
import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { Reveal } from "./shared";

export function ClosingCta({ user }: { user: PsUser | null }) {
  const startCreating = () => psNavigate(user ? "dashboard" : "auth");

  return (
    <section
      aria-labelledby="closing-heading"
      className="bg-night"
    >
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:py-28">
        <Reveal>
          <h3
            id="closing-heading"
            className="ps-serif text-3xl leading-tight tracking-tight text-smoke sm:text-4xl"
          >
            Someone out there is waiting to hear from you.
          </h3>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-silver">
            Take fifteen quiet minutes. Paint a page, write a note, and send it
            as a little book that unfolds in their hands.
          </p>

          <div className="mt-9">
            <button
              type="button"
              onClick={startCreating}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-paper px-8 text-sm font-medium text-night transition-colors duration-150 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smoke focus-visible:ring-offset-2 focus-visible:ring-offset-night"
            >
              Start creating
              <ArrowRight
                className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </div>

          <p className="mt-5 text-xs text-silver/70">
            Free to create — no account needed to receive.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
