"use client";

/**
 * EditorTour — a one-time guided coach-mark overlay for first-time creators.
 *
 * A spotlight cutout (huge box-shadow dims everything except the target)
 * glides between the real editor regions — tool rail, tool panel, canvas,
 * layers, share — while a warm tooltip explains each. Steps whose target
 * is not present on this viewport (e.g. the desktop layers rail on phones)
 * are skipped automatically. Runs once per browser (localStorage flag) and
 * can be replayed from the keyboard-shortcuts popover ("Show the guided
 * tour").
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Heart } from "lucide-react";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import { cn } from "@/lib/utils";

/** localStorage flag — set once the tour completes (or is skipped). */
export const TOUR_STORAGE_KEY = "ps-editor-tour-v1";

interface TourStep {
  /** data-tour attribute of the highlight target. */
  target: string;
  title: string;
  body: string;
  /** Optional prep before the step is shown (e.g. open a panel). */
  prepare?: () => void;
}

const PAD = 8; // spotlight padding around the target rect
const CARD_W = 300;
const CARD_H_EST = 190; // estimated card height for placement math

const STEPS: TourStep[] = [
  {
    target: "tools",
    title: "Pick your tools",
    body: "Brush, text, stickers and more live in this rail — plus two finishing touches: F softens with a dreamy blur, D smudges like a wet finger. Each tool has a one-key shortcut; hover one to see it.",
  },
  {
    target: "panel",
    title: "Tune it here",
    body: "The panel follows your tool: size, opacity, color, fonts, text curves — everything you need, nothing you don't.",
    prepare: () => {
      // The panel only exists while a panelled tool is active — nudge one on.
      const s = useEditorStore.getState();
      if (s.tool !== "brush" && s.tool !== "eraser") s.setTool("brush");
    },
  },
  {
    target: "canvas",
    title: "Make your mark",
    body: "Tap a page and simply start. Every stroke lands on its own layer, so nothing gets lost — and Ctrl+Z is always there for you. Drawing with Apple Pencil? Press lighter or harder and your strokes follow.",
  },
  {
    target: "layers",
    title: "Stack your story",
    body: "Paint, text, photos — each piece is a layer you can reorder, hide or blend. Merge them when it feels right.",
  },
  {
    target: "layers-mobile",
    title: "Stack your story",
    body: "Paint, text, photos — each piece is a layer. Tap here to open the layer stack and reorder, hide or blend.",
  },
  {
    target: "share",
    title: "Share the feeling",
    body: "One tap turns your book into a link. Whoever opens it flips through your pages — no account, no app, just your message.",
  },
];

/** Visible = has a rendered box (display:none collapses to 0×0). */
function findTarget(sel: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${sel}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return el;
}

export function EditorTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const finish = useCallback(
    (next: number) => {
      try {
        window.localStorage.setItem(TOUR_STORAGE_KEY, "1");
      } catch {
        /* storage unavailable — tour may replay, harmless */
      }
      onClose();
      setIndex(Math.max(0, Math.min(next, STEPS.length - 1)));
    },
    [onClose]
  );

  /* Reset the tour whenever it (re)opens — state adjust during render, the
     sanctioned pattern (no effect, no cascading render). */
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setIndex(0);
      setSpot(null);
      setPlace(null);
    }
  }

  /* Resolve the next step index. Steps with a `prepare` (e.g. the tool
     panel, which must first be mounted by switching tools) are accepted
     optimistically — their effect preps and, if the target still fails to
     appear, auto-advances. Steps without prepare are checked synchronously
     (absent targets are skipped: layers rail on mobile, layers button on
     desktop, …). */
  const resolveStep = useCallback(
    (from: number, dir: 1 | -1): number | null => {
      let i = from;
      while (i >= 0 && i < STEPS.length) {
        const step = STEPS[i];
        if (step.prepare || findTarget(step.target)) return i;
        i += dir;
      }
      // Ran off the end — finish the tour.
      finish(dir === 1 ? STEPS.length - 1 : 0);
      return null;
    },
    [finish]
  );

  const dirRef = useRef(1);

  const next = useCallback(() => {
    dirRef.current = 1;
    const i = resolveStep(index + 1, 1);
    if (i !== null) setIndex(i);
  }, [index, resolveStep]);

  const back = useCallback(() => {
    dirRef.current = -1;
    const i = resolveStep(index - 1, -1);
    if (i !== null) setIndex(i);
  }, [index, resolveStep]);

  /* Prep + measure the spotlight target. Measurement is scheduled on
     rAF/timeout so late-mounting panels (prepare() flips the active tool,
     which mounts ToolPanel) settle before we read their rects. */
  const measure = useCallback(() => {
    if (!open) return;
    const step = STEPS[index];
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect();
    setSpot({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });

    // Card placement: below the spotlight if it fits, otherwise above.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = r.bottom + PAD + 12;
    if (top + CARD_H_EST > vh - 12) top = Math.max(12, r.top - PAD - 12 - CARD_H_EST);
    const left = Math.max(12, Math.min(r.left, vw - CARD_W - 12));
    setPlace({ top, left });
  }, [index, open]);

  useEffect(() => {
    if (!open) return;
    const step = STEPS[index];
    step?.prepare?.();
    const raf = requestAnimationFrame(measure);
    const t1 = window.setTimeout(measure, 90);
    const t2 = window.setTimeout(measure, 320);
    // A prepared step that still never appeared (panel can't mount?) —
    // quietly advance in the travel direction instead of showing nothing.
    const t3 = window.setTimeout(() => {
      if (findTarget(step.target)) return;
      const i = resolveStep(index + dirRef.current, dirRef.current);
      if (i !== null) setIndex(i);
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [index, open, measure, resolveStep]);

  /* Track viewport changes while open. */
  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, measure]);

  /* Keys: Escape closes, Enter/Space advance. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(index);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, index, next, back, finish]);

  /* Focus the card so Enter/Escape context is obvious. */
  useEffect(() => {
    if (open) cardRef.current?.focus();
  }, [open, index]);

  if (!open) return null;

  const step = STEPS[index];
  if (!step) return null;
  const isLast = index === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      {/* the dimming layer */}
      <div className="absolute inset-0 bg-night/40" />

      {/* spotlight — a transparent window whose huge box-shadow dims the rest */}
      {spot && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl outline outline-2 outline-white/90 transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{
            left: spot.x,
            top: spot.y,
            width: spot.w,
            height: spot.h,
            boxShadow: "0 0 0 100vmax rgba(19,19,19,0.62)",
          }}
        />
      )}

      {/* the tooltip card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label={`${step.title} — guided tour, step ${index + 1}`}
        tabIndex={-1}
        style={place ? { top: place.top, left: place.left, width: CARD_W } : undefined}
        className={cn(
          "fixed z-[71] rounded-xl border border-editor-border-strong bg-editor-panel/95 p-4 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.3)] backdrop-blur-sm",
          "outline-none transition-all duration-300 ease-out motion-reduce:transition-none",
          !place && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-editor-dim">
          Step {index + 1} of {STEPS.length}
        </p>
        <h3 className="mt-1.5 font-display text-lg leading-snug text-editor-text">
          {step.title}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-editor-dim">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index ? "w-4 bg-night" : "w-1.5 bg-[#d8d8d8]"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={back}
              disabled={index === 0}
              className="grid h-8 w-8 place-items-center rounded-xl border border-editor-border-strong text-editor-dim transition hover:bg-editor-raised hover:text-editor-text active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous tip"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={next}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-smoke px-4 text-xs font-medium text-night transition hover:bg-white active:scale-[0.97]"
            >
              {isLast ? (
                <>
                  Start creating
                  <Heart className="h-3.5 w-3.5 text-heart" fill="currentColor" strokeWidth={0} aria-hidden="true" />
                </>
              ) : (
                "Next"
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => finish(index)}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-editor-dim/70 transition hover:bg-editor-raised hover:text-editor-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#155EEF]"
          aria-label="Skip the tour"
          title="Skip the tour"
        >
          <span aria-hidden="true" className="text-xs leading-none">
            ✕
          </span>
        </button>
      </div>
    </div>
  );
}
