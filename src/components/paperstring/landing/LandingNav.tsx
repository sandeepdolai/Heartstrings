"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { WordMark } from "@/components/paperstring/brand";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { btnPrimary, ghostAction } from "./shared";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#showcase", label: "Showcase" },
] as const;

export function LandingNav({ user }: { user: PsUser | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const startCreating = () => psNavigate(user ? "dashboard" : "auth");
  const signIn = () => psNavigate("auth");

  /** Close the sheet, then glide to the section (instant if reduced motion). */
  const goTo = (href: string) => {
    setMenuOpen(false);
    window.setTimeout(() => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      document
        .querySelector(href)
        ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }, 220);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-[border-color,box-shadow] duration-200",
        scrolled
          ? "border-silver bg-paper shadow-lift-sm"
          : "border-transparent bg-paper"
      )}
    >
      <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        {/* brand */}
        <div className="justify-self-start">
          <a
            href="#top"
            aria-label="PaperString — back to top"
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <WordMark className="ps-serif text-night transition-opacity duration-150 hover:opacity-75" />
          </a>
        </div>

        {/* center anchor links (desktop) */}
        <nav aria-label="Primary" className="hidden md:block">
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
        <div className="col-start-3 flex items-center justify-end gap-2">
          {user ? (
            <button
              type="button"
              onClick={startCreating}
              className={cn(btnPrimary, "group h-10 px-5")}
            >
              Your studio
              <ArrowRight
                className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={signIn}
                className={cn(ghostAction, "hidden h-10 px-4 text-sm sm:inline-flex")}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={startCreating}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-silver bg-paper px-5 text-sm font-medium text-night transition-colors duration-150 hover:border-night/40 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start creating
              </button>
            </>
          )}

          {/* mobile menu */}
          <div className="md:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open menu"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-night transition-colors duration-150 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[86vw] max-w-xs border-l border-silver bg-paper p-0 text-night"
              >
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SheetDescription className="sr-only">
                  PaperString navigation and actions
                </SheetDescription>
                <div className="flex h-full flex-col p-6 pt-16">
                  <WordMark className="ps-serif text-night" />
                  <nav aria-label="Mobile" className="mt-8">
                    <ul>
                      {NAV_LINKS.map((link) => (
                        <li key={link.href}>
                          <a
                            href={link.href}
                            onClick={(e) => {
                              e.preventDefault();
                              goTo(link.href);
                            }}
                            className="flex items-center justify-between border-b border-silver py-4 text-base font-medium text-night transition-colors duration-150 hover:text-onyx focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {link.label}
                            <ArrowRight
                              className="h-4 w-4 text-dim"
                              aria-hidden="true"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>

                  <div className="mt-auto flex flex-col gap-3 pb-2">
                    {user ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          startCreating();
                        }}
                        className={cn(btnPrimary, "h-12 px-6 text-sm")}
                      >
                        Your studio
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            signIn();
                          }}
                          className="inline-flex h-12 items-center justify-center rounded-lg border border-silver bg-paper px-6 text-sm font-medium text-night transition-colors duration-150 hover:bg-smoke"
                        >
                          Sign in
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            startCreating();
                          }}
                          className={cn(btnPrimary, "h-12 px-6 text-sm")}
                        >
                          Start creating
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
