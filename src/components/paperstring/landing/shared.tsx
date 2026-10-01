"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/paperstring/brand";
import "./landing.css";

/* ────────────────────────────────────────────────────────────
   Reveal — quiet while-in-view entrance, reduced-motion aware.
   One motion idea for the whole page; nothing loops, nothing
   floats.
   ──────────────────────────────────────────────────────────── */

export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
    >
      {children}</motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   SectionShell — the numbered-document section pattern used
   across the whole page. Every section opens with a hairline,
   its index (serif numeral) and an uppercase label; the title
   and supporting copy sit beneath. Left-aligned, editorial.

     ─────────────────────────────────────────────
     02  THE PROBLEM
     The photos live on your phone.
     The words stay unsent.
     [supporting copy]
   ──────────────────────────────────────────────────────────── */

export function SectionShell({
  id,
  num,
  label,
  title,
  sub,
  tone = "paper",
  aside,
  children,
  className,
}: {
  id?: string;
  num: string;
  label: string;
  title: ReactNode;
  sub?: ReactNode;
  /** paper = white ground · smoke = off-white band */
  tone?: "paper" | "smoke";
  /** optional right-aligned content beside the heading (lg+) */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 border-t border-silver",
        tone === "smoke" ? "bg-smoke" : "bg-paper",
        className
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <Reveal>
          <div className="flex items-baseline gap-3">
            <span
              aria-hidden="true"
              className="ps-serif text-lg leading-none text-dim"
            >
              {num}
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-night">
              {label}
            </h2>
          </div>
          <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="ps-serif text-3xl font-semibold leading-[1.12] tracking-[-0.035em] text-night sm:text-4xl lg:text-5xl">
                {title}
              </p>
              {sub ? (
                <p className="mt-4 max-w-xl text-base leading-7 text-onyx sm:text-lg">
                  {sub}
                </p>
              ) : null}
            </div>
            {aside ? <div className="shrink-0">{aside}</div> : null}
          </div>
        </Reveal>
        {children}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   Kicker — the hero's opening line: a short rule, then an
   uppercase label. States the category before the headline
   makes its promise.
   ──────────────────────────────────────────────────────────── */

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-onyx">
      <span aria-hidden="true" className="h-px w-8 bg-night/60" />
      {children}
    </p>
  );
}

/* ────────────────────────────────────────────────────────────
   PageArt — showcase artwork with a graceful fallback (renders a
   blank page with the mark if the image cannot load, so the
   layout never looks broken)
   ──────────────────────────────────────────────────────────── */

export function PageArt({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role={alt ? "img" : "presentation"}
        aria-label={alt || undefined}
        className={cn("flex items-center justify-center bg-smoke", className)}
      >
        <LogoMark className="h-8 w-9 text-silver" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

/* ────────────────────────────────────────────────────────────
   Shared button recipes — professional, restrained radii.
   Blue appears ONLY on the primary action of a region.
   ──────────────────────────────────────────────────────────── */

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#1047C7] active:bg-[#1047C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-md border border-silver bg-paper text-sm font-medium text-night transition-colors duration-150 hover:border-night/40 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const ghostAction =
  "inline-flex items-center justify-center gap-2 rounded-md text-onyx transition-colors duration-150 hover:bg-smoke hover:text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/* Legacy aliases — older sections still import these names. */
export const pillPrimary = btnPrimary;
