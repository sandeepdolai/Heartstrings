"use client";

import { Reveal, SectionShell } from "./shared";

/**
 * CapabilitiesSection — a spec sheet, not a card grid. Each row is a
 * hairline-separated definition: the capability on the left, what it
 * does for you on the right. Reads like a technical document because
 * the studio is a tool, and tools deserve honest specification.
 */

const ROWS = [
  {
    term: "Background removal",
    copy: "Trace loosely around any subject — the cutout lands as a movable, resizable layer with clean edges.",
  },
  {
    term: "Type & lettering",
    copy: "22 curated typefaces with size, rotation, colour and curve control. Bend a line into an arch or a smile.",
  },
  {
    term: "Brush & ink",
    copy: "One clean pen with size and opacity control. Apple Pencil and other styluses add pressure tapers.",
  },
  {
    term: "Photo adjustments",
    copy: "Brightness, contrast and warmth on every photo layer — tune the picture to the page.",
  },
  {
    term: "Stickers & paper art",
    copy: "Hearts, stars, flowers and wreaths, plus full-page artwork and templates. Drag on, make it yours.",
  },
  {
    term: "Layers",
    copy: "Stack paint, text, photos and stickers. Reorder, hide or blend — every element stays editable.",
  },
  {
    term: "Autosave",
    copy: "Every stroke saves itself as you work. Leave, return, pick up where you left off — nothing to remember.",
  },
  {
    term: "Export",
    copy: "Every page renders at 2160 × 3840 — PNG keeps every pixel, JPG is share-ready. Print at full quality.",
  },
  {
    term: "Share links",
    copy: "One link per book, private until you send it. Readers open a paper flip-book with no account and no app.",
  },
] as const;

export function CapabilitiesSection() {
  return (
    <SectionShell
      id="capabilities"
      num="03"
      label="Capabilities"
      tone="smoke"
      title="Everything in the studio"
      sub="Listed plainly. Everything here is in the product today — nothing on this page is a promise about tomorrow."
    >
      <Reveal delay={0.1}>
        <dl className="mt-12 border-t border-silver">
          {ROWS.map((row) => (
            <div
              key={row.term}
              className="grid gap-1.5 border-b border-silver py-5 sm:grid-cols-[220px_1fr] sm:gap-6"
            >
              <dt className="text-sm font-semibold text-night">{row.term}</dt>
              <dd className="max-w-2xl text-sm leading-relaxed text-onyx">
                {row.copy}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </SectionShell>
  );
}
