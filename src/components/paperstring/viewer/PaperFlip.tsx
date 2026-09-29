"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  clamp01,
  computeFlipVisual,
  easeFlip,
  type FlipDir,
} from "./flip-engine";

export interface PaperFlipHandle {
  /** Turn forward. At the last page: gentle boundary nudge, no flip. */
  next: () => void;
  /** Turn backward. At the first page: gentle boundary nudge, no flip. */
  prev: () => void;
}

export interface PaperFlipProps {
  /** Page sources — PNG data URLs or plain paths. Portrait 9:16. */
  pages: string[];
  title: string;
  /** Page the book opens on (clamped) — used to resume a session. */
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

/* ── Tunables ──────────────────────────────────────────────────────────── */

/** Pointer travel before a gesture commits to a direction. */
const DRAG_THRESHOLD_PX = 8;
/** A swipe this wide commits the flip on release (Flow: touch swipe). */
const SWIPE_MIN_PX = 48;
/** Flick velocity that commits the flip, in px/ms. */
const FLICK_VELOCITY = 0.4;
/** Release beyond this progress completes the flip. */
const COMPLETE_PROGRESS = 0.3;
/** Floor for short tween runs so partial runs never feel instant. */
const MIN_TWEEN_MS = 180;
/** Crossfade duration for prefers-reduced-motion (FR-13.P3). */
const XFADE_MS = 150;

/* ── Styling constants ─────────────────────────────────────────────────── */

/**
 * Book sizing: a portrait 9:16 page that always fits — capped by 78% of the
 * viewport height and by (viewport width − 32px), so it never crops, distorts
 * or overflows. svh is used where supported so mobile browser chrome can't
 * push it off-screen. (Inline <style> because the height rule needs a
 * two-line fallback cascade; everything else stays in Tailwind utilities.)
 */
const BOOK_CSS = `
.psv-book {
  --psv-h: min(78vh, calc((100vw - 32px) * 16 / 9));
  height: var(--psv-h);
  width: calc(var(--psv-h) * 9 / 16);
}
@supports (height: 100svh) {
  .psv-book {
    --psv-h: min(78svh, calc((100vw - 32px) * 16 / 9));
  }
}`;

/** A page face: clipping + the subtle white paper edge (inner highlight). */
const FACE_CLASS =
  "absolute inset-0 overflow-hidden rounded-xl bg-[#141414] " +
  "shadow-[inset_1px_0_0_0_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(255,255,255,0.06)]";

const PAGE_IMG_CLASS =
  "pointer-events-none absolute inset-0 h-full w-full select-none object-contain";

/** Shading gradients — monochrome black at low opacities; only their opacity
 *  (and transform for the edge band) is animated, per frame, from JS. */
const FRONT_SHADE_STYLE = {
  opacity: 0,
  background:
    "linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.22) 38%, rgba(0,0,0,0) 70%)",
};

const BACK_SHADE_STYLE = {
  opacity: 0,
  background:
    "linear-gradient(to left, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.22) 38%, rgba(0,0,0,0) 70%)",
};

/** Hinge-side fold shadow pooled against the spine. */
const SPINE_SHADOW_STYLE = {
  opacity: 0,
  background: "linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 14%)",
};

/** Cast-shadow band anchored to the leaf's sweeping free edge. */
const EDGE_SHADOW_STYLE = {
  opacity: 0,
  transform: "translateX(100%)",
  background:
    "linear-gradient(to right, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.32) 22%, rgba(0,0,0,0) 46%)",
};

interface DragState {
  id: number;
  startX: number;
  startY: number;
  width: number;
  active: boolean;
  dead: boolean;
  dir: FlipDir;
  history: { x: number; t: number }[];
}

/**
 * THE SIGNATURE — a CSS-3D page-turn that feels physical.
 *
 * Interaction model:
 *  • click/tap zones — right 42% of the stage → next, left 42% → prev
 *    (the centre 16% is reserved so resting taps never flip accidentally)
 *  • drag — pointerdown on the page + horizontal drag drives the turn
 *    directly; release beyond 30% progress / 48px / flick velocity completes
 *  • swipe on touch — ≥ 48px commits the flip
 *  • keyboard — ← / → (and PageUp / PageDown)
 *  • while a tween runs, new triggers are ignored (no queueing); the opposite
 *    direction is always available once the current turn settles
 *
 * Rendering model: React state only mounts/unmounts the leaf and commits the
 * index; the 680ms tween and drags write transform/opacity straight to the
 * DOM inside a requestAnimationFrame loop, so nothing re-renders per frame.
 */
export const PaperFlip = forwardRef<PaperFlipHandle, PaperFlipProps>(
  function PaperFlip({ pages, title, initialIndex = 0, onIndexChange }, ref) {
    const reduced = useReducedMotion() ?? false;
    const single = pages.length <= 1;
    const interactive = !single;

    /* ── state (mount/commit only — never per-frame) ──────────────────── */
    const startIndex = Math.min(Math.max(0, Math.floor(initialIndex)), Math.max(0, pages.length - 1));
    const [index, setIndex] = useState(startIndex);
    const [leaf, setLeaf] = useState<FlipDir | null>(null);
    const [xfadeTarget, setXfadeTarget] = useState<number | null>(null);

    /* ── refs: engine + DOM handles ───────────────────────────────────── */
    const indexRef = useRef(startIndex);
    const flipRef = useRef<{ dir: FlipDir; progress: number } | null>(null);
    const rafRef = useRef(0);
    const lockRef = useRef(false);
    const autoTweenRef = useRef(false);
    const dragRef = useRef<DragState | null>(null);
    const flipDurationRef = useRef(680);
    const xfadeTimerRef = useRef(0);
    const shakeRef = useRef<Animation | null>(null);

    const stageRef = useRef<HTMLDivElement | null>(null);
    const leafRef = useRef<HTMLDivElement | null>(null);
    const frontFaceRef = useRef<HTMLDivElement | null>(null);
    const backFaceRef = useRef<HTMLDivElement | null>(null);
    const frontShadeRef = useRef<HTMLDivElement | null>(null);
    const backShadeRef = useRef<HTMLDivElement | null>(null);
    const spineShadowRef = useRef<HTMLDivElement | null>(null);
    const edgeShadowRef = useRef<HTMLDivElement | null>(null);

    /* ── derived page sources ─────────────────────────────────────────── */
    const beneathSrc =
      leaf === "next"
        ? pages[index + 1]
        : leaf === "prev"
          ? pages[index - 1]
          : pages[index];
    const frontSrc =
      leaf === "next" ? pages[index] : leaf === "prev" ? pages[index - 1] : undefined;
    const backSrc =
      leaf === "next" ? pages[index + 1] : leaf === "prev" ? pages[index] : undefined;

    /* ── engine ───────────────────────────────────────────────────────── */

    /** Write the current frame's transform/opacity for the whole scene. */
    const applyProgress = () => {
      const f = flipRef.current;
      if (!f) return;
      const v = computeFlipVisual(f.dir, f.progress);
      if (leafRef.current) {
        leafRef.current.style.transform = `rotateY(${v.angle}deg) translateZ(${v.lift}px)`;
      }
      if (frontFaceRef.current)
        frontFaceRef.current.style.opacity = String(v.faceOpacity);
      if (backFaceRef.current)
        backFaceRef.current.style.opacity = String(v.faceOpacity);
      if (frontShadeRef.current)
        frontShadeRef.current.style.opacity = String(v.frontShade);
      if (backShadeRef.current)
        backShadeRef.current.style.opacity = String(v.backShade);
      if (spineShadowRef.current)
        spineShadowRef.current.style.opacity = String(v.castShadow * 0.8);
      if (edgeShadowRef.current) {
        edgeShadowRef.current.style.opacity = String(v.castShadow);
        edgeShadowRef.current.style.transform = `translateX(${v.edgeX.toFixed(2)}%)`;
      }
    };

    const stopTween = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };

    /**
     * Time-based tween sharing the design tokens: duration `--duration-flip`
     * scaled to the remaining span, easing `--ease-flip` applied here (not as
     * a CSS transition) so drags and tween completions feel identical.
     */
    const runTween = (from: number, to: number, onDone: () => void) => {
      stopTween();
      const span = Math.abs(to - from);
      const duration = Math.max(MIN_TWEEN_MS, flipDurationRef.current * span);
      const startedAt = performance.now();
      const step = (now: number) => {
        const f = flipRef.current;
        if (!f) return;
        const raw = clamp01((now - startedAt) / duration);
        f.progress = from + (to - from) * easeFlip(raw);
        applyProgress();
        if (raw < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = 0;
          onDone();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };

    const commitIndex = (i: number) => {
      indexRef.current = i;
      setIndex(i);
      onIndexChange?.(i);
    };

    /** Leaf settles flat off-book → it is already invisible; swap beneath. */
    const finishFlip = () => {
      const f = flipRef.current;
      if (!f) {
        lockRef.current = false;
        return;
      }
      commitIndex(indexRef.current + (f.dir === "next" ? 1 : -1));
      flipRef.current = null;
      setLeaf(null);
      lockRef.current = false;
    };

    /** Leaf settled back flat on the book, covering it exactly; swap beneath. */
    const cancelFlip = () => {
      flipRef.current = null;
      setLeaf(null);
      lockRef.current = false;
    };

    const beginFlip = (dir: FlipDir) => {
      flipRef.current = { dir, progress: 0 };
      lockRef.current = true;
      autoTweenRef.current = true;
      setLeaf(dir);
    };

    // When the leaf mounts: paint the first frame immediately (before the
    // browser paints), then auto-run the tween for tap/key flips. Drags set
    // autoTweenRef = false and drive progress themselves.
    useLayoutEffect(() => {
      if (!leaf) return;
      applyProgress();
      if (autoTweenRef.current) {
        autoTweenRef.current = false;
        runTween(0, 1, finishFlip);
      }
    }, [leaf]);

    /** Boundary nudge (Flow 4.6) — 6px, 200ms, translateX keyframes. */
    const nudge = () => {
      const el = stageRef.current;
      if (!el || typeof el.animate !== "function") return;
      shakeRef.current?.cancel();
      shakeRef.current = el.animate(
        [
          { transform: "translateX(0px)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(-2px)" },
          { transform: "translateX(0px)" },
        ],
        { duration: 200, easing: "ease-out" }
      );
    };

    /* ── reduced-motion path: 150ms opacity crossfade, no spatial motion ── */
    const crossfadeTo = (target: number) => {
      lockRef.current = true;
      setXfadeTarget(target);
      window.clearTimeout(xfadeTimerRef.current);
      xfadeTimerRef.current = window.setTimeout(() => {
        commitIndex(target);
        setXfadeTarget(null);
        lockRef.current = false;
      }, XFADE_MS);
    };

    /* ── public controls (chevrons, keys, zones all route through these) ── */
    const canGo = (dir: FlipDir) =>
      dir === "next" ? indexRef.current < pages.length - 1 : indexRef.current > 0;

    const next = () => {
      if (!interactive || lockRef.current) return;
      if (!canGo("next")) {
        nudge();
        return;
      }
      if (reduced) {
        crossfadeTo(indexRef.current + 1);
        return;
      }
      beginFlip("next");
    };

    const prev = () => {
      if (!interactive || lockRef.current) return;
      if (!canGo("prev")) {
        nudge();
        return;
      }
      if (reduced) {
        crossfadeTo(indexRef.current - 1);
        return;
      }
      beginFlip("prev");
    };

    useImperativeHandle(ref, () => ({ next, prev }));

    /* ── gestures ─────────────────────────────────────────────────────── */

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // A tween or crossfade is running → ignore new triggers entirely.
      if (lockRef.current) {
        dragRef.current = null;
        return;
      }
      const width = stageRef.current?.getBoundingClientRect().width ?? 0;
      dragRef.current = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        width: Math.max(1, width),
        active: false,
        dead: false,
        dir: "next",
        history: [{ x: e.clientX, t: performance.now() }],
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || d.dead || e.pointerId !== d.id) return;

      const now = performance.now();
      d.history.push({ x: e.clientX, t: now });
      while (d.history.length > 2 && now - d.history[0].t > 140) d.history.shift();

      // Reduced motion: no continuous spatial dragging — decide on release.
      if (reduced) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (!d.active) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        // Vertical intent → not a page turn; let the gesture go nowhere.
        if (Math.abs(dx) <= Math.abs(dy)) {
          d.dead = true;
          return;
        }
        const dir: FlipDir = dx < 0 ? "next" : "prev";
        if (!canGo(dir)) {
          d.dead = true;
          nudge();
          return;
        }
        d.dir = dir;
        d.active = true;
        flipRef.current = { dir, progress: 0 };
        lockRef.current = true;
        autoTweenRef.current = false;
        setLeaf(dir);
      }

      const f = flipRef.current;
      if (!f) return;
      // Dragging left maps dx 0 → −stageWidth onto progress 0 → 1 (next);
      // dragging right does the same for prev.
      const travel =
        d.dir === "next" ? d.startX - e.clientX : e.clientX - d.startX;
      f.progress = clamp01(travel / d.width);
      applyProgress();
    };

    const tapZone = (clientX: number) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rel = (clientX - rect.left) / rect.width;
      if (rel < 0.42) prev();
      else if (rel > 0.58) next();
      // the middle 16% is deliberately inert
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || e.pointerId !== d.id) return;

      if (!d.active) {
        if (d.dead) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        // Reduced motion: an explicit ≥48px horizontal swipe still turns.
        if (reduced && Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) next();
          else prev();
          return;
        }
        tapZone(e.clientX);
        return;
      }

      // Drag release: finish if past threshold, far enough, or flicking.
      const f = flipRef.current;
      if (!f) {
        lockRef.current = false;
        return;
      }
      const now = performance.now();
      let first = d.history[0];
      for (const h of d.history) {
        if (now - h.t <= 140) {
          first = h;
          break;
        }
      }
      const last = d.history[d.history.length - 1];
      const dt = last.t - first.t;
      const vx = dt > 0 ? (last.x - first.x) / dt : 0; // px/ms
      const forward = d.dir === "next" ? -vx : vx; // positive = flip direction
      const travel =
        d.dir === "next" ? d.startX - e.clientX : e.clientX - d.startX;

      if (
        f.progress > COMPLETE_PROGRESS ||
        travel >= SWIPE_MIN_PX ||
        forward > FLICK_VELOCITY
      ) {
        runTween(f.progress, 1, finishFlip);
      } else {
        runTween(f.progress, 0, cancelFlip);
      }
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || e.pointerId !== d.id) return;
      if (d.active) {
        const f = flipRef.current;
        if (f) runTween(f.progress, 0, cancelFlip);
        else lockRef.current = false;
      }
    };

    // Safety net: if the browser tears the capture away mid-drag.
    const handleLostCapture = () => {
      const d = dragRef.current;
      dragRef.current = null;
      if (d?.active) {
        const f = flipRef.current;
        if (f) runTween(f.progress, 0, cancelFlip);
        else lockRef.current = false;
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
    };

    /* ── lifecycle: tokens, preloading, body scroll lock, cleanup ─────── */

    // Read the motion tokens so the engine and the design system stay in sync.
    useEffect(() => {
      const ms = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--duration-flip"
        )
      );
      if (Number.isFinite(ms) && ms >= 100) flipDurationRef.current = ms;
    }, []);

    // The turning leaf sweeps left of the book: while the viewer is mounted,
    // pin the page so the rotation can never produce a horizontal scrollbar.
    useEffect(() => {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }, []);

    // Preload the neighbours so a turn never flashes blank (data URLs decode
    // from cache; plain paths warm the browser cache).
    useEffect(() => {
      for (const n of [index + 1, index - 1]) {
        const src = pages[n];
        if (src) {
          const img = new Image();
          img.src = src;
        }
      }
    }, [pages, index]);

    // Idle hygiene: no rAF loop left running, no timers, no animations.
    useEffect(() => {
      return () => {
        stopTween();
        window.clearTimeout(xfadeTimerRef.current);
        shakeRef.current?.cancel();
      };
    }, []);

    if (!pages.length) return null;

    /* ── render ───────────────────────────────────────────────────────── */
    return (
      <div
        ref={stageRef}
        role="region"
        aria-label={`Shared PaperString book: ${title}`}
        tabIndex={0}
        onKeyDown={interactive ? handleKeyDown : undefined}
        onPointerDown={interactive ? handlePointerDown : undefined}
        onPointerMove={interactive ? handlePointerMove : undefined}
        onPointerUp={interactive ? handlePointerUp : undefined}
        onPointerCancel={interactive ? handlePointerCancel : undefined}
        onLostPointerCapture={handleLostCapture}
        className={cn(
          "ps-perspective psv-book relative touch-none select-none",
          "rounded-xl bg-[#161616] shadow-[0_36px_90px_-24px_rgba(0,0,0,0.85),0_12px_32px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/15",
          "outline-none transition-shadow",
          "focus-visible:ring-2 focus-visible:ring-silver/70 focus-visible:ring-offset-2 focus-visible:ring-offset-night",
          single && "ps-float"
        )}
      >
        <style dangerouslySetInnerHTML={{ __html: BOOK_CSS }} />

        <div className="absolute inset-0 ps-preserve-3d">
          {/* The page beneath — the destination of the current turn. */}
          <div className={FACE_CLASS}>
            {beneathSrc && (
              <img
                src={beneathSrc}
                alt=""
                draggable={false}
                decoding="async"
                className={PAGE_IMG_CLASS}
              />
            )}

            {/* Cast shadow of the turning leaf onto the page beneath. */}
            {leaf && (
              <>
                <div
                  ref={spineShadowRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 will-change-[opacity]"
                  style={SPINE_SHADOW_STYLE}
                />
                <div
                  ref={edgeShadowRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 w-full will-change-[transform,opacity]"
                  style={EDGE_SHADOW_STYLE}
                />
              </>
            )}

            {/* Reduced-motion crossfade overlay (opacity only). */}
            {xfadeTarget !== null && pages[xfadeTarget] && (
              <motion.img
                key={xfadeTarget}
                src={pages[xfadeTarget]}
                alt=""
                draggable={false}
                decoding="async"
                className={PAGE_IMG_CLASS}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: XFADE_MS / 1000, ease: "easeOut" }}
              />
            )}
          </div>

          {/* The turning leaf: current page in front, destination mirrored on
              its back. Hinged on the left edge; driven by the rAF engine. */}
          {leaf && frontSrc && backSrc && (
            <div
              ref={leafRef}
              aria-hidden="true"
              className="absolute inset-0 ps-preserve-3d will-change-transform"
              style={{
                transformOrigin: "left center",
                transform: "rotateY(0deg) translateZ(0.4px)",
              }}
            >
              <div
                ref={frontFaceRef}
                className={cn(FACE_CLASS, "ps-backface-hidden")}
              >
                <img
                  src={frontSrc}
                  alt=""
                  draggable={false}
                  decoding="async"
                  className={PAGE_IMG_CLASS}
                />
                <div
                  ref={frontShadeRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 will-change-[opacity]"
                  style={FRONT_SHADE_STYLE}
                />
              </div>
              <div
                ref={backFaceRef}
                className={cn(FACE_CLASS, "ps-backface-hidden")}
                style={{ transform: "rotateY(180deg)" }}
              >
                <img
                  src={backSrc}
                  alt=""
                  draggable={false}
                  decoding="async"
                  className={PAGE_IMG_CLASS}
                />
                <div
                  ref={backShadeRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 will-change-[opacity]"
                  style={BACK_SHADE_STYLE}
                />
              </div>
            </div>
          )}
        </div>

        {interactive && (
          <span className="sr-only">
            Use left and right arrow keys to turn pages.
          </span>
        )}
      </div>
    );
  }
);
