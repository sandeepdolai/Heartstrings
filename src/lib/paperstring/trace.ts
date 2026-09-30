/**
 * Freehand trace geometry — pure helpers for the Cutout tool (and the
 * legacy keep-inside masks still present in old saved projects).
 *
 * Everything works in CANVAS UNITS (1080×1920), mirroring stroke points, so
 * traced paths persist scale-free and render identically in the editor
 * preview, the layer thumbnails and the 4K publish masters.
 */

import type { ClipShape } from "./types";

/** Ramer–Douglas–Peucker polyline simplification.
 *  Keeps the traced silhouette within `epsilon` canvas units while collapsing
 *  the hundred-plus near-duplicate samples a 120Hz pointer stream produces —
 *  a 3-second drag drops from ~350 points to a few dozen, so the stored
 *  cutout path stays lean and the crop edge stays exactly as hand-drawn. */
export function simplifyPolyline(
  points: [number, number][],
  epsilon = 2
): [number, number][] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDist = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(points[i], points[first], points[last]);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (maxDist > epsilon && idx !== -1) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  const out: [number, number][] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function perpendicularDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  // Cross-product distance to the infinite line through a→b.
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

/** Signed area of a closed polygon (shoelace). |area| in canvas units² —
 *  used to reject degenerate loops (a tap or a hairline scratch) that would
 *  otherwise crop a photo down to nothing. */
export function polygonArea(points: [number, number][]): number {
  let a = 0;
  for (let i = 0, n = points.length; i < n; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Is a traced/pending loop an actual cuttable region?
 *  Photoshop's rule of thumb: the loop must come back around — at least a
 *  triangle and a visible sliver of area (~a 22×22 unit square). */
export function isViableTrace(points: [number, number][]): boolean {
  return points.length >= 3 && polygonArea(points) > 500;
}

/** Axis-aligned bounds of a polygon (canvas units). */
export function polygonBBox(points: [number, number][]): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return { x0, y0, x1, y1 };
}

/** Any clip shape as a closed polygon in canvas units — path masks pass
 *  through, the retired rect/ellipse presets are converted (4 corners / a
 *  64-gon) so the cutout rasterizer and the load-time migration can treat
 *  every legacy mask the same way. Returns null for degenerate shapes. */
export function clipShapePolygon(shape: ClipShape): [number, number][] | null {
  if (shape.type === "path") {
    return shape.points.length >= 3 ? shape.points : null;
  }
  if (shape.type === "rect") {
    if (shape.w <= 0 || shape.h <= 0) return null;
    const { x, y, w, h } = shape;
    return [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ];
  }
  // ellipse → 64-gon (visually indistinguishable from the fill at any zoom)
  if (shape.w <= 0 || shape.h <= 0) return null;
  const cx = shape.x + shape.w / 2;
  const cy = shape.y + shape.h / 2;
  const rx = shape.w / 2;
  const ry = shape.h / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return pts;
}
