"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { BookOpen, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/paperstring/brand";
import { SHOWCASE_PAGES } from "./showcase-data";
import { PageArt } from "./shared";

/** The hero book uses the first four showcase pages. */
const PAGES = SHOWCASE_PAGES.slice(0, 4);

/** How long the CSS page-turn takes (matches --duration-flip). */
const FLIP_MS = 680;
/** Small grace period before the flipped sheet is cycled to the back. */
const SETTLE_MS = 40;

/**
 * Resting transforms of the sheets beneath the top page. Depth 0 lies flat
 * (it is the page fully revealed once the top sheet turns); deeper sheets
 * peek out at a casual angle, like a stack someone just put down.
 */
const STACK_TRANSFORMS: readonly (string | undefined)[] = [
  undefined,
  "rotate(-2.2deg) translate(-4px, -2px)",
  "rotate(2.6deg) translate(5px, -6px)",
];

const PAGE_FRAME =
  "rounded-lg bg-paper p-1.5 ring-1 ring-night/5 shadow-[0_1px_2px_rgba(19,19,19,0.06),0_10px_28px_-14px_rgba(19,19,19,0.28)]";

/**
 * The hero's signature moment: a small stack of sample pages that turns
 * like a real book — a 3D rotateY(-180°) page-flip from the left edge,
 * looping forever. Click the book, the flip button, or press Enter.
 */
export function FlipBookDemo() {
  const reduce = useReducedMotion();
  /** Page indices, top of the stack first — order[0] is the visible sheet. */
  const [order, setOrder] = useState<number[]>(() => PAGES.map((_, i) => i));
  const [flipping, setFlipping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Never leave a pending flip behind if the view unmounts mid-turn.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const flip = useCallback(() => {
    if (flipping) return;
    const cycle = () => setOrder((o) => [...o.slice(1), o[0]]);
    if (reduce) {
      cycle();
      return;
    }
    setFlipping(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      cycle();
      setFlipping(false);
    }, FLIP_MS + SETTLE_MS);
  }, [flipping, reduce]);

  const topIdx = order[0];
  const stack = order.slice(1); // pages beneath the top sheet, nearest first

  return (
    <div className="flex select-none flex-col items-center">
      <div className="ps-float relative">
        {/* The book itself — one generous tap target */}
        <button
          type="button"
          onClick={flip}
          disabled={flipping}
          aria-label={`Sample PaperString book — flip from “${PAGES[topIdx].label}” to the next page`}
          className="group relative block cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-night focus-visible:ring-offset-4 focus-visible:ring-offset-smoke"
        >
          <div className="ps-perspective">
            <div className="relative aspect-[9/16] w-[228px] sm:w-[272px] lg:w-[300px]">
              {/* Sheets resting beneath the top page */}
              {stack.map((pageIdx, depth) => (
                <div
                  key={pageIdx}
                  aria-hidden="true"
                  className={cn(
                    PAGE_FRAME,
                    "absolute inset-0 transition-transform duration-500 ease-out"
                  )}
                  style={{
                    transform: STACK_TRANSFORMS[depth],
                    zIndex: 20 - depth,
                  }}
                >
                  <PageArt
                    src={PAGES[pageIdx].src}
                    alt=""
                    eager={depth === 0}
                    className="h-full w-full rounded-md object-cover"
                  />
                </div>
              ))}

              {/* The top sheet — turns like a real page */}
              <div
                key={topIdx}
                className="ps-preserve-3d absolute inset-0 z-30"
                style={{
                  transformOrigin: "left center",
                  transform: flipping ? "rotateY(-180deg)" : "rotateY(0deg)",
                  opacity: flipping ? 0 : 1,
                  transition: reduce
                    ? undefined
                    : `transform ${FLIP_MS}ms var(--ease-flip), opacity 240ms ease 440ms`,
                  willChange: "transform",
                }}
              >
                {/* front — the artwork */}
                <div className="ps-backface-hidden absolute inset-0 rounded-lg bg-paper p-1.5 ring-1 ring-night/5 shadow-[0_1px_2px_rgba(19,19,19,0.06),0_14px_32px_-12px_rgba(19,19,19,0.3)]">
                  <PageArt
                    src={PAGES[topIdx].src}
                    alt=""
                    eager
                    className="h-full w-full rounded-md object-cover"
                  />
                </div>
                {/* back — plain paper, a small beating heart */}
                <div className="ps-backface-hidden absolute inset-0 rounded-lg bg-paper p-1.5 ring-1 ring-night/5 shadow-[0_1px_2px_rgba(19,19,19,0.06),0_14px_32px_-12px_rgba(19,19,19,0.3)] [transform:rotateY(180deg)]">
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-md border border-silver/20 bg-smoke/40">
                    <LogoMark className="ps-heartbeat h-8 w-9 text-silver" />
                    <p className="ps-serif text-sm italic text-dim">for you</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* soft shadow the stack rests on */}
          <div
            aria-hidden="true"
            className="absolute -bottom-5 left-1/2 h-8 w-[88%] -translate-x-1/2 rounded-[100%] bg-night/15 blur-xl"
          />
        </button>

        {/* compact flip control */}
        <button
          type="button"
          onClick={flip}
          disabled={flipping}
          aria-label="Flip the page"
          className="absolute -bottom-3 -right-3 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-night text-smoke shadow-[0_10px_24px_-6px_rgba(19,19,19,0.45)] transition-all duration-200 hover:scale-105 hover:bg-onyx active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-night focus-visible:ring-offset-2 focus-visible:ring-offset-smoke"
        >
          <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </div>

      {/* position dots */}
      <div aria-hidden="true" className="mt-7 flex items-center gap-2">
        {PAGES.map((page, i) => (
          <span
            key={page.src}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === topIdx ? "w-5 bg-night" : "w-1.5 bg-silver"
            )}
          />
        ))}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-dim">
        <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />
        Tap the book to flip the page
      </p>

      <span className="sr-only" aria-live="polite">
        {`Sample book — ${PAGES[topIdx].label}, page ${topIdx + 1} of ${PAGES.length}`}
      </span>
    </div>
  );
}
