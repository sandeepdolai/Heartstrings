"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WordMark } from "@/components/paperstring/brand";
import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { btnPrimary } from "./shared";

const NAV_LINKS = [
  { href: "#process", label: "How it works", num: "01" },
  { href: "#capabilities", label: "Capabilities", num: "02" },
  { href: "#showcase", label: "Showcase", num: "03" },
] as const;

export function LandingNav({ user }: { user: PsUser | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Escape closes the menu; a click on the backdrop closes it too. */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const openStudio = () => psNavigate(user ? "dashboard" : "auth");
  const signIn = () => psNavigate("auth");

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-[border-color,box-shadow] duration-200",
        scrolled
          ? "border-silver bg-paper shadow-lift-sm"
          : "border-transparent bg-paper"
      )}
    >
      <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6">
        {/* brand */}
        <a
          href="#top"
          aria-label="PaperString — back to top"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <WordMark className="ps-serif text-night transition-opacity duration-150 hover:opacity-75" />
        </a>

        {/* center anchor links (desktop) */}
        <nav aria-label="Primary" className="hidden justify-self-center md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded-lg px-3.5 py-2 text-sm text-onyx transition-colors duration-150 hover:bg-smoke hover:text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* actions */}
        <div className="flex items-center justify-end gap-1">
          {user ? null : (
            <button
              type="button"
              onClick={signIn}
              className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-onyx transition-colors duration-150 hover:bg-smoke hover:text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
            >
              Sign in
            </button>
          )}
          <button
            type="button"
            onClick={openStudio}
            className={cn(btnPrimary, "h-10 px-5")}
          >
            {user ? "Your studio" : "Open studio"}
          </button>
          {/* mobile menu toggle */}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-lg text-night transition-colors duration-150 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* mobile menu — a numbered contents list, not a drawer of chips */}
      {menuOpen && (
        <div
          id="site-menu"
          ref={menuRef}
          className="border-t border-silver bg-paper md:hidden"
        >
          <nav aria-label="Mobile" className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
            <ul>
              {NAV_LINKS.map((link) => (
                <li key={link.href} className="border-b border-silver last:border-b-0">
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-baseline gap-4 rounded-lg px-2 py-4 transition-colors duration-150 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden="true"
                      className="ps-serif text-sm text-dim"
                    >
                      {link.num}
                    </span>
                    <span className="text-base text-night">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
            {user ? null : (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  signIn();
                }}
                className="w-full rounded-lg px-2 py-4 text-left text-base text-onyx transition-colors duration-150 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Sign in
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
