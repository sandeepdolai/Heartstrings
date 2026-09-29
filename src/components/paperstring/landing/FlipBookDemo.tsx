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
/** Drag distance (px) that equals a full page-turn. */
const DRAG_FULL_PX = 140;
/** Past this progress a released drag completes the turn; below it snaps back. */
const COMPLETE_AT = 0.42;

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
 * looping forever. Click the book, the flip button, press Enter — or DRAG
 * the page left like a real book (release past halfway to finish the turn,
 * earlier and it settles back).
 */
export function FlipBookDemo() {
  const reduce = useReducedMotion();
  /** Page indices, top of the stack first — order[0] is the visible sheet. */
  const [order, setOrder] = useState<number[]>(() => PAGES.map((_, i) => i));
  const [flipping, setFlipping] = useState(false);
  /** Live drag progress 0..1 (null = not dragging). */
  const [drag, setDrag] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{
    id: number;
    startX: number;
    moved: boolean;
    active: boolean;
  } | null>(null);
  /** Suppresses the click that follows a real drag (pointerup → click). */
  const suppressClickRef = useRef(false);

  // Never leave a pending flip behind if the view unmounts mid-turn.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const flip = useCallback(() => {
    if (flipping || dragRef.current?.active) return;
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

  /* ── drag-to-turn (a taste of the real viewer's paper-flip gesture) ─── */

  const onDragPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (reduce || flipping || e.button !== 0) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragRef.current = {
        id: e.pointerId,
        startX: e.clientX,
        moved: false,
        active: true,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [reduce, flipping]
  );

  const onDragPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      if (!d || !d.active || e.pointerId !== d.id) return;
      const dx = d.startX - e.clientX; // leftward drag = turning forward
      if (Math.abs(dx) > 8) d.moved = true;
      const progress = Math.max(0, Math.min(1, dx / DRAG_FULL_PX));
      setDrag(progress);
    },
    []
  );

  const finishTurn = useCallback(() => {
    setFlipping(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]]);
      setFlipping(false);
    }, FLIP_MS + SETTLE_MS);
  }, []);

  const onDragPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || !d.active || e.pointerId !== d.id) return;
      if (d.moved) suppressClickRef.current = true;
      const dx = d.startX - e.clientX;
      const progress = Math.max(0, Math.min(1, dx / DRAG_FULL_PX));
      setDrag(null);
      // A flick (fast leftward release) counts even below the distance bar.
      if (progress >= COMPLETE_AT || (d.moved && dx > 36)) {
        finishTurn();
      } else if (progress > 0) {
        setFlipping(false); // snap back via the 0deg transition
      }
    },
    [finishTurn]
  );

  const onDragClick = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return; // the drag already had its say
    }
    flip();
  }, [flip]);

  const topIdx = order[0];
  const stack = order.slice(1); // pages beneath the top sheet, nearest first
  const dragging = drag !== null;
  const turn = dragging ? drag : flipping ? 1 : 0;

  return (
    <div className="flex select-none flex-col items-center">
      <div className="ps-float relative">
        {/* The book itself — one generous tap target */}
        <button
          type="button"
          onClick={onDragClick}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
          disabled={flipping}
          aria-label={`Sample PaperString book — flip from “${PAGES[topIdx].label}” to the next page`}
          style={{ touchAction: "pan-y" }}
          className="group relative block cursor-grab rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-night focus-visible:ring-offset-4 focus-visible:ring-offset-smoke active:cursor-grabbing motion-reduce:cursor-pointer motion-reduce:active:cursor-pointer"
        >
          <div className="ps-perspective transition-transform duration-300 ease-out group-hover:-translate-y-1.5 motion-reduce:transform-none">
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

              {/* The top sheet — turns like a real page. While dragging it
                  follows the pointer with NO transition; on release it either
                  animates to -180° (turn completed) or back to 0°. */}
              <div
                key={topIdx}
                className="ps-preserve-3d absolute inset-0 z-30"
                style={{
                  transformOrigin: "left center",
                  transform: `rotateY(${-180 * turn}deg)`,
                  opacity: turn > 0.75 ? 0 : 1,
                  transition: dragging
                    ? "none"
                    : reduce
                      ? undefined
                      : `transform ${FLIP_MS}ms var(--ease-flip), opacity 240ms ease ${
                          Math.max(0, 1 - turn) * 440
                        }ms`,
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

          {/* soft shadow the stack rests on — stays put while the book
              lifts on hover, so it genuinely floats */}
          <div
            aria-hidden="true"
            className="absolute -bottom-5 left-1/2 h-8 w-[88%] -translate-x-1/2 rounded-[100%] bg-night/15 blur-xl transition-all duration-300 group-hover:w-[94%] group-hover:bg-night/25 motion-reduce:transition-none"
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
        Drag or tap the book to turn the page
      </p>

      <span className="sr-only" aria-live="polite">
        {`Sample book — ${PAGES[topIdx].label}, page ${topIdx + 1} of ${PAGES.length}`}
      </span>
    </div>
  );
}
