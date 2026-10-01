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
   SectionHeading — label + serif title + supporting copy.
   Centered by default; the label is small, quiet, uppercase.
   ──────────────────────────────────────────────────────────── */

export function SectionHeading({
  eyebrow,
  title,
  sub,
  align = "center",
  dark = false,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "center" | "left";
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className
      )}
    >
      <p
        className={cn(
          "text-xs font-medium uppercase tracking-[0.14em]",
          dark ? "text-silver" : "text-dim"
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          "ps-serif mt-3 text-3xl font-normal leading-tight tracking-tight sm:text-4xl",
          dark ? "text-smoke" : "text-night"
        )}
      >
        {title}
      </h2>
      {sub ? (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed",
            dark ? "text-silver" : "text-onyx"
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
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
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#1047C7] active:bg-[#1047C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-silver bg-paper text-sm font-medium text-night transition-colors duration-150 hover:border-night/40 hover:bg-smoke focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const ghostAction =
  "inline-flex items-center justify-center gap-2 rounded-lg text-onyx transition-colors duration-150 hover:bg-smoke hover:text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/* Legacy aliases — older sections still import these names. */
export const pillPrimary = btnPrimary;
