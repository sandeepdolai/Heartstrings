"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ImagePlus,
  MousePointer2,
  Paintbrush,
  Share2,
  Sticker,
  Type,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/paperstring/brand";
import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { PageArt } from "./shared";
import { cn } from "@/lib/utils";

/**
 * Hero — a calm, centered opening in the manner of serious product
 * companies: the mark, one promise, one paragraph, two actions, then
 * the product itself. The StudioFrame is a faithful miniature of the
 * real editor (top bar, tool rail, canvas, layers) — an honest
 * depiction, not a decorated mock.
 */

const ASSURANCES = ["Free to create", "No app to read", "Your work saves itself"] as const;

const RAIL_TOOLS = [
  { icon: MousePointer2, label: "Select" },
  { icon: Paintbrush, label: "Brush", active: true },
  { icon: Type, label: "Text" },
  { icon: ImagePlus, label: "Photo" },
  { icon: Sticker, label: "Sticker" },
] as const;

const FRAME_LAYERS = [
  { name: "Photo — cut out", meta: "Layer 3" },
  { name: "“Happy birthday, Ma”", meta: "Script · Layer 2" },
  { name: "Wreath sticker", meta: "Layer 1" },
] as const;

export function Hero({ user }: { user: PsUser | null }) {
  const reduce = useReducedMotion();
  const [bannerOpen, setBannerOpen] = useState(true);
  const openStudio = () => psNavigate(user ? "dashboard" : "auth");

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: "easeOut" as const },
        };

  return (
    <section className="bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:pb-28 lg:pt-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          {/* ── announcement — a quiet wash pill with a real destination ── */}
          {bannerOpen && (
            <motion.div {...rise(0)} className="flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-wash py-1.5 pl-2 pr-1.5 text-sm">
                <span className="ml-1.5 rounded-full bg-heart px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">
                  New
                </span>
                <button
                  type="button"
                  onClick={() => psNavigate("viewer", { s: "demo" })}
                  className="group ml-0.5 inline-flex flex-wrap items-center gap-1.5 sm:whitespace-nowrap rounded-full px-1.5 py-0.5 font-medium text-night transition-colors duration-150 hover:text-heart-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Shared books open as flip-books — see one live
                  <ArrowRight
                    className="h-3.5 w-3.5 text-heart transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  aria-label="Dismiss announcement"
                  onClick={() => setBannerOpen(false)}
                  className="grid h-6 w-6 place-items-center rounded-full text-onyx transition-colors duration-150 hover:bg-white/70 hover:text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── the mark, centered and unhurried ───────────────────── */}
          <motion.div {...rise(0.06)} className="mt-10">
            <LogoMark className="h-16 w-[4.5rem] text-night" strokeWidth={3} />
          </motion.div>

          {/* ── the promise ─────────────────────────────────────────── */}
          <motion.h1
            {...rise(0.12)}
            className="mt-6 text-[2.75rem] font-semibold leading-[1.05] tracking-tight text-night sm:text-6xl"
          >
            Make something they&rsquo;ll keep.
          </motion.h1>

          <motion.p
            {...rise(0.18)}
            className="mt-6 max-w-[36rem] text-base leading-normal text-onyx sm:text-lg sm:leading-normal"
          >
            PaperString brings your photos and your words together on layered
            pages. Cut a subject out of its background, write in your own hand,
            then send the finished book as a single link — it opens like a
            little paper flip-book, anywhere, no app required.
          </motion.p>

          {/* ── two actions, one primary ────────────────────────────── */}
          <motion.div
            {...rise(0.24)}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            <button
              type="button"
              onClick={openStudio}
              className={cn(
                "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors duration-150",
                "hover:bg-[#1047C7] active:bg-[#1047C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              {user ? "Open your studio" : "Open the studio — free"}
            </button>
            <a
              href="#process"
              className="inline-flex h-12 items-center justify-center rounded-full border border-silver bg-paper px-7 text-sm font-medium text-night transition-colors duration-150 hover:border-night/40 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              See how it works
            </a>
          </motion.div>

          {/* ── assurances ──────────────────────────────────────────── */}
          <motion.ul
            {...rise(0.3)}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            {ASSURANCES.map((text) => (
              <li key={text} className="flex items-center gap-2 text-[13px] text-onyx">
                <Check className="h-3.5 w-3.5 text-heart" aria-hidden="true" />
                {text}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* ── the product, faithfully miniaturised ─────────────────── */}
        <motion.div
          className="mx-auto mt-16 w-full max-w-3xl sm:mt-20"
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: 24 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.6, delay: 0.3, ease: "easeOut" },
              })}
        >
          <StudioFrame />
        </motion.div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   StudioFrame — the real editor, miniaturised. Same chrome:
   a top bar (title · saved state · share), a tool rail, the
   page canvas, a layers list. Artwork is real showcase output.
   ──────────────────────────────────────────────────────────── */

function StudioFrame() {
  return (
    <figure className="w-full">
      <div className="overflow-hidden rounded-xl border border-silver bg-paper shadow-lift-md">
        {/* top bar */}
        <div className="flex h-11 items-center gap-3 border-b border-silver bg-paper px-3">
          <span className="truncate ps-serif text-[13px] italic text-night">
            For Mom — her 70th
          </span>
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-dim">
            <Check className="h-3 w-3 text-heart" aria-hidden="true" />
            Saved
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">
            <Share2 className="h-3 w-3" aria-hidden="true" />
            Share
          </span>
        </div>

        <div className="flex bg-smoke">
          {/* tool rail */}
          <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-silver bg-paper py-3">
            {RAIL_TOOLS.map(({ icon: Icon, label, active }) => (
              <span
                key={label}
                aria-hidden="true"
                title={label}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-md",
                  active ? "bg-wash text-heart" : "text-dim"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            ))}
          </div>

          {/* canvas */}
          <div className="flex min-w-0 flex-1 justify-center px-6 py-6 sm:px-10">
            <div className="w-40 sm:w-44">
              <div className="overflow-hidden rounded-[4px] border border-silver shadow-lift-sm">
                <PageArt
                  src="/showcase/page-2.png"
                  alt="A PaperString page in progress: taped photos and hand-written notes"
                  eager
                  className="aspect-[9/16] w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* layers list (sm+) */}
          <div className="hidden w-40 shrink-0 flex-col border-l border-silver bg-paper sm:flex">
            <p className="border-b border-silver px-3 py-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-dim">
              Layers
            </p>
            <ul>
              {FRAME_LAYERS.map((layer, i) => (
                <li
                  key={layer.name}
                  className={cn(
                    "px-3 py-2.5",
                    i === 0 && "bg-wash",
                    i !== FRAME_LAYERS.length - 1 && "border-b border-silver"
                  )}
                >
                  <p className={cn("truncate text-[11px] leading-tight", i === 0 ? "font-medium text-night" : "text-onyx")}>
                    {layer.name}
                  </p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-dim">
                    {layer.meta}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <figcaption className="mt-4 text-center text-[13px] leading-relaxed text-dim">
        The PaperString studio — brush, text, photos and stickers on layered
        pages. Everything saves itself as you work.
      </figcaption>
    </figure>
  );
}
