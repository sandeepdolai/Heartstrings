"use client";

import { WordMark } from "@/components/paperstring/brand";
import { psNavigate } from "@/lib/paperstring/navigation";

/**
 * LandingFooter — a structured editorial base: brand column, two link
 * columns, and a legal hairline row. Sits on the same near-black as
 * the closing CTA so the page ends on one solid foundation.
 */

const LINK_CLASS =
  "rounded-md text-sm text-silver transition-colors duration-150 hover:text-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-smoke";

export function LandingFooter() {
  const signIn = () => psNavigate("auth");
  const openStudio = () => psNavigate("auth");

  return (
    <footer className="mt-auto border-t border-white/15 bg-night">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* columns */}
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto] lg:gap-20">
          <div className="max-w-xs">
            <WordMark className="ps-serif text-smoke" />
            <p className="mt-4 text-sm leading-relaxed text-silver">
              A studio for heartfelt cards and memory books — made page by
              page, sent as a single link.
            </p>
          </div>

          <nav aria-label="Studio">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-silver/70">
              Studio
            </p>
            <ul className="mt-4 space-y-3">
              <li>
                <a href="#process" className={LINK_CLASS}>
                  How it works
                </a>
              </li>
              <li>
                <a href="#capabilities" className={LINK_CLASS}>
                  Capabilities
                </a>
              </li>
              <li>
                <a href="#showcase" className={LINK_CLASS}>
                  Showcase
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Account">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-silver/70">
              Account
            </p>
            <ul className="mt-4 space-y-3">
              <li>
                <button type="button" onClick={signIn} className={LINK_CLASS}>
                  Sign in
                </button>
              </li>
              <li>
                <button type="button" onClick={openStudio} className={LINK_CLASS}>
                  Open the studio
                </button>
              </li>
            </ul>
          </nav>
        </div>

        {/* legal hairline row */}
        <div className="flex flex-col gap-2 border-t border-white/15 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-silver/70">© 2026 PaperString</p>
          <p className="text-xs text-silver/70">
            Made page by page, with care.
          </p>
        </div>
      </div>
    </footer>
  );
}
