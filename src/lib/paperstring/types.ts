/**
 * PaperString — core data model (PRD §5)
 *
 * Project → Canvases (portrait pages, 9:16, 1080×1920 logical units) → Layers.
 * Layer order: index 0 = bottom. All positions/sizes are in CANVAS units so the
 * same data renders identically at editor preview scale and 4K publish scale.
 */

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;
export const ASPECT = CANVAS_W / CANVAS_H; // 9:16 portrait
export const PUBLISH_SCALE = 2; // 1080×1920 → 2160×3840 (4K masters, FR-Q.2)

export type LayerType = "raster" | "text" | "image" | "sticker";
export type ToolId =
  | "select"
  | "brush"
  | "eraser"
  | "blur"
  | "text"
  | "color"
  | "select-area"
  | "transform";

export interface Stroke {
  tool: "brush" | "eraser";
  color: string; // hex
  size: number; // brush diameter in canvas units
  opacity: number; // 0..1 — applied per stroke
  points: [number, number][]; // canvas-unit polyline
  /** Per-point stylus pressure (0..1), recorded only for pen pointers.
   *  Absent on mouse/touch/legacy strokes → constant width (old projects
   *  byte-clean; pressures ride the same z.any payload as points). */
  pressures?: number[];
}

/** Legacy keep-inside mask (retired with the round-24 Cutout tool).
 *
 *  No layer can gain a clipShape anymore — the Cutout tool performs a REAL
 *  pixel crop instead (the layer's bitmap becomes the traced region, so its
 *  bounding box always equals the visible edges and can never detach while
 *  moving). This union survives only so old saved projects keep rendering
 *  pixel-identically; the editor migrates image-layer masks to true cutouts
 *  on load, and raster/text/sticker masks still render through it.
 *  • "path" — the freehand loop (round-23 lasso era).
 *  • "rect" | "ellipse" — the round-22-and-earlier shape presets.
 */
export type ClipShape =
  | { type: "rect" | "ellipse"; x: number; y: number; w: number; h: number }
  | { type: "path"; points: [number, number][] };

/** Layer blend modes (canvas globalCompositeOperation values, CSS-compat).
 *  undefined / "normal" = source-over. Applied per layer at composite time
 *  so editor previews and 4K published pages stay pixel-identical. */
export const BLEND_MODES = [
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export interface BaseLayer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number; // 0..1
  blendMode?: BlendMode; // canvas composite op (undefined = normal)
  clipped: boolean; // render only over the alpha of the layer below
  clipShape?: ClipShape;
  x: number; // center X (raster: offset from canvas center)
  y: number; // center Y
  rotation: number; // degrees, clockwise
  scale: number; // uniform (raster transform + image/sticker sizing)
}

export interface RasterLayer extends BaseLayer {
  type: "raster";
  strokes: Stroke[];
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number; // canvas units
  color: string;
  align: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
  letterSpacing: number; // canvas units
  lineHeight: number; // multiplier
  underline: boolean;
  /** Arc bend, −100…100: positive arches the text up like a badge (∩),
   *  negative dips it into a smile (∪). 0 / undefined = straight — old
   *  projects and undo history stay byte-clean. Curves apply per line. */
  curve?: number;
}

/** Per-image color adjustments (non-destructive — a filter applied at draw
 *  time, so editor previews and 4K publishes stay pixel-identical).
 *  Neutral = omitted field entirely (old projects stay byte-clean). */
export interface ImageAdjust {
  brightness: number; // 0.5–1.5 (1 = original)
  contrast: number; // 0.5–1.5
  saturate: number; // 0–2 (0 = mono)
}

export const IMAGE_ADJUST_NEUTRAL: ImageAdjust = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
};

export interface ImageLayer extends BaseLayer {
  type: "image";
  src: string; // data URL (persisted with project)
  naturalWidth: number;
  naturalHeight: number;
  adjust?: ImageAdjust;
}

export interface StickerLayer extends BaseLayer {
  type: "sticker";
  stickerId: string; // key into STICKERS library
}

export type Layer = RasterLayer | TextLayer | ImageLayer | StickerLayer;

export interface CanvasPageData {
  id: string;
  background: string; // hex page background
  layers: Layer[]; // bottom → top
}

/** A creator-imported font (FR-4.4) — embedded as a data URL so text keeps
 * rendering for the owner on any device. Viewer pages are baked to PNG, so
 * recipients never need the font installed (FR-4.7). */
export interface CustomFont {
  id: string;
  label: string;
  /** Unique FontFace family registered at runtime (e.g. "PsCustom-f_abc"). */
  family: string;
  /** data: URL of the .ttf/.otf/.woff/.woff2 file. */
  src: string;
}

export interface ProjectData {
  version: 1;
  canvases: CanvasPageData[];
  fonts?: CustomFont[];
}

export interface ProjectSummary {
  id: string;
  title: string;
  coverImage: string | null;
  pageCount: number;
  shareToken: string | null;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface PsUser {
  id: string;
  email: string;
  name: string;
  /** Profile picture URL (Google avatar) — null for email-only accounts. */
  image?: string | null;
  createdAt: string;
}

export interface PublishedProject {
  title: string;
  pages: string[]; // rendered PNG data URLs (no layer data — SEP-3)
}

export function uid(prefix = "l"): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export function newCanvasPage(): CanvasPageData {
  return {
    id: uid("cv"),
    background: "#FFFFFF",
    layers: [
      {
        id: uid("l"),
        name: "Paint layer",
        type: "raster",
        visible: true,
        opacity: 1,
        clipped: false,
        x: CANVAS_W / 2,
        y: CANVAS_H / 2,
        rotation: 0,
        scale: 1,
        strokes: [],
      },
    ],
  };
}

export function newProjectData(): ProjectData {
  return { version: 1, canvases: [newCanvasPage()] };
}
