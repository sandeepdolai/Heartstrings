"use client";

/**
 * PaperString editor store (Zustand).
 *
 * All mutations are immutable — history snapshots are plain references into
 * previous states, so undo/redo is zero-copy and uncapped (FR-10.1).
 * Operations only ever touch the ACTIVE canvas/layer (FR-2.5/2.6).
 */

import { create } from "zustand";
import {
  CANVAS_W,
  CANVAS_H,
  newCanvasPage,
  uid,
  type CanvasPageData,
  type ClipShape,
  type ImageLayer,
  type Layer,
  type ProjectData,
  type PsUser,
  type RasterLayer,
  type StickerLayer,
  type Stroke,
  type TextLayer,
  type ToolId,
} from "./types";

export type EditorTool =
  | "select"
  | "brush"
  | "eraser"
  | "blur"
  | "smudge"
  | "text"
  | "color"
  | "select-area"
  | "eyedropper"
  | "image"
  | "elements";

export interface TextDefaults {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  /** Arc bend for the next text (−100…100; 0 = straight). */
  curve: number;
}

export interface HistoryEntry {
  title: string;
  canvases: CanvasPageData[];
  activeCanvasId: string;
  activeLayerIds: Record<string, string | undefined>;
}

export interface EditorState {
  /* project */
  projectId: string | null;
  title: string;
  canvases: CanvasPageData[];
  user: PsUser | null;

  /* selection */
  activeCanvasId: string | null;
  /** per-canvas active layer — switching canvases never loses your place */
  activeLayerIds: Record<string, string | undefined>;

  /* tools */
  tool: EditorTool;
  prevTool: EditorTool;
  brush: { size: number; opacity: number; color: string };
  eraserSize: number;
  /** Soft-focus brush: nib diameter (canvas units) and blur strength per pass. */
  blur: { size: number; strength: number };
  /** Smudge brush: finger diameter (canvas units) and drag opacity 1–10. */
  smudge: { size: number; strength: number };
  colorHistory: string[];
  textDefaults: TextDefaults;
  selectionShape: "rect" | "ellipse";

  /* transient (not persisted, not historicized) */
  liveStroke: { layerId: string; stroke: Stroke } | null;
  pendingClip: { canvasId: string; shape: ClipShape } | null;
  editingTextLayerId: string | null;
  dirty: boolean;

  /* history */
  past: HistoryEntry[];
  future: HistoryEntry[];

  /* ── actions ── */
  load: (
    projectId: string,
    title: string,
    data: ProjectData,
    user: PsUser
  ) => void;
  reset: () => void;

  setTool: (tool: EditorTool) => void;
  setBrush: (patch: Partial<EditorState["brush"]>) => void;
  setEraserSize: (size: number) => void;
  setBlurTool: (patch: Partial<EditorState["blur"]>) => void;
  setSmudgeTool: (patch: Partial<{ size: number; strength: number }>) => void;
  pushColorHistory: (color: string) => void;
  setTextDefaults: (patch: Partial<TextDefaults>) => void;
  setSelectionShape: (shape: "rect" | "ellipse") => void;

  setTitle: (title: string) => void;
  markSaved: () => void;

  /* canvases */
  setActiveCanvas: (id: string) => void;
  addCanvas: () => void;
  deleteCanvas: (id: string) => void;
  duplicateCanvas: (id: string) => void;
  /** Move a page to a new position in the book (index in canvases order). */
  reorderCanvas: (id: string, toIndex: number) => void;
  setBackground: (canvasId: string, background: string) => void;

  /* layers */
  getActiveCanvas: () => CanvasPageData | null;
  getActiveLayer: () => Layer | null;
  setActiveLayer: (id: string | undefined) => void;
  addLayer: (layer: Layer, opts?: { history?: boolean }) => void;
  addRasterLayer: () => RasterLayer;
  addTextLayer: (x: number, y: number) => TextLayer;
  addImageLayer: (
    src: string,
    naturalWidth: number,
    naturalHeight: number,
    x?: number,
    y?: number
  ) => ImageLayer;
  addStickerLayer: (stickerId: string, x?: number, y?: number) => StickerLayer;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  moveLayer: (id: string, dir: "up" | "down") => void;
  reorderLayer: (id: string, toIndex: number) => void;
  updateLayer: (id: string, patch: Partial<Layer>, opts?: { history?: boolean }) => void;
  toggleLayerVisible: (id: string) => void;
  toggleLayerClipped: (id: string) => void;
  applyClipShape: (shape: ClipShape) => void;
  clearClipShape: (id: string) => void;
  mergeDown: (id: string, flattened: string) => void;

  /* strokes */
  beginStroke: (layerId: string, stroke: Stroke) => void;
  extendStroke: (point: [number, number]) => void;
  commitStroke: () => void;
  cancelStroke: () => void;

  /** Flatten a soft-focus OR smudge gesture into the raster layer's bitmap —
   *  one undo entry from the caller-supplied pre-gesture snapshot. */
  commitBlur: (
    canvasId: string,
    layerId: string,
    flattened: string,
    snapshot: HistoryEntry
  ) => void;

  /* text editing */
  setEditingText: (id: string | null) => void;

  /* history */
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Capture the current state as a history entry (pre-gesture). */
  captureHistory: () => HistoryEntry;
  /** Push a captured entry onto `past` (post-gesture) + clear future. */
  pushHistory: (entry: HistoryEntry) => void;

  /* internal */
  _commit: (mutate: (draft: {
    title: string;
    canvases: CanvasPageData[];
    activeCanvasId: string;
    activeLayerIds: Record<string, string | undefined>;
  }) => void) => void;
  _mutateNoHistory: (
    mutate: (draft: {
      canvases: CanvasPageData[];
    }) => void
  ) => void;
}

const MAX_HISTORY = 200; // engineering guard (NFR-3), never surfaced to users

function cloneEntry(s: EditorState): HistoryEntry {
  return {
    title: s.title,
    canvases: s.canvases,
    activeCanvasId: s.activeCanvasId ?? "",
    activeLayerIds: s.activeLayerIds,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: null,
  title: "",
  canvases: [],
  user: null,
  activeCanvasId: null,
  activeLayerIds: {},
  tool: "select",
  prevTool: "select",
  brush: { size: 18, opacity: 1, color: "#e8446a" },
  eraserSize: 40,
  blur: { size: 110, strength: 4 },
  smudge: { size: 90, strength: 5 },
  colorHistory: ["#e8446a", "#131313", "#f7c948", "#8ab8e0", "#7cc47f", "#ffffff"],
  textDefaults: {
    fontFamily: "Fraunces",
    fontSize: 96,
    color: "#131313",
    bold: false,
    italic: false,
    underline: false,
    align: "center" as TextDefaults["align"],
    letterSpacing: 0,
    lineHeight: 1.25,
    curve: 0,
  },
  selectionShape: "rect",
  liveStroke: null,
  pendingClip: null,
  editingTextLayerId: null,
  dirty: false,
  past: [],
  future: [],

  load: (projectId, title, data, user) =>
    set({
      projectId,
      title,
      canvases: data.canvases,
      user,
      activeCanvasId: data.canvases[0]?.id ?? null,
      activeLayerIds: Object.fromEntries(
        data.canvases.map((c) => [c.id, c.layers[c.layers.length - 1]?.id])
      ),
      past: [],
      future: [],
      dirty: false,
      liveStroke: null,
      pendingClip: null,
      editingTextLayerId: null,
      tool: "select",
    }),

  reset: () =>
    set({
      projectId: null,
      title: "",
      canvases: [],
      user: null,
      activeCanvasId: null,
      activeLayerIds: {},
      past: [],
      future: [],
      dirty: false,
      liveStroke: null,
      pendingClip: null,
      editingTextLayerId: null,
      tool: "select",
    }),

  setTool: (tool) =>
    set((s) => ({
      tool,
      prevTool: s.tool,
      pendingClip: null,
      editingTextLayerId:
        tool === "text" ? s.editingTextLayerId : null,
    })),

  setBrush: (patch) =>
    set((s) => ({ brush: { ...s.brush, ...patch } })),

  setEraserSize: (size) => set({ eraserSize: size }),

  setBlurTool: (patch) =>
    set((s) => ({ blur: { ...s.blur, ...patch } })),

  setSmudgeTool: (patch) =>
    set((s) => ({ smudge: { ...s.smudge, ...patch } })),

  pushColorHistory: (color) =>
    set((s) => ({
      colorHistory: [color, ...s.colorHistory.filter((c) => c !== color)].slice(0, 18),
    })),

  setTextDefaults: (patch) =>
    set((s) => ({ textDefaults: { ...s.textDefaults, ...patch } })),

  setSelectionShape: (shape) => set({ selectionShape: shape }),

  setTitle: (title) => {
    get()._commit((d) => {
      d.title = title;
    });
    set({ dirty: true });
  },

  markSaved: () => set({ dirty: false }),

  setActiveCanvas: (id) =>
    set((s) =>
      // no-op when already active — wrapper clicks on the active page must
      // not abort a just-finished keep-inside selection (FR-8)
      s.activeCanvasId === id
        ? {}
        : { activeCanvasId: id, pendingClip: null }
    ),

  addCanvas: () => {
    const page = newCanvasPage();
    get()._commit((d) => {
      d.canvases.push(page);
      d.activeCanvasId = page.id;
      d.activeLayerIds[page.id] = page.layers[0].id;
    });
    set({ dirty: true });
  },

  deleteCanvas: (id) => {
    const { canvases } = get();
    if (canvases.length <= 1) return; // a book always keeps at least one page
    get()._commit((d) => {
      const idx = d.canvases.findIndex((c) => c.id === id);
      if (idx === -1) return;
      d.canvases.splice(idx, 1);
      delete d.activeLayerIds[id];
      if (d.activeCanvasId === id) {
        const next = d.canvases[Math.min(idx, d.canvases.length - 1)];
        d.activeCanvasId = next.id;
      }
    });
    set({ dirty: true });
  },

  duplicateCanvas: (id) => {
    const { canvases } = get();
    const src = canvases.find((c) => c.id === id);
    if (!src) return;
    const copy: CanvasPageData = {
      id: uid("cv"),
      background: src.background,
      layers: src.layers.map((l) => ({
        ...l,
        id: uid("l"),
        strokes: l.type === "raster" ? [...l.strokes] : undefined,
      })) as Layer[],
    };
    get()._commit((d) => {
      const idx = d.canvases.findIndex((c) => c.id === id);
      d.canvases.splice(idx + 1, 0, copy);
      d.activeCanvasId = copy.id;
      d.activeLayerIds[copy.id] = copy.layers[copy.layers.length - 1]?.id;
    });
    set({ dirty: true });
  },

  reorderCanvas: (id, toIndex) => {
    const { canvases } = get();
    const from = canvases.findIndex((c) => c.id === id);
    if (from === -1) return;
    const to = Math.max(0, Math.min(toIndex, canvases.length - 1));
    if (from === to) return;
    get()._commit((d) => {
      const [page] = d.canvases.splice(from, 1);
      d.canvases.splice(to, 0, page);
      // The dragged page becomes active — its layers panel follows the move.
      d.activeCanvasId = page.id;
    });
    set({ dirty: true });
  },

  setBackground: (canvasId, background) => {
    get()._commit((d) => {
      const c = d.canvases.find((c) => c.id === canvasId);
      if (c) c.background = background;
    });
    set({ dirty: true });
  },

  getActiveCanvas: () => {
    const s = get();
    return s.canvases.find((c) => c.id === s.activeCanvasId) ?? null;
  },

  getActiveLayer: () => {
    const s = get();
    const c = s.getActiveCanvas();
    if (!c) return null;
    const id = s.activeLayerIds[c.id];
    return c.layers.find((l) => l.id === id) ?? null;
  },

  setActiveLayer: (id) =>
    set((s) => {
      if (!s.activeCanvasId) return {};
      return {
        activeLayerIds: { ...s.activeLayerIds, [s.activeCanvasId]: id },
      };
    }),

  addLayer: (layer, opts) => {
    get()._commit((d) => {
      const c = d.canvases.find((c) => c.id === d.activeCanvasId);
      if (!c) return;
      c.layers = [...c.layers, layer];
      d.activeLayerIds[c.id] = layer.id;
    });
    if (opts?.history === false) return;
    set({ dirty: true });
  },

  addRasterLayer: () => {
    const layer: RasterLayer = {
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
    };
    get().addLayer(layer);
    return layer;
  },

  addTextLayer: (x, y) => {
    const { textDefaults: t } = get();
    const layer: TextLayer = {
      id: uid("l"),
      name: "Text",
      type: "text",
      visible: true,
      opacity: 1,
      clipped: false,
      x,
      y,
      rotation: 0,
      scale: 1,
      text: "Say something lovely",
      fontFamily: t.fontFamily,
      fontSize: t.fontSize,
      color: t.color,
      align: t.align,
      bold: t.bold,
      italic: t.italic,
      letterSpacing: t.letterSpacing,
      lineHeight: t.lineHeight,
      underline: t.underline,
      // 0 stays undefined so old projects / saved JSON stay byte-clean.
      ...(t.curve ? { curve: t.curve } : {}),
    };
    get().addLayer(layer);
    set({ editingTextLayerId: layer.id, tool: "text" });
    return layer;
  },

  addImageLayer: (src, naturalWidth, naturalHeight, x, y) => {
    const fit = Math.min(
      CANVAS_W / naturalWidth,
      CANVAS_H / naturalHeight
    );
    const layer: ImageLayer = {
      id: uid("l"),
      name: "Photo",
      type: "image",
      visible: true,
      opacity: 1,
      clipped: false,
      x: x ?? CANVAS_W / 2,
      y: y ?? CANVAS_H / 2,
      rotation: 0,
      scale: fit * 0.85,
      src,
      naturalWidth,
      naturalHeight,
    };
    get().addLayer(layer);
    return layer;
  },

  addStickerLayer: (stickerId, x, y) => {
    const jitter = () => (Math.random() - 0.5) * 160;
    const layer: StickerLayer = {
      id: uid("l"),
      name: "Sticker",
      type: "sticker",
      visible: true,
      opacity: 1,
      clipped: false,
      x: x ?? CANVAS_W / 2 + jitter(),
      y: y ?? CANVAS_H / 2 + jitter(),
      rotation: (Math.random() - 0.5) * 12,
      scale: 1,
      stickerId,
    };
    get().addLayer(layer);
    return layer;
  },

  deleteLayer: (id) => {
    get()._commit((d) => {
      const c = d.canvases.find((c) => c.id === d.activeCanvasId);
      if (!c) return;
      const idx = c.layers.findIndex((l) => l.id === id);
      if (idx === -1) return;
      c.layers = c.layers.filter((l) => l.id !== id);
      if (d.activeLayerIds[c.id] === id) {
        const nextActive = c.layers[Math.max(0, idx - 1)];
        d.activeLayerIds[c.id] = nextActive?.id;
      }
    });
    set({ dirty: true, editingTextLayerId: null });
  },

  duplicateLayer: (id) => {
    get()._commit((d) => {
      const c = d.canvases.find((c) => c.id === d.activeCanvasId);
      if (!c) return;
      const idx = c.layers.findIndex((l) => l.id === id);
      if (idx === -1) return;
      const src = c.layers[idx];
      const copy = {
        ...src,
        id: uid("l"),
        name: `${src.name} copy`,
        x: src.x + 60,
        y: src.y + 60,
        strokes: src.type === "raster" ? [...src.strokes] : undefined,
      } as Layer;
      c.layers = [...c.layers.slice(0, idx + 1), copy, ...c.layers.slice(idx + 1)];
      d.activeLayerIds[c.id] = copy.id;
    });
    set({ dirty: true });
  },

  moveLayer: (id, dir) => {
    get()._commit((d) => {
      const c = d.canvases.find((c) => c.id === d.activeCanvasId);
      if (!c) return;
      const idx = c.layers.findIndex((l) => l.id === id);
      const to = dir === "up" ? idx + 1 : idx - 1;
      if (idx === -1 || to < 0 || to >= c.layers.length) return;
      const layers = [...c.layers];
      const [item] = layers.splice(idx, 1);
      layers.splice(to, 0, item);
      c.layers = layers;
    });
    set({ dirty: true });
  },

  reorderLayer: (id, toIndex) => {
    get()._commit((d) => {
      const c = d.canvases.find((c) => c.id === d.activeCanvasId);
      if (!c) return;
      const idx = c.layers.findIndex((l) => l.id === id);
      if (idx === -1 || toIndex === idx) return;
      const layers = [...c.layers];
      const [item] = layers.splice(idx, 1);
      layers.splice(Math.max(0, Math.min(layers.length, toIndex)), 0, item);
      c.layers = layers;
    });
    set({ dirty: true });
  },

  updateLayer: (id, patch, opts) => {
    if (opts?.history === false) {
      // Live gesture update (drag/slider preview) — no history entry.
      get()._mutateNoHistory((d) => {
        const c = d.canvases.find((c) => c.id === get().activeCanvasId);
        if (!c) return;
        c.layers = c.layers.map((l) =>
          l.id === id ? ({ ...l, ...patch } as Layer) : l
        );
      });
      set({ dirty: true });
      return;
    }
    get()._commit((d) => {
      const c = d.canvases.find((c) => c.id === d.activeCanvasId);
      if (!c) return;
      c.layers = c.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l));
    });
    set({ dirty: true });
  },

  toggleLayerVisible: (id) => {
    const layer = get().canvases.flatMap((c) => c.layers).find((l) => l.id === id);
    if (layer) get().updateLayer(id, { visible: !layer.visible });
  },

  toggleLayerClipped: (id) => {
    const layer = get().canvases.flatMap((c) => c.layers).find((l) => l.id === id);
    if (layer) get().updateLayer(id, { clipped: !layer.clipped });
  },

  applyClipShape: (shape) => {
    const { activeCanvasId } = get();
    if (!activeCanvasId) return;
    const layer = get().getActiveLayer();
    if (!layer) return;
    get().updateLayer(layer.id, { clipShape: shape });
    set({ pendingClip: null });
  },

  clearClipShape: (id) => get().updateLayer(id, { clipShape: undefined }),

  mergeDown: (id, flattened) => {
    get()._commit((d) => {
      const c = d.canvases.find((c) => c.id === d.activeCanvasId);
      if (!c) return;
      const idx = c.layers.findIndex((l) => l.id === id);
      if (idx <= 0) return; // nothing below to merge into
      const above = c.layers[idx];
      const below = c.layers[idx - 1];
      const merged: RasterLayer = {
        id: uid("l"),
        name: below.name,
        type: "raster",
        visible: true,
        opacity: Math.max(below.opacity, above.opacity),
        clipped: below.clipped,
        clipShape: below.clipShape,
        x: CANVAS_W / 2,
        y: CANVAS_H / 2,
        rotation: 0,
        scale: 1,
        strokes: [],
        flattened,
      };
      const layers = [...c.layers];
      layers.splice(idx - 1, 2, merged);
      c.layers = layers;
      d.activeLayerIds[c.id] = merged.id;
    });
    set({ dirty: true });
  },

  beginStroke: (layerId, stroke) =>
    set({ liveStroke: { layerId, stroke } }),

  extendStroke: (point) =>
    set((s) => {
      if (!s.liveStroke) return {};
      const points = [...s.liveStroke.stroke.points, point];
      return {
        liveStroke: { ...s.liveStroke, stroke: { ...s.liveStroke.stroke, points } },
      };
    }),

  commitStroke: () => {
    const s = get();
    const live = s.liveStroke;
    if (!live) return;
    const canvas = s.getActiveCanvas();
    const layer = canvas?.layers.find((l) => l.id === live.layerId);
    if (!canvas || !layer || layer.type !== "raster") {
      set({ liveStroke: null });
      return;
    }
    get()._commit((d) => {
      const c = d.canvases.find((c) => c.id === canvas.id)!;
      c.layers = c.layers.map((l) =>
        l.id === live.layerId && l.type === "raster"
          ? { ...l, strokes: [...l.strokes, live.stroke] }
          : l
      );
    });
    set({ liveStroke: null, dirty: true });
  },

  cancelStroke: () => set({ liveStroke: null }),

  commitBlur: (canvasId, layerId, flattened, snapshot) => {
    get()._mutateNoHistory((d) => {
      const c = d.canvases.find((c) => c.id === canvasId);
      if (!c) return;
      c.layers = c.layers.map((l) =>
        l.id === layerId && l.type === "raster"
          ? { ...l, strokes: [], flattened }
          : l
      ) as Layer[];
    });
    set({ dirty: true });
    get().pushHistory(snapshot);
  },

  setEditingText: (id) => set({ editingTextLayerId: id }),

  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const past = [...s.past];
    const entry = past.pop()!;
    set({
      past,
      future: [cloneEntry(s), ...s.future].slice(0, MAX_HISTORY),
      title: entry.title,
      canvases: entry.canvases,
      activeCanvasId:
        entry.canvases.find((c) => c.id === entry.activeCanvasId)?.id ??
        entry.canvases[0]?.id ??
        null,
      activeLayerIds: entry.activeLayerIds,
      dirty: true,
      liveStroke: null,
      pendingClip: null,
      editingTextLayerId: null,
    });
  },

  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const [entry, ...future] = s.future;
    set({
      future,
      past: [...s.past, cloneEntry(s)].slice(-MAX_HISTORY),
      title: entry.title,
      canvases: entry.canvases,
      activeCanvasId:
        entry.canvases.find((c) => c.id === entry.activeCanvasId)?.id ??
        entry.canvases[0]?.id ??
        null,
      activeLayerIds: entry.activeLayerIds,
      dirty: true,
      liveStroke: null,
      pendingClip: null,
      editingTextLayerId: null,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  captureHistory: () => {
    const s = get();
    return cloneEntry(s);
  },

  pushHistory: (entry) => {
    const s = get();
    // Only meaningful if something actually changed after the capture.
    if (
      entry.canvases === s.canvases &&
      entry.title === s.title
    )
      return;
    set({ past: [...s.past, entry].slice(-MAX_HISTORY), future: [] });
  },

  /**
   * Commit a mutation with history: clones the current entry into `past`
   * (reference copy — zero deep-copy cost), applies the mutation to a working
   * draft object built from fresh references, and clears `future`.
   */
  _commit: (mutate) => {
    const s = get();
    const draft = {
      title: s.title,
      canvases: s.canvases,
      activeCanvasId: s.activeCanvasId ?? "",
      activeLayerIds: s.activeLayerIds,
    };
    const working = {
      title: draft.title,
      canvases: draft.canvases.map((c) => ({
        ...c,
        layers: c.layers.map((l) => ({ ...l })),
      })),
      activeCanvasId: draft.activeCanvasId,
      activeLayerIds: { ...draft.activeLayerIds },
    };
    mutate(working);
    set({
      past: [...s.past, cloneEntry(s)].slice(-MAX_HISTORY),
      future: [],
      title: working.title,
      canvases: working.canvases,
      activeCanvasId: working.activeCanvasId || s.activeCanvasId,
      activeLayerIds: working.activeLayerIds,
    });
  },

  /**
   * Mutation without history (used for transient preview states).
   */
  _mutateNoHistory: (mutate) => {
    const s = get();
    const working = {
      canvases: s.canvases.map((c) => ({
        ...c,
        layers: c.layers.map((l) => ({ ...l })),
      })),
    };
    mutate(working);
    set({ canvases: working.canvases });
  },
}));
