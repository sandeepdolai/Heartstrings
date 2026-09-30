"use client";

import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/paperstring/brand";
import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { Reveal } from "./shared";

export function ClosingCta({ user }: { user: PsUser | null }) {
  const startCreating = () =>
    psNavigate(user ? "dashboard" : "auth", { mode: "signup" });

  return (
    <section
      aria-labelledby="closing-heading"
      className="ps-grain relative overflow-hidden bg-night"
    >
      {/* faint oversized string-hearts as a watermark */}
      <LogoMark
        className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rotate-12 text-white/[0.04]"
        strokeWidth={2}
      />
      <LogoMark
        className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 -rotate-12 text-white/[0.03]"
        strokeWidth={2}
      />

      <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:py-32">
        <Reveal>
          <LogoMark className="ps-heartbeat mx-auto h-10 w-11 text-smoke" />
          <h3
            id="closing-heading"
            className="mt-6 ps-serif text-3xl leading-tight tracking-tight text-smoke sm:text-4xl lg:text-[2.75rem]"
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
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-smoke px-8 text-sm font-medium text-night transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_14px_40px_-10px_rgba(243,243,243,0.35)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smoke focus-visible:ring-offset-2 focus-visible:ring-offset-night"
            >
              Start creating
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
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
