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
import { ghostAction, pillPrimary } from "./shared";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#showcase", label: "Showcase" },
] as const;

export function LandingNav({ user }: { user: PsUser | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const startCreating = () =>
    psNavigate(user ? "dashboard" : "auth", { mode: "signup" });
  const signIn = () => psNavigate("auth");

  /** Close the sheet, then glide to the section (instant if reduced motion). */
  const goTo = (href: string) => {
    setMenuOpen(false);
    window.setTimeout(
      () => {
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        document
          .querySelector(href)
          ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      },
      220
    );
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300",
        scrolled
          ? "border-silver/40 bg-smoke/85 shadow-[0_1px_24px_rgba(19,19,19,0.05)]"
          : "border-transparent bg-smoke/0"
      )}
    >
      <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        {/* brand */}
        <div className="justify-self-start">
          <a
            href="#top"
            aria-label="PaperString — back to top"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-night focus-visible:ring-offset-2 focus-visible:ring-offset-smoke"
          >
            <WordMark className="ps-serif text-night transition-opacity duration-200 hover:opacity-70" />
          </a>
        </div>

        {/* center anchor links (desktop) */}
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="ps-underline-link rounded-full px-3.5 py-2 text-sm text-onyx transition-colors duration-200 hover:text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night"
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
              className={cn(pillPrimary, "group h-10 px-5 text-sm font-medium")}
            >
              Your studio
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={signIn}
                className={cn(
                  ghostAction,
                  "hidden h-10 px-4 text-sm sm:inline-flex"
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={startCreating}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-night/20 bg-paper/60 px-5 text-sm font-medium text-night transition-all duration-200 hover:border-night/40 hover:bg-paper hover:shadow-lift-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night focus-visible:ring-offset-2 focus-visible:ring-offset-smoke"
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
                  className="flex h-11 w-11 items-center justify-center rounded-full text-night transition-colors duration-200 hover:bg-night/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[86vw] max-w-xs border-l border-silver/40 bg-smoke p-0 text-night"
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
                            className="flex items-center justify-between border-b border-silver/30 py-4 ps-serif text-2xl text-night transition-colors duration-200 hover:text-night/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night"
                          >
                            {link.label}
                            <ArrowRight
                              className="h-4 w-4 text-silver"
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
                        className={cn(
                          pillPrimary,
                          "h-12 px-6 text-sm font-medium"
                        )}
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
                          className={cn(
                            ghostAction,
                            "h-12 border border-silver/40 px-6 text-sm font-medium"
                          )}
                        >
                          Sign in
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            startCreating();
                          }}
                          className={cn(
                            pillPrimary,
                            "h-12 px-6 text-sm font-medium"
                          )}
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
