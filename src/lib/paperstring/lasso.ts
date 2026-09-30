/**
 * Freehand lasso geometry — pure helpers for the keep-inside selection tool.
 *
 * Everything works in CANVAS UNITS (1080×1920), mirroring stroke points, so
 * traced paths persist scale-free and render identically in the editor
 * preview, the layer thumbnails and the 4K publish masters.
 */

import type { ClipShape } from "./types";

/** Ramer–Douglas–Peucker polyline simplification.
 *  Keeps the traced silhouette within `epsilon` canvas units while collapsing
 *  the hundred-plus near-duplicate samples a 120Hz pointer stream produces —
 *  a 3-second drag drops from ~350 points to a few dozen, so saved project
 *  JSON stays lean and the mask path stays exactly as hand-drawn. */
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
 *  otherwise mask a layer to nothing. */
export function polygonArea(points: [number, number][]): number {
  let a = 0;
  for (let i = 0, n = points.length; i < n; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Is a traced/pending lasso an actual selectable region?
 *  Photoshop's rule of thumb: the loop must come back around — at least a
 *  triangle and a visible sliver of area (~a 22×22 unit square). */
export function isViableLasso(points: [number, number][]): boolean {
  return points.length >= 3 && polygonArea(points) > 500;
}

/** Bounding box of any clip shape (canvas units) — panel status lines and
 *  legacy rect/ellipse shapes share one helper. */
export function clipShapeBounds(shape: ClipShape): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (shape.type === "path") {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of shape.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
}
