"use client";

import type { PsUser } from "@/lib/paperstring/types";
import { ClosingCta } from "./ClosingCta";
import { Features } from "./Features";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { LandingFooter } from "./LandingFooter";
import { LandingNav } from "./LandingNav";
import { Showcase } from "./Showcase";

/**
 * Landing page — PaperString's front door.
 * Monochrome editorial chrome that lets the colorful artwork shine.
 */
export function LandingView({ user }: { user: PsUser | null }) {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-smoke text-night">
      <LandingNav user={user} />
      <main className="flex-1">
        <Hero user={user} />
        <HowItWorks />
        <Features />
        <Showcase />
        <ClosingCta user={user} />
      </main>
      <LandingFooter />
    </div>
  );
}
