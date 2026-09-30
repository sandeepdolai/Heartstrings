/**
 * Freeform Cutout — crop a photo's pixels to a hand-traced shape.
 *
 * The retired "keep inside" mask hid pixels while keeping the original
 * (larger) bounding box, and because the mask was anchored to the PAGE, the
 * visible photo could detach from its box when the layer moved. A cutout
 * fixes both at the source: the traced region is rasterized out of the
 * source image at full resolution, transparent everywhere else, and becomes
 * the layer's actual bitmap — so the bounding box always equals the visible
 * cut edges, and moving/resizing the layer moves/resizes exactly what you
 * see. No mask, no detachment, nothing left behind to vanish.
 *
 * The math mirrors the render engine exactly (drawLayerContent):
 *   page px → layer-local units (undo rotation + translation, `toLocal`)
 *   → source pixels (÷ k, where k = fit · layer.scale canvas units per px).
 */

import {
  CANVAS_W,
  CANVAS_H,
  type CanvasPageData,
  type ClipShape,
  type ImageLayer,
  type Layer,
} from "./types";
import {
  imageFilterCss,
  layerAABB,
  layerRotationRad,
  loadImage,
  registerSyncImage,
  toLocal,
} from "./render";
import { clipShapePolygon, polygonBBox } from "./trace";

/** Long-side cap for a cutout raster. Publish masters render at 2160×3840,
 *  so 2400px keeps every cutout crisp at 4K while bounding the data-URL
 *  size that gets saved into the project JSON. */
const MAX_CUTOUT_PX = 2400;

export interface ImageCutoutPatch {
  /** Cropped PNG data URL — pixels outside the trace are transparent. */
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  /** New layer center (canvas units) — the cut region's center, not the
   *  original image's. */
  x: number;
  y: number;
  /** Uniform layer scale that draws the crop at exactly its original
   *  on-page size (the cut is purely destructive to pixels, never to
   *  geometry). */
  scale: number;
}

/** The photo a traced loop will cut. Preference order: the ACTIVE layer if
 *  it is a visible image the loop touches (the user picked it on purpose),
 *  otherwise the topmost visible image under the loop. Stickers, paint and
 *  text are never targeted — the cutout crops photos. */
export function findCutoutTarget(
  page: CanvasPageData,
  trace: [number, number][],
  activeLayerId?: string
): ImageLayer | null {
  const bb = polygonBBox(trace);
  const overlaps = (l: Layer) => {
    const a = layerAABB(l, 0);
    return bb.x0 <= a.x1 && bb.x1 >= a.x0 && bb.y0 <= a.y1 && bb.y1 >= a.y0;
  };
  const active = page.layers.find((l) => l.id === activeLayerId);
  if (active?.type === "image" && active.visible && overlaps(active)) {
    return active;
  }
  for (let i = page.layers.length - 1; i >= 0; i--) {
    const l = page.layers[i];
    if (l.type !== "image" || !l.visible) continue;
    if (overlaps(l)) return l;
  }
  return null;
}

/**
 * Rasterize the traced shape out of an image layer at source resolution.
 *
 * The crop keeps page-space geometry identical (the photo stays exactly
 * where it was); only the pixels outside the trace become transparent and
 * the layer's frame shrinks to the traced region's tight bounds. A legacy
 * clipShape (old "keep inside" masks) is intersected so pre-cutout projects
 * keep their pixels while losing the page-anchored mask.
 *
 * Returns null when the trace misses the photo entirely (or is degenerate).
 */
export async function rasterizeImageCutout(
  layer: ImageLayer,
  trace: [number, number][],
  legacyMask?: ClipShape
): Promise<ImageCutoutPatch | null> {
  if (!layer.visible || layer.scale <= 0) return null;
  const img = await loadImage(layer.src);
  // The layer's stored frame is the source of truth (the render path sizes
  // the image by naturalWidth/naturalHeight), so crop in that pixel grid.
  const natW = layer.naturalWidth || img.naturalWidth;
  const natH = layer.naturalHeight || img.naturalHeight;
  if (!natW || !natH) return null;
  const fit = Math.min(CANVAS_W / natW, CANVAS_H / natH);
  const k = fit * layer.scale; // canvas units per source pixel
  if (!(k > 0)) return null;

  // Page coords → source pixels (same transform as the render engine).
  const toPx = (p: [number, number]): [number, number] => {
    const [lx, ly] = toLocal(layer, p[0], p[1]);
    return [lx / k + natW / 2, ly / k + natH / 2];
  };
  const tracePx = trace.map(toPx);

  // Visible region = trace ∩ legacy mask (if any) — both become the crop.
  const masks: [number, number][][] = [tracePx];
  if (legacyMask) {
    const poly = clipShapePolygon(legacyMask);
    if (poly) masks.push(poly.map(toPx));
  }

  // Tight pixel bounds of the traced region, clamped to the photo.
  const bb = polygonBBox(tracePx);
  const qx0 = Math.max(0, Math.floor(bb.x0));
  const qy0 = Math.max(0, Math.floor(bb.y0));
  const qx1 = Math.min(natW, Math.ceil(bb.x1));
  const qy1 = Math.min(natH, Math.ceil(bb.y1));
  const w = qx1 - qx0;
  const h = qy1 - qy0;
  if (w < 2 || h < 2) return null;

  // Resolution cap: never upscale, downscale only past the 4K budget.
  const cap = Math.min(1, MAX_CUTOUT_PX / Math.max(w, h));
  const cw = Math.max(2, Math.round(w * cap));
  const ch = Math.max(2, Math.round(h * cap));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(cw / w, ch / h);

  // 1) the photo, framed exactly as the render engine frames it
  const filter = imageFilterCss(layer.adjust);
  if (filter) ctx.filter = filter; // bake the adjustments — reset below
  ctx.drawImage(img, -qx0, -qy0, natW, natH);
  ctx.filter = "none";

  // 2) keep only the traced shape (even-odd, so self-crossing loops exclude
  //    the overlap exactly like the old mask fill). A second mask fill (a
  //    legacy clipShape) intersects, because destination-in keeps only the
  //    destination ∩ source.
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = "#fff";
  for (const poly of masks) {
    if (poly.length < 3) continue;
    ctx.beginPath();
    ctx.moveTo(poly[0][0] - qx0, poly[0][1] - qy0);
    for (let i = 1; i < poly.length; i++)
      ctx.lineTo(poly[i][0] - qx0, poly[i][1] - qy0);
    ctx.closePath();
    ctx.fill("evenodd");
  }

  const src = canvas.toDataURL("image/png");

  // Prime the decode cache so the committed layer renders without a flash.
  await new Promise<void>((resolve) => {
    const pre = new Image();
    pre.onload = () => {
      registerSyncImage(src, pre);
      resolve();
    };
    pre.onerror = () => resolve(); // a cache miss only costs one frame
    pre.src = src;
  });

  // 3) new layer geometry — center on the cut region, drawn size unchanged.
  const lcx = ((qx0 + qx1) / 2 - natW / 2) * k;
  const lcy = ((qy0 + qy1) / 2 - natH / 2) * k;
  const rad = layerRotationRad(layer);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const fit2 = Math.min(CANVAS_W / cw, CANVAS_H / ch);
  return {
    src,
    naturalWidth: cw,
    naturalHeight: ch,
    x: layer.x + lcx * cos - lcy * sin,
    y: layer.y + lcx * sin + lcy * cos,
    scale: (w * k) / (cw * fit2),
  };
}

/**
 * Load-time migration: every image layer still carrying a legacy keep-inside
 * mask is converted into a true cutout — identical visible pixels, but the
 * mask (and its page-anchored, box-detaching behaviour) is gone forever.
 * Failures keep the legacy mask (the render path still supports it).
 *
 * Returns how many layers were migrated.
 */
export async function migrateLegacyImageMasks(
  canvases: CanvasPageData[],
  apply: (canvasId: string, layerId: string, patch: Partial<ImageLayer>) => void
): Promise<number> {
  let count = 0;
  for (const page of canvases) {
    for (const layer of page.layers) {
      if (layer.type !== "image" || !layer.clipShape) continue;
      const poly = clipShapePolygon(layer.clipShape);
      if (!poly) continue;
      try {
        const patch = await rasterizeImageCutout(layer, poly);
        if (!patch) continue;
        apply(page.id, layer.id, {
          ...patch,
          // the adjust filter is baked into the crop pixels above
          adjust: undefined,
          clipShape: undefined,
        });
        count++;
      } catch {
        // unreadable src / tainted canvas — the legacy mask keeps rendering
      }
    }
  }
  return count;
}
