"use client";

import { useRef, useState } from "react";
import {
  FileDown,
  Layers,
  Link2,
  Paintbrush,
  Scissors,
  Save,
  SlidersHorizontal,
  Sticker,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Reveal, SectionShell } from "./shared";

/**
 * CapabilitiesSection — the studio's tools, browsed the way serious
 * product sites browse: grouped tabs over quiet white cards. Every
 * card states something that is in the product today — nothing on
 * this page is a promise about tomorrow.
 */

interface Capability {
  term: string;
  copy: string;
  icon: LucideIcon;
}

const GROUPS: { id: string; label: string; items: Capability[] }[] = [
  {
    id: "photos",
    label: "Photos & cutouts",
    items: [
      {
        term: "Background removal",
        copy: "Trace loosely around any subject — the cutout lands as a movable, resizable layer with clean edges.",
        icon: Scissors,
      },
      {
        term: "Photo adjustments",
        copy: "Brightness, contrast and warmth on every photo layer — tune the picture to the page.",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    id: "type",
    label: "Type & drawing",
    items: [
      {
        term: "Type & lettering",
        copy: "22 curated typefaces with size, rotation, colour and curve control. Bend a line into an arch or a smile.",
        icon: Type,
      },
      {
        term: "Brush & ink",
        copy: "One clean pen with size and opacity control. Apple Pencil and other styluses add pressure tapers.",
        icon: Paintbrush,
      },
    ],
  },
  {
    id: "pages",
    label: "Pages & stickers",
    items: [
      {
        term: "Stickers & paper art",
        copy: "Hearts, stars, flowers and wreaths, plus full-page artwork and templates. Drag on, make it yours.",
        icon: Sticker,
      },
      {
        term: "Layers",
        copy: "Stack paint, text, photos and stickers. Reorder, hide or blend — every element stays editable.",
        icon: Layers,
      },
    ],
  },
  {
    id: "sharing",
    label: "Saving & sharing",
    items: [
      {
        term: "Autosave",
        copy: "Every stroke saves itself as you work. Leave, return, pick up where you left off — nothing to remember.",
        icon: Save,
      },
      {
        term: "Export",
        copy: "Every page renders at 2160 × 3840 — PNG keeps every pixel, JPG is share-ready. Print at full quality.",
        icon: FileDown,
      },
      {
        term: "Share links",
        copy: "One link per book, private until you send it. Readers open a paper flip-book with no account and no app.",
        icon: Link2,
      },
    ],
  },
];

export function CapabilitiesSection() {
  const [active, setActive] = useState(GROUPS[0].id);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const group = GROUPS.find((g) => g.id === active) ?? GROUPS[0];

  /* Arrow keys move between tabs — keyboard parity with the tab bars of
     established product sites. Home/End supported. */
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % GROUPS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + GROUPS.length) % GROUPS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = GROUPS.length - 1;
    if (next !== null) {
      e.preventDefault();
      setActive(GROUPS[next].id);
      tabsRef.current[next]?.focus();
    }
  };

  return (
    <SectionShell
      id="capabilities"
      num="03"
      label="Capabilities"
      title="Everything in the studio"
      sub="Listed plainly, grouped the way you'd use them. Everything here is in the product today — nothing on this page is a promise about tomorrow."
    >
      <Reveal delay={0.1}>
        {/* tab bar — text tabs over a shared hairline, active = blue rule */}
        <div className="mt-10 overflow-x-auto">
          <div
            role="tablist"
            aria-label="Capability groups"
            className="flex min-w-max gap-1 border-b border-silver"
          >
            {GROUPS.map((g, i) => {
              const selected = g.id === active;
              return (
                <button
                  key={g.id}
                  ref={(el) => {
                    tabsRef.current[i] = el;
                  }}
                  role="tab"
                  id={`cap-tab-${g.id}`}
                  aria-selected={selected}
                  aria-controls="cap-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(g.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={
                    "-mb-px border-b-2 px-4 pb-3 pt-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (selected
                      ? "border-heart font-medium text-night"
                      : "border-transparent text-onyx hover:border-silver hover:text-night")
                  }
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* the group's capabilities as quiet white cards */}
        <div
          role="tabpanel"
          id="cap-panel"
          aria-labelledby={`cap-tab-${group.id}`}
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {group.items.map((item) => (
            <article
              key={item.term}
              className="rounded-lg border border-silver bg-paper p-6 transition-colors duration-150 hover:border-night/25"
            >
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-wash">
                  <item.icon className="h-5 w-5 text-heart" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-night">{item.term}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-onyx">
                    {item.copy}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Reveal>
    </SectionShell>
  );
}
