"use client";

import type { PsUser } from "@/lib/paperstring/types";
import { CapabilitiesSection } from "./CapabilitiesSection";
import { ClosingCta } from "./ClosingCta";
import { FactStrip } from "./FactStrip";
import { Hero } from "./Hero";
import { LandingFooter } from "./LandingFooter";
import { LandingNav } from "./LandingNav";
import { ProcessSection } from "./ProcessSection";
import { Showcase } from "./Showcase";
import { StandardsSection } from "./StandardsSection";
import { WhySection } from "./WhySection";

/**
 * Landing page — PaperString's front door.
 *
 * Narrative (each movement numbered like a document):
 *   Hero      — who we are, what this is, what to do next
 *   Facts     — the product, specified
 *   01 Problem— what PaperString solves
 *   02 Process— how the experience works
 *   03 Tools  — what you can accomplish (spec sheet)
 *   04 Work   — proof (showcase catalogue)
 *   05 Trust  — the standards we keep
 *   Close     — the invitation
 *
 * White ground, near-black type, controlled blue for actions. The
 * artwork is the only colour on the page.
 */
export function LandingView({ user }: { user: PsUser | null }) {
  return (
    <div id="top" className="flex min-h-screen flex-col bg-paper text-night">
      <LandingNav user={user} />
      <main className="flex-1">
        <Hero user={user} />
        <FactStrip />
        <WhySection />
        <ProcessSection user={user} />
        <CapabilitiesSection />
        <Showcase />
        <StandardsSection />
        <ClosingCta user={user} />
      </main>
      <LandingFooter />
    </div>
  );
}
