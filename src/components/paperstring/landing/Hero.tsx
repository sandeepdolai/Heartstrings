"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, Lock, MonitorSmartphone, Sparkles } from "lucide-react";
import { psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { FlipBookDemo } from "./FlipBookDemo";
import { btnPrimary, ghostAction } from "./shared";
import { cn } from "@/lib/utils";

const ASSURANCES = [
  { icon: Sparkles, text: "4K-quality pages" },
  { icon: MonitorSmartphone, text: "Works on every device" },
  { icon: Lock, text: "Viewers need no account" },
] as const;

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function Hero({ user }: { user: PsUser | null }) {
  const reduce = useReducedMotion();

  const startCreating = () => psNavigate(user ? "dashboard" : "auth");

  return (
    <section className="relative overflow-x-clip bg-paper">
      <div className="mx-auto flex min-h-[88svh] w-full max-w-6xl flex-col items-center justify-center gap-14 px-4 py-20 sm:px-6 lg:grid lg:min-h-[calc(100svh-4rem)] lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-24">
        {/* ── Left: the offer, stated plainly ─────────────────── */}
        <motion.div
          className="max-w-xl text-center lg:text-left"
          variants={reduce ? undefined : stagger}
          initial={reduce ? false : "hidden"}
          animate="show"
        >
          <motion.p
            variants={reduce ? undefined : rise}
            className="text-xs font-medium uppercase tracking-[0.14em] text-dim"
          >
            A creative studio for heartfelt cards &amp; books
          </motion.p>

          <motion.h1
            variants={reduce ? undefined : rise}
            className="ps-serif mt-4 text-[2.5rem] font-normal leading-[1.08] tracking-tight text-night sm:text-6xl lg:text-[4.25rem]"
          >
            Make something beautiful for someone you love.
          </motion.h1>

          <motion.p
            variants={reduce ? undefined : rise}
            className="mx-auto mt-6 max-w-[46ch] text-base leading-relaxed text-onyx sm:text-lg lg:mx-0"
          >
            Paint, write, and add photos or stickers across as many pages as
            you need — then share a single link. It opens as a flip-book your
            recipient can read anywhere. No design skills, no app, and no
            account needed to receive.
          </motion.p>

          <motion.div
            variants={reduce ? undefined : rise}
            className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
          >
            <button
              type="button"
              onClick={startCreating}
              className={cn(btnPrimary, "group h-12 px-7")}
            >
              Start creating — it&rsquo;s free
              <ArrowRight
                className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
            <a href="#how" className={cn(ghostAction, "h-12 px-6 text-sm font-medium")}>
              See how it works
            </a>
          </motion.div>

          <motion.ul
            variants={reduce ? undefined : rise}
            className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 border-t border-silver pt-6 lg:justify-start"
          >
            {ASSURANCES.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2 text-[13px] text-onyx"
              >
                <Icon className="h-4 w-4 text-dim" aria-hidden="true" />
                {text}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        {/* ── Right: the product itself, flipping ─────────────── */}
        {reduce ? (
          <div className="flex items-center justify-center">
            <FlipBookDemo />
          </div>
        ) : (
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
          >
            <FlipBookDemo />
          </motion.div>
        )}
      </div>
    </section>
  );
}
