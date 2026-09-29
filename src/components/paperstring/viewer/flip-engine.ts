/**
 * PaperString flip engine — the pure math behind the signature paper-flip.
 *
 * Geometry
 * ────────
 * The leaf (the turning page) is a full-size copy of a page, hinged on its
 * LEFT edge. We describe its position with t ∈ [0, 1]:
 *
 *   t = 0  → rotateY(0deg)    leaf lies flat ON the book (covers it exactly)
 *   t = 0.5 → rotateY(-90deg) leaf stands edge-on, pointing at the viewer
 *   t = 1  → rotateY(-180deg) leaf lies flat OFF-book (mirrored, to the left)
 *
 * A forward flip (next page) drives t 0 → 1 as `progress` goes 0 → 1.
 * A backward flip (prev page) drives t 1 → 0 as `progress` goes 0 → 1.
 *
 * Faces
 * ─────
 * The leaf has two backface-hidden faces. The face visible while the leaf is
 * over the book (t < 0.5) is the "front"; the face visible once it has passed
 * 90° (t > 0.5) is the "back", mounted with rotateY(180deg) so the artwork
 * reads correctly from behind.
 *
 *   forward: front = current page, back = next page,     beneath = next page
 *   backward: front = previous page, back = current page, beneath = previous page
 *
 * Both flip directions start and end with the leaf either exactly covering
 * the book (t = 0) or faded out at the off-book extreme (t = 1), so mounting
 * and unmounting the leaf is always visually seamless.
 */

export type FlipDir = "next" | "prev";

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Hermite smoothstep between two edges — smooth starts and stops. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Cubic-bézier easing solver (the same math CSS cubic-bezier() uses), so the
 * requestAnimationFrame tween can share the exact curve of `var(--ease-flip)`.
 * Newton–Raphson with a bisection fallback. Dependency-free.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Newton–Raphson
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) return sampleY(t);
      const d = sampleDx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    // Bisection fallback
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const dx = sampleX(t);
      if (Math.abs(dx - x) < 1e-6) break;
      if (x > dx) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

/** Mirrors the design token `--ease-flip: cubic-bezier(0.22, 0.9, 0.32, 1)`. */
export const easeFlip = cubicBezier(0.22, 0.9, 0.32, 1);

export interface FlipVisual {
  /** Leaf rotation in degrees, always within [-180, 0]. */
  angle: number;
  /** translateZ lift in px — rides just above the page beneath, peaking mid-flip. */
  lift: number;
  /**
   * Opacity for both faces. Near the t = 1 extreme the leaf lies off-book over
   * the dark margin, so it fades there — appear/disappear is never a hard cut.
   */
  faceOpacity: number;
  /** Front-face shading 0..1 (deepens as the page lifts, darkest at the spine). */
  frontShade: number;
  /** Back-face shading 0..1 (dark edge-on → lit as it opens → sinks into shadow). */
  backShade: number;
  /** Envelope 0..1 for the shadow the leaf casts onto the page beneath. */
  castShadow: number;
  /** Position of the leaf's free edge, as a % of page width, for the edge shadow. */
  edgeX: number;
}

/**
 * The physical lighting model of a turning page, as a pure function of the
 * flip direction and progress. Everything here maps to transform/opacity only.
 */
export function computeFlipVisual(dir: FlipDir, progress: number): FlipVisual {
  const p = clamp01(progress);
  // t = how far the leaf is from lying flat on the book (see header comment).
  const t = dir === "next" ? p : 1 - p;

  const angle = -180 * t;
  // Lift follows the *flip* progress (not t) so both directions lift mid-way.
  const lift = 0.4 + 1.6 * Math.sin(Math.PI * p);

  // Fade only at the off-book extreme (t → 1), where the leaf is displaced
  // into the dark margin beside the book.
  const faceOpacity = 1 - smoothstep(0.86, 1, t);

  // Front face: evenly lit while flat, catches progressively less light as it
  // swings up; the hinge side stays deepest.
  const frontShade = 0.45 * smoothstep(0.04, 0.46, t);

  // Back face: almost edge-on darkness at 90°, opens toward the light as it
  // flattens, then sinks into shadow as it settles off-book.
  const backShade =
    0.3 + 0.25 * (1 - smoothstep(0.5, 0.75, t)) + 0.55 * smoothstep(0.82, 1, t);

  // The leaf shades the page beneath while it is above the book: none while
  // flat, deepest around a third of the turn, gone once it has swept past.
  const castShadow = 0.42 * Math.sin(Math.PI * clamp01(t / 0.78));

  // The free edge sweeps from the right edge of the book (t = 0) to the spine
  // (t = 0.5) and beyond; the cast-shadow band tracks it.
  const edgeX = 100 * Math.cos(Math.PI * t);

  return { angle, lift, faceOpacity, frontShade, backShade, castShadow, edgeX };
}
