"use client";

import { WordMark } from "@/components/paperstring/brand";
import { psNavigate } from "@/lib/paperstring/navigation";

/**
 * LandingFooter — a structured directory base in the manner of serious
 * product companies: bold column headers, quiet gray links that turn
 * blue on hover, and a slim legal row. Every link is a real
 * destination — no invented pages.
 */

const LINK_CLASS =
  "rounded-md text-left text-sm text-onyx transition-colors duration-150 hover:text-heart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LandingFooter() {
  const signIn = () => psNavigate("auth");
  const openStudio = () => psNavigate("auth");
  const viewShared = () => psNavigate("viewer", { s: "demo" });

  return (
    <footer className="mt-auto border-t border-silver bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* columns */}
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-16">
          <div className="max-w-xs">
            <WordMark className="text-night" />
            <p className="mt-4 text-sm leading-relaxed text-onyx">
              A studio for heartfelt cards and memory books — made page by
              page, sent as a single link.
            </p>
          </div>

          <nav aria-label="Explore">
            <p className="text-sm font-semibold text-night">Explore</p>
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
              <li>
                <a href="#standards" className={LINK_CLASS}>
                  Our standards
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Studio">
            <p className="text-sm font-semibold text-night">Studio</p>
            <ul className="mt-4 space-y-3">
              <li>
                <button type="button" onClick={openStudio} className={LINK_CLASS}>
                  Open the studio
                </button>
              </li>
              <li>
                <button type="button" onClick={signIn} className={LINK_CLASS}>
                  Sign in
                </button>
              </li>
              <li>
                <button type="button" onClick={viewShared} className={LINK_CLASS}>
                  View a shared book
                </button>
              </li>
            </ul>
          </nav>
        </div>

        {/* legal row */}
        <div className="flex flex-col gap-2 border-t border-silver py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-dim">© 2026 PaperString</p>
          <p className="text-xs text-dim">
            Made page by page, with care.
          </p>
        </div>
      </div>
    </footer>
  );
}
