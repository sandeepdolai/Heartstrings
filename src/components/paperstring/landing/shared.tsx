"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/paperstring/brand";
import "./landing.css";

/* ────────────────────────────────────────────────────────────
   Reveal — gentle while-in-view entrance, reduced-motion aware
   ──────────────────────────────────────────────────────────── */

export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
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
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────
   SectionHeading — eyebrow + display-serif title + muted sub
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
          "text-xs font-medium uppercase tracking-[0.18em]",
          dark ? "text-silver" : "text-dim"
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-4 ps-serif text-3xl leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]",
          dark ? "text-smoke" : "text-night"
        )}
      >
        {title}
      </h2>
      {sub ? (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed",
            dark ? "text-silver" : "text-dim"
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PageArt — showcase artwork with a graceful paper fallback
   (renders a blank page with the string-heart if the image
   cannot load, so the layout never looks broken)
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
   Shared button recipes (monochrome, pill aesthetic)
   ──────────────────────────────────────────────────────────── */

export const pillPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-night text-smoke transition-all duration-200 hover:bg-onyx hover:-translate-y-0.5 hover:shadow-lift-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night focus-visible:ring-offset-2 focus-visible:ring-offset-smoke";

export const ghostAction =
  "inline-flex items-center justify-center gap-2 rounded-full text-night/80 transition-colors duration-200 hover:bg-night/5 hover:text-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night focus-visible:ring-offset-2 focus-visible:ring-offset-smoke";
