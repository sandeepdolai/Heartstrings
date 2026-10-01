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
 * White ground, near-black type, controlled blue for actions. The
 * colorful artwork is the only color on the page.
 */
export function LandingView({ user }: { user: PsUser | null }) {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-paper text-night">
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
