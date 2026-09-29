"use client";

import { Heart } from "lucide-react";
import { WordMark } from "@/components/paperstring/brand";
import { psNavigate } from "@/lib/paperstring/navigation";

const FOOTER_LINK_CLASS =
  "ps-underline-link rounded-full text-onyx transition-colors duration-200 hover:text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night";

export function LandingFooter() {
  const signIn = () => psNavigate("auth");

  return (
    <footer className="mt-auto border-t border-silver/30 bg-smoke">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-8 sm:px-6 md:flex-row md:justify-between">
        {/* brand + tagline */}
        <div className="flex flex-col items-center gap-2.5 md:items-start">
          <WordMark className="ps-serif text-night" />
          <p className="flex items-center gap-1.5 text-xs text-dim">
            Made with
            <Heart className="h-3 w-3 text-night" aria-hidden="true" />
            for the people you love.
          </p>
        </div>

        {/* links */}
        <nav aria-label="Footer">
          <ul className="flex items-center gap-6 text-xs">
            <li>
              <a href="#how" className={FOOTER_LINK_CLASS}>
                How it works
              </a>
            </li>
            <li>
              <a href="#features" className={FOOTER_LINK_CLASS}>
                Features
              </a>
            </li>
            <li>
              <button
                type="button"
                onClick={signIn}
                className={FOOTER_LINK_CLASS}
              >
                Sign in
              </button>
            </li>
          </ul>
        </nav>

        <p className="text-xs text-dim">© 2026 PaperString</p>
      </div>
    </footer>
  );
}
