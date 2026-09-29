"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowDown, ArrowRight, Lock, MonitorSmartphone, Sparkles } from "lucide-react";
import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { FlipBookDemo } from "./FlipBookDemo";
import { ghostAction, pillPrimary } from "./shared";
import { cn } from "@/lib/utils";

const ASSURANCES = [
  { icon: Sparkles, text: "4K-quality pages" },
  { icon: MonitorSmartphone, text: "Works on every device" },
  { icon: Lock, text: "Viewers need no account" },
] as const;

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: "easeOut" } },
};

/** A small silver hand-drawn stroke under the italic word — the string motif. */
function StringUnderline() {
  return (
    <svg
      className="absolute -bottom-1.5 left-0 h-2.5 w-full text-silver"
      viewBox="0 0 120 12"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 9C28 3 66 2.5 117 7.5"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Hero({ user }: { user: PsUser | null }) {
  const reduce = useReducedMotion();

  const startCreating = () =>
    psNavigate(user ? "dashboard" : "auth", { mode: "signup" });

  return (
    <section className="ps-grain relative overflow-x-clip bg-smoke">
      <div className="mx-auto flex min-h-[92svh] w-full max-w-6xl flex-col items-center justify-center gap-16 px-4 py-20 sm:px-6 lg:grid lg:min-h-[calc(100svh-4rem)] lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-24">
        {/* ── Left: message ─────────────────────────────────── */}
        <motion.div
          className="max-w-xl text-center lg:text-left"
          variants={reduce ? undefined : stagger}
          initial={reduce ? false : "hidden"}
          animate="show"
        >
          <motion.p
            variants={reduce ? undefined : rise}
            className="text-xs font-medium uppercase tracking-[0.25em] text-dim"
          >
            For love, friendship &amp; everything heartfelt
          </motion.p>

          <motion.h1
            variants={reduce ? undefined : rise}
            className="mt-5 ps-serif text-[2.65rem] font-medium leading-[1.05] tracking-tight text-night sm:text-6xl lg:text-7xl"
          >
            Make something{" "}
            <span className="relative inline-block whitespace-nowrap italic">
              beautiful
              <StringUnderline />
            </span>{" "}
            for someone you love.
          </motion.h1>

          <motion.p
            variants={reduce ? undefined : rise}
            className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-dim sm:text-lg lg:mx-0"
          >
            PaperString is a cozy creative studio for everyday people — paint,
            write and sticker your heart out across multiple pages, then share
            one link. No design skills, no app, no account needed to receive.
          </motion.p>

          <motion.div
            variants={reduce ? undefined : rise}
            className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          >
            <button
              type="button"
              onClick={startCreating}
              className={cn(pillPrimary, "group h-12 px-7 text-sm font-medium")}
            >
              Start creating — it&rsquo;s free
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
            <a href="#how" className={cn(ghostAction, "h-12 px-6 text-sm font-medium")}>
              See how it works
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </a>
          </motion.div>

          <motion.ul
            variants={reduce ? undefined : rise}
            className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 lg:justify-start"
          >
            {ASSURANCES.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2 text-[13px] text-dim"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {text}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        {/* ── Right: the signature flipbook ─────────────────── */}
        {reduce ? (
          <div className="flex items-center justify-center">
            <FlipBookDemo />
          </div>
        ) : (
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.35, ease: "easeOut" }}
          >
            <FlipBookDemo />
          </motion.div>
        )}
      </div>
    </section>
  );
}
