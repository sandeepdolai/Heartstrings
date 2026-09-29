/**
 * PaperString render engine — composites canvas pages (layers, strokes, text,
 * stickers, images, clipping, masks) onto 2D contexts.
 *
 * Everything draws in CANVAS UNITS (1080×1920). The caller sets the context
 * transform so the same code renders viewport-sized editor previews and
 * 4K publish masters identically.
 */

import {
  CANVAS_W,
  CANVAS_H,
  PUBLISH_SCALE,
  type CanvasPageData,
  type Layer,
  type RasterLayer,
  type Stroke,
  type TextLayer,
  type ImageLayer,
  type StickerLayer,
} from "./types";
import { stickerSrc } from "./stickers";
import { ensureCreativeFonts } from "./fonts";

/* ── image cache ────────────────────────────────────────────────────────── */

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image failed to load"));
      img.src = src;
    });
    imageCache.set(src, p);
    p.catch(() => imageCache.delete(src));
  }
  return p;
}

/** Sticker intrinsic size fallback (width/height are injected in the SVG). */
const stickerSizeCache = new Map<string, { w: number; h: number }>();

export async function getStickerImage(
  stickerId: string
): Promise<{ img: HTMLImageElement; w: number; h: number }> {
  const src = stickerSrc(stickerId);
  const img = await loadImage(src);
  let size = stickerSizeCache.get(stickerId);
  if (!size) {
    size = { w: img.naturalWidth || 100, h: img.naturalHeight || 100 };
    stickerSizeCache.set(stickerId, size);
  }
  return { img, w: size.w, h: size.h };
}

/** Loads every font a page's text layers use (canvas can only draw loaded fonts). */
async function loadPageFonts(page: CanvasPageData): Promise<void> {
  ensureCreativeFonts();
  const families = new Set<string>();
  for (const l of page.layers) if (l.type === "text") families.add(l.fontFamily);
  await Promise.all(
    [...families].map((f) => document.fonts.load(`400 72px ${f}`).catch(() => {}))
  );
}

/* ── raster bitmaps: stroke replay with identity-keyed cache ───────────── */

const bitmapCache = new Map<
  string,
  { strokes: Stroke[]; flattened: string | undefined; canvas: HTMLCanvasElement }
>();

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Smooth polyline path (quadratic midpoints) — the ibisPaint-style pen feel.
 */
function traceStrokePath(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  if (pts.length === 0) return;
  ctx.beginPath();
  if (pts.length === 1) {
    // A tap = a dot
    ctx.arc(pts[0][0], pts[0][1], 0.001, 0, Math.PI * 2);
    return;
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

/**
 * Paint one stroke onto a context. Per-stroke opacity is honoured by drawing
 * the stroke at full alpha on a temp canvas, then compositing once — so
 * overlapping segments inside a stroke stay uniform (classic brush behavior).
 * Eraser composites with destination-out.
 */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  scratch: HTMLCanvasElement
) {
  const isEraser = stroke.tool === "eraser";
  const useTemp = stroke.opacity < 1 || isEraser;
  let layer: CanvasRenderingContext2D = ctx;
  if (useTemp) {
    if (scratch.width !== CANVAS_W || scratch.height !== CANVAS_H) {
      scratch.width = CANVAS_W;
      scratch.height = CANVAS_H;
    }
    layer = scratch.getContext("2d")!;
    layer.setTransform(1, 0, 0, 1, 0, 0);
    layer.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }

  layer.save();
  layer.lineCap = "round";
  layer.lineJoin = "round";
  layer.lineWidth = stroke.size;
  layer.strokeStyle = isEraser ? "#000" : stroke.color;
  layer.fillStyle = layer.strokeStyle;
  traceStrokePath(layer, stroke.points);
  if (stroke.points.length === 1) {
    // single-point dot
    layer.beginPath();
    layer.arc(
      stroke.points[0][0],
      stroke.points[0][1],
      Math.max(0.5, stroke.size / 2),
      0,
      Math.PI * 2
    );
    layer.fill();
  } else {
    layer.stroke();
  }
  layer.restore();

  if (useTemp) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = stroke.opacity;
    ctx.globalCompositeOperation = isEraser
      ? "destination-out"
      : "source-over";
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  }
}

/**
 * The raster layer bitmap: optional flattened base (from merges) + stroke
 * replay. Cached by strokes-array identity — immutable updates make this O(1)
 * to validate.
 */
export function getRasterBitmap(layer: RasterLayer): HTMLCanvasElement {
  const cached = bitmapCache.get(layer.id);
  if (
    cached &&
    cached.strokes === layer.strokes &&
    cached.flattened === layer.flattened
  ) {
    return cached.canvas;
  }
  const canvas = makeCanvas(CANVAS_W, CANVAS_H);
  const ctx = canvas.getContext("2d")!;
  const scratch = makeCanvas(CANVAS_W, CANVAS_H);
  if (layer.flattened) {
    const img = syncImages.get(layer.flattened);
    if (img) ctx.drawImage(img, 0, 0);
    else
      loadImage(layer.flattened).then((im) => {
        syncImages.set(layer.flattened!, im);
        bitmapCache.delete(layer.id);
        for (const cb of flushListeners) cb();
      });
  }
  for (const s of layer.strokes) paintStroke(ctx, s, scratch);
  bitmapCache.set(layer.id, {
    strokes: layer.strokes,
    flattened: layer.flattened,
    canvas,
  });
  return canvas;
}

const syncImages = new Map<string, HTMLImageElement>();

let flushListeners: Array<() => void> = [];
/** Subscribe to async content loads (fonts/images) that require re-render. */
export function onEngineContentLoaded(cb: () => void): () => void {
  flushListeners.push(cb);
  return () => {
    flushListeners = flushListeners.filter((f) => f !== cb);
  };
}
function rasterFlush(_layer: RasterLayer) {
  bitmapCache.delete(_layer.id);
  for (const cb of flushListeners) cb();
}
void rasterFlush;

/* ── background (solid or CSS-style linear-gradient string) ─────────────── */

export function paintBackground(
  ctx: CanvasRenderingContext2D,
  background: string
) {
  // NOTE: never reset the transform here — the same code path serves editor
  // previews (device-px scale) and 4K publish renders (2× canvas units).
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CANVAS_W, CANVAS_H);
  ctx.clip();
  ctx.fillStyle = background.startsWith("linear-gradient")
    ? makeGradient(ctx, background)
    : background;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.restore();
}

function makeGradient(ctx: CanvasRenderingContext2D, css: string): string | CanvasGradient {
  const m = css.match(
    /linear-gradient\(\s*([\d.]+)deg\s*,(.*)\)/
  );
  if (!m) return "#FFFFFF";
  const angle = parseFloat(m[1]);
  const stopStr = m[2];
  const stops: { pos: number; color: string }[] = [];
  const re = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s+([\d.]+)%/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stopStr))) {
    stops.push({ color: match[1], pos: parseFloat(match[2]) / 100 });
  }
  if (stops.length < 2) return stops[0]?.color ?? "#FFFFFF";

  // CSS angle: 0deg = to top, 90deg = to right (clockwise).
  const rad = ((angle - 90) * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const L =
    (CANVAS_W * Math.abs(dx) + CANVAS_H * Math.abs(dy)) / 2;
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const grad = ctx.createLinearGradient(
    cx - dx * L,
    cy - dy * L,
    cx + dx * L,
    cy + dy * L
  );
  for (const s of stops) grad.addColorStop(s.pos, s.color);
  return grad;
}

/* ── layer geometry helpers ─────────────────────────────────────────────── */

export function layerRotationRad(layer: Layer): number {
  return (layer.rotation * Math.PI) / 180;
}

/** Transform a canvas point into the layer's local (untransformed) space. */
export function toLocal(layer: Layer, px: number, py: number): [number, number] {
  const rad = layerRotationRad(layer);
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  const dx = px - layer.x;
  const dy = py - layer.y;
  return [dx * cos - dy * sin, dx * sin + dy * cos];
}

/** Natural (untransformed) content box of a layer, centered on layer.x/y. */
export function layerContentBox(layer: Layer): { w: number; h: number } {
  switch (layer.type) {
    case "raster":
      return { w: CANVAS_W * layer.scale, h: CANVAS_H * layer.scale };
    case "image": {
      const l = layer as ImageLayer;
      const fit = Math.min(CANVAS_W / l.naturalWidth, CANVAS_H / l.naturalHeight);
      const s = fit * layer.scale;
      return { w: l.naturalWidth * s, h: l.naturalHeight * s };
    }
    case "sticker": {
      const l = layer as StickerLayer;
      const size = stickerSizeCache.get(l.stickerId) ?? { w: 100, h: 100 };
      const s = (CANVAS_W * 0.35 * layer.scale) / 100;
      return { w: size.w * s, h: size.h * s };
    }
    case "text": {
      const m = measureTextLayer(layer as TextLayer);
      return m;
    }
  }
}

/** Axis-aligned bounding box of a layer (rotation-aware, with slack). */
export function layerAABB(
  layer: Layer,
  slack = 0
): { x0: number; y0: number; x1: number; y1: number } {
  const { w, h } = layerContentBox(layer);
  const rad = layerRotationRad(layer);
  const cx = layer.x;
  const cy = layer.y;
  const hw = w / 2 + slack;
  const hh = h / 2 + slack;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const ex = hw * cos + hh * sin;
  const ey = hw * sin + hh * cos;
  return { x0: cx - ex, y0: cy - ey, x1: cx + ex, y1: cy + ey };
}

export function pointInLayer(
  layer: Layer,
  px: number,
  py: number,
  slack = 12
): boolean {
  if (!layer.visible) return false;
  const [lx, ly] = toLocal(layer, px, py);
  const { w, h } = layerContentBox(layer);
  const hw = w / 2 + slack;
  const hh = h / 2 + slack;
  const inside = lx >= -hw && lx <= hw && ly >= -hh && ly <= hh;
  if (!inside) return false;
  if (layer.type === "raster") {
    // Only grab where paint actually exists (fallback to bbox for thin art).
    const bmp = getRasterBitmap(layer);
    const bx = Math.round((lx / layer.scale + CANVAS_W / 2) * 1);
    const by = Math.round((ly / layer.scale + CANVAS_H / 2) * 1);
    if (bx < 0 || by < 0 || bx >= CANVAS_W || by >= CANVAS_H) return false;
    const alpha = bmp
      .getContext("2d")!
      .getImageData(bx, by, 1, 1).data[3];
    if (alpha === 0) {
      // allow a generous ring around painted pixels for easy grabbing
      return false;
    }
  }
  return true;
}

/* ── text ───────────────────────────────────────────────────────────────── */

export function textFontString(l: TextLayer): string {
  const weight = l.bold ? "700" : "400";
  const style = l.italic ? "italic " : "";
  return `${style}${weight} ${l.fontSize}px ${l.fontFamily}, sans-serif`;
}

export function measureTextLayer(l: TextLayer): { w: number; h: number } {
  const lines = l.text.split("\n");
  const canvas = measureCanvas ?? (measureCanvas = makeCanvas(8, 8));
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.font = textFontString(l);
  applyLetterSpacing(ctx, l.letterSpacing);
  let w = 0;
  for (const line of lines) {
    const m = ctx.measureText(line || " ").width;
    if (m > w) w = m;
  }
  ctx.restore();
  return { w, h: lines.length * l.fontSize * l.lineHeight };
}
let measureCanvas: HTMLCanvasElement | null = null;

function applyLetterSpacing(ctx: CanvasRenderingContext2D, spacing: number) {
  if (spacing !== 0 && "letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${spacing}px`;
  }
}

function drawTextLayer(ctx: CanvasRenderingContext2D, l: TextLayer) {
  const lines = l.text.split("\n");
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(layerRotationRad(l));
  ctx.font = textFontString(l);
  applyLetterSpacing(ctx, l.letterSpacing);
  ctx.textBaseline = "middle";
  ctx.fillStyle = l.color;
  const lh = l.fontSize * l.lineHeight;
  const totalH = lines.length * lh;
  // Block anchor: align inside the widest line's box so left/right/center all
  // pivot around the layer center (FR-4.5).
  const widths = lines.map((line) => ctx.measureText(line || " ").width);
  const blockW = Math.max(...widths, 1);
  const anchorX =
    l.align === "left" ? -blockW / 2 : l.align === "right" ? blockW / 2 : 0;
  ctx.textAlign = l.align;
  lines.forEach((line, i) => {
    const y = -totalH / 2 + lh * (i + 0.5);
    if (l.underline && line.trim()) {
      const w = widths[i];
      const ux =
        l.align === "left" ? anchorX : l.align === "right" ? anchorX - w : -w / 2;
      const uy = y + l.fontSize * 0.42;
      ctx.save();
      ctx.lineWidth = Math.max(1, l.fontSize * 0.045);
      ctx.strokeStyle = l.color;
      ctx.beginPath();
      ctx.moveTo(ux, uy);
      ctx.lineTo(ux + w, uy);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillText(line, anchorX, y);
  });
  ctx.restore();
}

/* ── single layer draw (transform + opacity) ────────────────────────────── */

function drawLayerContent(ctx: CanvasRenderingContext2D, layer: Layer) {
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate(layerRotationRad(layer));
  switch (layer.type) {
    case "raster": {
      const bmp = getRasterBitmap(layer);
      ctx.scale(layer.scale, layer.scale);
      ctx.drawImage(bmp, -CANVAS_W / 2, -CANVAS_H / 2);
      break;
    }
    case "image": {
      const l = layer as ImageLayer;
      const img = syncImages.get(l.src);
      if (img) {
        const fit = Math.min(
          CANVAS_W / l.naturalWidth,
          CANVAS_H / l.naturalHeight
        );
        const s = fit * layer.scale;
        ctx.scale(s, s);
        ctx.drawImage(img, -l.naturalWidth / 2, -l.naturalHeight / 2);
      } else {
        loadImage(l.src)
          .then((im) => {
            syncImages.set(l.src, im);
            for (const cb of flushListeners) cb();
          })
          .catch(() => {});
      }
      break;
    }
    case "sticker": {
      const l = layer as StickerLayer;
      const src = stickerSrc(l.stickerId);
      const img = syncImages.get(src);
      if (img) {
        const { w: nw, h: nh } =
          stickerSizeCache.get(l.stickerId) ?? { w: 100, h: 100 };
        const s = (CANVAS_W * 0.35 * layer.scale) / 100;
        ctx.scale(s, s);
        ctx.drawImage(img, -nw / 2, -nh / 2);
      } else {
        getStickerImage(l.stickerId)
          .then(({ img: im, w, h }) => {
            syncImages.set(src, im);
            stickerSizeCache.set(l.stickerId, { w, h });
            for (const cb of flushListeners) cb();
          })
          .catch(() => {});
      }
      break;
    }
    case "text":
      drawTextLayer(ctx, layer as TextLayer);
      break;
  }
  ctx.restore();
}

/* ── page composite (clipping + masks) ──────────────────────────────────── */

export interface RenderExtras {
  /** Live in-progress stroke preview (drawn on the active raster layer). */
  liveStroke?: { layerId: string; stroke: Stroke } | null;
  /** Layer hidden while its DOM text editor is open. */
  hideLayerId?: string;
}

/** Canvas composite op for a layer (undefined/"normal" → source-over). */
function blendOp(layer: Layer): GlobalCompositeOperation {
  return (layer.blendMode && layer.blendMode !== "normal"
    ? layer.blendMode
    : "source-over") as GlobalCompositeOperation;
}

/**
 * Composite a full page. `ctx` must already carry the scale transform
 * (canvas-units → device px). Clipped layers render only over the alpha of
 * the layer below (ibisPaint-style); clipShape masks render keep-inside.
 */
export function renderPage(
  ctx: CanvasRenderingContext2D,
  page: CanvasPageData,
  extras: RenderExtras = {}
) {
  paintBackground(ctx, page.background);
  const scratch = getScratch();
  const mask = getMask();
  const sctx = getScratchCtx();
  const mctx = getMaskCtx();

  for (let i = 0; i < page.layers.length; i++) {
    const layer = page.layers[i];
    if (!layer.visible || layer.opacity === 0) continue;
    if (layer.id === extras.hideLayerId) continue;

    const isLive = extras.liveStroke?.layerId === layer.id;
    const clippedToBase =
      layer.clipped && i > 0 && page.layers[i - 1].visible;

    if (layer.clipShape || clippedToBase || isLive) {
      // Offscreen composite: content → clipShape mask → base-alpha mask → out.
      mctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      mctx.save();
      mctx.globalAlpha = layer.opacity;
      drawLayerContent(mctx, layer);
      if (isLive) {
        mctx.save();
        mctx.globalAlpha = extras.liveStroke!.stroke.opacity;
        if (extras.liveStroke!.stroke.tool === "eraser")
          mctx.globalCompositeOperation = "destination-out";
        paintLiveStroke(mctx, extras.liveStroke!.stroke);
        mctx.restore();
      }
      mctx.restore();

      if (layer.clipShape) {
        mctx.save();
        mctx.globalCompositeOperation = "destination-in";
        mctx.fillStyle = "#fff";
        applyClipShapePath(mctx, layer.clipShape);
        mctx.fill();
        mctx.restore();
      }
      if (clippedToBase) {
        const base = page.layers[i - 1];
        sctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        drawLayerContent(sctx, base);
        mctx.save();
        mctx.globalCompositeOperation = "destination-in";
        sctx.globalAlpha = 1;
        mctx.drawImage(scratch, 0, 0);
        mctx.restore();
      }
      ctx.save();
      // Blend applies when the masked composite lands on the page —
      // the masks above are internal to this layer.
      ctx.globalCompositeOperation = blendOp(layer);
      ctx.drawImage(mask, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = blendOp(layer);
      drawLayerContent(ctx, layer);
      ctx.restore();
    }
  }
}

function paintLiveStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.size;
  ctx.strokeStyle = stroke.tool === "eraser" ? "#000" : stroke.color;
  ctx.fillStyle = ctx.strokeStyle;
  traceStrokePath(ctx, stroke.points);
  if (stroke.points.length === 1) {
    ctx.beginPath();
    ctx.arc(
      stroke.points[0][0],
      stroke.points[0][1],
      Math.max(0.5, stroke.size / 2),
      0,
      Math.PI * 2
    );
    ctx.fill();
  } else {
    ctx.stroke();
  }
  ctx.restore();
}

function applyClipShapePath(
  ctx: CanvasRenderingContext2D,
  shape: { type: "rect" | "ellipse"; x: number; y: number; w: number; h: number }
) {
  ctx.beginPath();
  if (shape.type === "rect") {
    ctx.rect(shape.x, shape.y, shape.w, shape.h);
  } else {
    ctx.ellipse(
      shape.x + shape.w / 2,
      shape.y + shape.h / 2,
      Math.abs(shape.w / 2),
      Math.abs(shape.h / 2),
      0,
      0,
      Math.PI * 2
    );
  }
}

let _scratch: HTMLCanvasElement | null = null;
let _mask: HTMLCanvasElement | null = null;
function getScratch() {
  if (!_scratch) _scratch = makeCanvas(CANVAS_W, CANVAS_H);
  return _scratch;
}
function getMask() {
  if (!_mask) _mask = makeCanvas(CANVAS_W, CANVAS_H);
  return _mask;
}
// Lazy contexts — render.ts must stay importable from server components
// (document only exists in the browser).
let _sctx: CanvasRenderingContext2D | null = null;
let _mctx: CanvasRenderingContext2D | null = null;
function getScratchCtx() {
  if (!_sctx) _sctx = getScratch().getContext("2d")!;
  return _sctx;
}
function getMaskCtx() {
  if (!_mctx) _mctx = getMask().getContext("2d")!;
  return _mctx;
}

/* ── full-page renders (publish, covers, layer thumbs) ──────────────────── */

/** Render one page to a canvas of (CANVAS × scale) device pixels. */
export async function renderPageToCanvas(
  page: CanvasPageData,
  scale = 1,
  opts: { fonts?: boolean } = {}
): Promise<HTMLCanvasElement> {
  if (opts.fonts !== false) await loadPageFonts(page);
  // Ensure every referenced raster/image/sticker asset is loaded.
  await Promise.all(
    page.layers.flatMap((l) => {
      if (l.type === "image") return [loadImage(l.src).then((im) => syncImages.set(l.src, im))];
      if (l.type === "sticker")
        return [
          getStickerImage((l as StickerLayer).stickerId).then(
            ({ img, w, h }) => {
              syncImages.set(stickerSrc((l as StickerLayer).stickerId), img);
              stickerSizeCache.set((l as StickerLayer).stickerId, { w, h });
            }
          ),
        ];
      return [];
    })
  );
  const out = makeCanvas(CANVAS_W * scale, CANVAS_H * scale);
  const ctx = out.getContext("2d")!;
  ctx.scale(scale, scale);
  renderPage(ctx, page);
  return out;
}

/** 4K publish render (2160×3840 PNG data URL). */
export async function renderPageToPublishPng(page: CanvasPageData): Promise<string> {
  const canvas = await renderPageToCanvas(page, PUBLISH_SCALE);
  return canvas.toDataURL("image/png");
}

/** Small JPEG cover for dashboard cards. */
export async function renderPageToCoverJpg(
  page: CanvasPageData,
  width = 320
): Promise<string> {
  const canvas = await renderPageToCanvas(page, width / CANVAS_W, { fonts: true });
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Tiny layer thumbnail (rendered without neighbors, masks respected). */
export function renderLayerThumb(
  layer: Layer,
  canvas: HTMLCanvasElement,
  size = 40
) {
  const w = size;
  const h = size;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  const box = layerAABB(layer, 40);
  const bw = Math.max(1, box.x1 - box.x0);
  const bh = Math.max(1, box.y1 - box.y0);
  const s = Math.min(w / bw, h / bh) * 0.88;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(s, s);
  ctx.translate(-(box.x0 + box.x1) / 2, -(box.y0 + box.y1) / 2);
  ctx.globalAlpha = layer.visible ? layer.opacity : 0.25;
  drawLayerContent(ctx, layer);
  ctx.restore();
}
