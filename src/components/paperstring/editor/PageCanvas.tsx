"use client";

/**
 * PageCanvas — one canvas page in the editor: composite render + interaction
 * layer for every tool (select/transform, brush, eraser, text, eyedropper,
 * keep-inside selection), the selection chrome and the live text editor.
 */

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  CANVAS_W,
  CANVAS_H,
  type CanvasPageData,
  type Layer,
  type TextLayer,
} from "@/lib/paperstring/types";
import {
  layerAABB,
  applySoftFocus,
  applySmudge,
  getRasterBitmap,
  onEngineContentLoaded,
  pointInLayer,
  pressureFactor,
  registerSyncImage,
  renderPage,
  toLocal,
} from "@/lib/paperstring/render";
import { useEditorStore, type HistoryEntry } from "@/lib/paperstring/editor-store";
import { isViableLasso, simplifyPolyline } from "@/lib/paperstring/lasso";
import { LogoMark } from "@/components/paperstring/brand";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  page: CanvasPageData;
  active: boolean;
  width: number; // CSS px
  /** Show the decorative first-mark welcome (pristine single blank page). */
  welcome?: boolean;
}

type Gesture =
  | { kind: "none" }
  | { kind: "draw" }
  | { kind: "blur"; layerId: string }
  | { kind: "smudge"; layerId: string; lastLx: number; lastLy: number }
  | { kind: "move"; startX: number; startY: number; layer: Layer }
  | {
      kind: "scale";
      startX: number;
      startY: number;
      layer: Layer;
      startDist: number;
      corner: number;
    }
  | {
      kind: "rotate";
      layer: Layer;
      startAngle: number;
      startRotation: number;
    }
  | { kind: "select-area"; points: [number, number][] };

function PageCanvasInner({ page, active, width, welcome }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture>({ kind: "none" });
  const gestureSnapshotRef = useRef<HistoryEntry | null>(null);
  /** Live preview bitmap while a soft-focus or smudge gesture runs. */
  const blurPreviewRef = useRef<HTMLCanvasElement | null>(null);
  /** Live layer transform (move/scale/rotate) — applied by the rAF painter
   *  directly to the canvas, bypassing React entirely while the finger is
   *  down. Pointermoves (which fire at touch-sampling rate, up to 120Hz on
   *  modern phones) only write this ref; the store is touched ONCE on
   *  release. This is what makes dragging feel native — ibisPaint-grade
   *  1:1 finger tracking with zero render churn in between. */
  const liveRef = useRef<{ layerId: string; patch: Partial<Layer> } | null>(null);
  /** Pending rAF frame (direct canvas paint + chrome follow). */
  const rafRef = useRef<number | null>(null);
  /** Latest composite painter, callable imperatively from the rAF loop. */
  const drawRef = useRef<() => void>(() => {});
  /** Selection chrome root element + its gesture-start box (captured lazily
   *  from the DOM on the first live frame, so freshly-selected layers work). */
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const chromeStartRef = useRef<{ cx: number; cy: number; w: number; h: number } | null>(null);
  const paintChromeRef = useRef<() => void>(() => {});
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [engineTick, setEngineTick] = useState(0);
  const factor = width / CANVAS_W;

  const tool = useEditorStore((s) => s.tool);
  const liveStroke = useEditorStore((s) => s.liveStroke);
  const editingTextLayerId = useEditorStore((s) => s.editingTextLayerId);
  const pendingClip = useEditorStore((s) => s.pendingClip);
  const activeLayerId = useEditorStore(
    (s) => (s.activeCanvasId === page.id ? s.activeLayerIds[page.id] : undefined)
  );
  const brush = useEditorStore((s) => s.brush);
  const eraserSize = useEditorStore((s) => s.eraserSize);
  const blurTool = useEditorStore((s) => s.blur);
  const smudgeTool = useEditorStore((s) => s.smudge);

  useEffect(
    () => onEngineContentLoaded(() => setEngineTick((t) => t + 1)),
    []
  );

  /* ── composite render ─────────────────────────────────────────────── */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(width * dpr);
    const h = Math.round(width * (CANVAS_H / CANVAS_W) * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.scale(w / CANVAS_W, h / CANVAS_H);
    const g = gestureRef.current;
    // A live drag paints the moved/scaled/rotated layer without touching
    // the store — one shallow patch per frame, committed once on release.
    const live = liveRef.current;
    const target = live
      ? {
          ...page,
          layers: page.layers.map((l) =>
            l.id === live.layerId ? ({ ...l, ...live.patch } as Layer) : l
          ),
        }
      : page;
    renderPage(ctx, target, {
      liveStroke: liveStroke?.layerId ? liveStroke : null,
      liveBlur:
        (g.kind === "blur" || g.kind === "smudge") && blurPreviewRef.current
          ? { layerId: g.layerId, canvas: blurPreviewRef.current }
          : null,
      hideLayerId: editingTextLayerId ?? undefined,
    });
  }, [page, width, liveStroke, editingTextLayerId]);

  useLayoutEffect(() => {
    drawRef.current = draw;
    draw();
  });

  /** Schedule one direct paint on the next display frame — canvas composite
   *  plus selection-chrome follow. Coalesces 120Hz pointer streams into
   *  60fps paints (the display can only ever show the latest frame anyway). */
  const scheduleFrame = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawRef.current();
      paintChromeRef.current();
    });
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // Re-render when async assets (fonts/images/stickers) finish loading.
  useEffect(() => {
    void engineTick;
    draw();
  }, [engineTick, draw]);

  /* ── coordinate helpers ───────────────────────────────────────────── */

  const toUnits = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const rect = overlayRef.current!.getBoundingClientRect();
      return [
        ((clientX - rect.left) / rect.width) * CANVAS_W,
        ((clientY - rect.top) / rect.height) * CANVAS_H,
      ];
    },
    []
  );

  const hitLayer = useCallback(
    (ux: number, uy: number): Layer | null => {
      for (let i = page.layers.length - 1; i >= 0; i--) {
        const l = page.layers[i];
        let hit = false;
        try {
          hit = pointInLayer(l, ux, uy);
        } catch {
          hit = false;
        }
        if (hit) return l;
      }
      return null;
    },
    [page]
  );

  /** One soft-focus pass at canvas-units (ux, uy) on the live preview bitmap.
   *  Pen pressure (0..1) scales the pass strength — feather-light = gentle. */
  const applyBlurAt = useCallback(
    (layer: Layer, ux: number, uy: number, pressure?: number) => {
      const preview = blurPreviewRef.current;
      if (!preview || layer.type !== "raster") return;
      const { blur } = useEditorStore.getState();
      // Map the pointer into the bitmap's local (untransformed) space —
      // same math as pointInLayer, so the effect lands under the cursor even
      // when the raster layer has been moved, rotated or scaled.
      const [lx, ly] = toLocal(layer, ux, uy);
      const bx = lx / layer.scale + CANVAS_W / 2;
      const by = ly / layer.scale + CANVAS_H / 2;
      const radius = blur.size / 2 / layer.scale;
      const strength =
        pressure !== undefined
          ? Math.max(1, blur.strength * pressureFactor(pressure))
          : blur.strength;
      applySoftFocus(preview, bx, by, radius, strength);
      scheduleFrame(); // repaint with the liveBlur override (rAF, no React)
    },
    [scheduleFrame]
  );

  /** One smudge pass on the live preview bitmap: drags the sample under the
   *  cursor from its previous position to the current one. Returns the local
   *  coords so the gesture can update its own last-position. Pen pressure
   *  scales the drag alpha — a light touch whispers, a firm press smears. */
  const applySmudgeAt = useCallback(
    (
      layer: Layer,
      fromLx: number,
      fromLy: number,
      ux: number,
      uy: number,
      pressure?: number
    ) => {
      const preview = blurPreviewRef.current;
      if (!preview || layer.type !== "raster") return null;
      const { smudge } = useEditorStore.getState();
      const [lx, ly] = toLocal(layer, ux, uy);
      const bx = lx / layer.scale + CANVAS_W / 2;
      const by = ly / layer.scale + CANVAS_H / 2;
      const fromBx = fromLx / layer.scale + CANVAS_W / 2;
      const fromBy = fromLy / layer.scale + CANVAS_H / 2;
      const strength =
        pressure !== undefined
          ? Math.max(1, smudge.strength * pressureFactor(pressure))
          : smudge.strength;
      applySmudge(
        preview,
        fromBx,
        fromBy,
        bx,
        by,
        smudge.size / 2 / layer.scale,
        strength
      );
      scheduleFrame(); // repaint with the liveBitmap override (rAF, no React)
      return [lx, ly] as const;
    },
    [scheduleFrame]
  );

  /* ── pointer interactions ─────────────────────────────────────────── */

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const store = useEditorStore.getState();
      if (store.activeCanvasId !== page.id) store.setActiveCanvas(page.id);
      const [ux, uy] = toUnits(e.clientX, e.clientY);

      // Text edit overlay owns interactions while open.
      if (store.editingTextLayerId) return;

      // Track the active pointer family (low churn — pointerdown only) so the
      // editor can confirm stylus pressure is being read.
      if (e.pointerType === "pen") useEditorStore.setState({ penActive: true });
      else if (e.pointerType === "mouse" && store.penActive)
        useEditorStore.setState({ penActive: false });

      switch (store.tool) {
        case "brush":
        case "eraser": {
          e.currentTarget.setPointerCapture(e.pointerId);
          let layer = store.getActiveLayer();
          if (!layer || layer.type !== "raster") {
            layer = store.addRasterLayer();
          } else if (!layer.visible) {
            store.updateLayer(layer.id, { visible: true });
          }
          // Pen pointers record per-point pressure → tapered strokes.
          // Mouse/touch omit pressures entirely (constant width, byte-clean).
          const pen = e.pointerType === "pen";
          const stroke = {
            tool: store.tool as "brush" | "eraser",
            color: store.brush.color,
            size: store.tool === "brush" ? store.brush.size : store.eraserSize,
            opacity: store.tool === "brush" ? store.brush.opacity : 1,
            points: [[ux, uy]] as [number, number][],
            pressures: pen ? [e.pressure || 0.5] : undefined,
          };
          store.beginStroke(layer.id, stroke);
          gestureRef.current = { kind: "draw" };
          break;
        }
        case "blur": {
          e.currentTarget.setPointerCapture(e.pointerId);
          let layer = store.getActiveLayer();
          if (!layer || layer.type !== "raster") {
            layer = store.addRasterLayer();
          } else if (!layer.visible) {
            store.updateLayer(layer.id, { visible: true });
          }
          // Seed the preview with the layer's current bitmap, then blur live.
          const src = getRasterBitmap(layer);
          const preview = document.createElement("canvas");
          preview.width = CANVAS_W;
          preview.height = CANVAS_H;
          preview.getContext("2d")!.drawImage(src, 0, 0);
          blurPreviewRef.current = preview;
          gestureSnapshotRef.current = store.captureHistory();
          gestureRef.current = { kind: "blur", layerId: layer.id };
          applyBlurAt(layer, ux, uy);
          break;
        }
        case "smudge": {
          e.currentTarget.setPointerCapture(e.pointerId);
          let layer = store.getActiveLayer();
          if (!layer || layer.type !== "raster") {
            layer = store.addRasterLayer();
          } else if (!layer.visible) {
            store.updateLayer(layer.id, { visible: true });
          }
          // Seed the preview with the layer's current bitmap, then record
          // where the finger lands. The smear happens on the first move —
          // an in-place dab is an identity copy, so there is nothing to do yet.
          const src = getRasterBitmap(layer);
          const preview = document.createElement("canvas");
          preview.width = CANVAS_W;
          preview.height = CANVAS_H;
          preview.getContext("2d")!.drawImage(src, 0, 0);
          blurPreviewRef.current = preview;
          gestureSnapshotRef.current = store.captureHistory();
          const [lx, ly] = toLocal(layer, ux, uy);
          gestureRef.current = {
            kind: "smudge",
            layerId: layer.id,
            lastLx: lx,
            lastLy: ly,
          };
          break;
        }
        case "text": {
          // Canceling pointerdown suppresses the compatibility mousedown,
          // which would otherwise steal focus from the text editor that is
          // about to open (blur → instant commit → editor closes).
          e.preventDefault();
          store.addTextLayer(ux, uy);
          break;
        }
        case "eyedropper": {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d")!;
            const rect = overlayRef.current!.getBoundingClientRect();
            const px = Math.round(
              ((e.clientX - rect.left) / rect.width) * canvas.width
            );
            const py = Math.round(
              ((e.clientY - rect.top) / rect.height) * canvas.height
            );
            const d = ctx.getImageData(
              Math.max(0, Math.min(canvas.width - 1, px)),
              Math.max(0, Math.min(canvas.height - 1, py)),
              1,
              1
            ).data;
            const hex =
              "#" +
              [d[0], d[1], d[2]]
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("");
            store.setBrush({ color: hex });
            store.pushColorHistory(hex);
            store.setTextDefaults({ color: hex });
          }
          store.setTool(store.prevTool === "eyedropper" ? "select" : store.prevTool);
          break;
        }
        case "select-area": {
          // Freehand lasso, Photoshop-style: the drag traces an arbitrary
          // outline in real time; releasing auto-closes the loop back to the
          // start point and the enclosed area becomes the keep-inside mask.
          e.currentTarget.setPointerCapture(e.pointerId);
          gestureRef.current = { kind: "select-area", points: [[ux, uy]] };
          useEditorStore.setState({
            pendingClip: {
              canvasId: page.id,
              shape: { type: "path", points: [[ux, uy]] },
            },
          });
          break;
        }
        case "select":
        default: {
          const hit = hitLayer(ux, uy);
          if (!hit) {
            store.setActiveLayer(undefined);
            return;
          }
          store.setActiveLayer(hit.id);
          e.currentTarget.setPointerCapture(e.pointerId);
          gestureSnapshotRef.current = store.captureHistory();
          gestureRef.current = {
            kind: "move",
            startX: ux,
            startY: uy,
            layer: hit,
          };
          break;
        }
      }
    },
    [page.id, hitLayer, toUnits]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const store = useEditorStore.getState();
      const [ux, uy] = toUnits(e.clientX, e.clientY);

      // Brush cursor preview
      if (
        active &&
        (store.tool === "brush" ||
          store.tool === "eraser" ||
          store.tool === "blur" ||
          store.tool === "smudge") &&
        e.pointerType === "mouse"
      ) {
        const rect = overlayRef.current!.getBoundingClientRect();
        setCursor({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }

      const g = gestureRef.current;
      if (g.kind === "none") return;

      if (g.kind === "draw") {
        store.extendStroke(
          [ux, uy],
          e.pointerType === "pen" ? e.pressure || 0.5 : undefined
        );
      } else if (g.kind === "blur") {
        // Read layers fresh from the store — the gesture may have created the
        // raster layer after this callback's `page` closure was taken.
        const layer = store.canvases
          .find((c) => c.id === page.id)
          ?.layers.find((l) => l.id === g.layerId);
        if (layer)
          applyBlurAt(
            layer,
            ux,
            uy,
            e.pointerType === "pen" ? e.pressure : undefined
          );
      } else if (g.kind === "smudge") {
        // Same freshness rule as blur: resolve the layer from the live store.
        const layer = store.canvases
          .find((c) => c.id === page.id)
          ?.layers.find((l) => l.id === g.layerId);
        if (layer) {
          const next = applySmudgeAt(
            layer,
            g.lastLx,
            g.lastLy,
            ux,
            uy,
            e.pointerType === "pen" ? e.pressure : undefined
          );
          if (next) {
            g.lastLx = next[0];
            g.lastLy = next[1];
          }
        }
      } else if (g.kind === "move") {
        // Native-grade drag: write the live transform, paint on the next
        // display frame — the store is only touched once, on release.
        liveRef.current = {
          layerId: g.layer.id,
          patch: {
            x: g.layer.x + (ux - g.startX),
            y: g.layer.y + (uy - g.startY),
          },
        };
        scheduleFrame();
      } else if (g.kind === "scale") {
        const dist = Math.hypot(ux - g.layer.x, uy - g.layer.y);
        let scale = Math.max(
          0.05,
          Math.min(12, g.layer.scale * (dist / g.startDist))
        );
        if (g.layer.type === "text") {
          // Keep the resulting font size in a sane range (10–800 canvas
          // units) at gesture time, so baking on release never snaps the
          // glyphs back after an extreme drag.
          scale = Math.max(scale, 10 / g.layer.fontSize);
          scale = Math.min(scale, 800 / g.layer.fontSize);
        }
        liveRef.current = { layerId: g.layer.id, patch: { scale } };
        scheduleFrame();
      } else if (g.kind === "rotate") {
        const angle =
          (Math.atan2(uy - g.layer.y, ux - g.layer.x) * 180) / Math.PI + 90;
        liveRef.current = {
          layerId: g.layer.id,
          patch: { rotation: g.startRotation + (angle - g.startAngle) },
        };
        scheduleFrame();
      } else if (g.kind === "select-area") {
        // Follow the finger exactly: every pointermove appends the fresh
        // sample (a hairline threshold discards sub-pixel jitter so a
        // 120Hz stream doesn't bloat the path).
        const pts = g.points;
        const last = pts[pts.length - 1];
        if (Math.hypot(ux - last[0], uy - last[1]) >= 2.5) {
          pts.push([ux, uy]);
          useEditorStore.setState({
            pendingClip: {
              canvasId: page.id,
              shape: { type: "path", points: pts.slice() },
            },
          });
        }
      }
    },
    [active, page.id, toUnits, scheduleFrame]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const store = useEditorStore.getState();
      const g = gestureRef.current;
      gestureRef.current = { kind: "none" };
      if (g.kind === "none") return;

      if (g.kind === "draw") {
        const [ux, uy] = toUnits(e.clientX, e.clientY);
        store.extendStroke(
          [ux, uy],
          e.pointerType === "pen" ? e.pressure || 0.5 : undefined
        );
        store.commitStroke();
      } else if (g.kind === "blur") {
        // Flatten the softened preview into the layer's bitmap — one undo entry.
        const preview = blurPreviewRef.current;
        const snapshot = gestureSnapshotRef.current;
        gestureSnapshotRef.current = null;
        blurPreviewRef.current = null;
        if (preview && snapshot) {
          const [ux, uy] = toUnits(e.clientX, e.clientY);
          const layer = store.canvases
            .find((c) => c.id === page.id)
            ?.layers.find((l) => l.id === g.layerId);
          if (layer && layer.type === "raster") {
            // Final pass under the release — applied directly to the preview
            // (the ref is already cleared, so applyBlurAt can't see it).
            const { blur } = store;
            const pen = e.pointerType === "pen" ? e.pressure : undefined;
            const [lx, ly] = toLocal(layer, ux, uy);
            applySoftFocus(
              preview,
              lx / layer.scale + CANVAS_W / 2,
              ly / layer.scale + CANVAS_H / 2,
              blur.size / 2 / layer.scale,
              pen !== undefined
                ? Math.max(1, blur.strength * pressureFactor(pen))
                : blur.strength
            );
          }
          const flattened = preview.toDataURL("image/png");
          // Prime the decode cache so the committed bitmap renders instantly.
          const img = new Image();
          img.onload = () => registerSyncImage(flattened, img);
          img.src = flattened;
          store.commitBlur(page.id, g.layerId, flattened, snapshot);
        }
      } else if (g.kind === "smudge") {
        // Flatten the smeared preview into the layer's bitmap — one undo entry.
        // Shares the blur commit path: it is the same raster-flatten operation.
        const preview = blurPreviewRef.current;
        const snapshot = gestureSnapshotRef.current;
        gestureSnapshotRef.current = null;
        blurPreviewRef.current = null;
        if (preview && snapshot) {
          const [ux, uy] = toUnits(e.clientX, e.clientY);
          const layer = store.canvases
            .find((c) => c.id === page.id)
            ?.layers.find((l) => l.id === g.layerId);
          if (layer && layer.type === "raster") {
            // One last drag from the previous sample to the release point,
            // applied directly to the preview (the ref is already cleared).
            const { smudge } = store;
            const pen = e.pointerType === "pen" ? e.pressure : undefined;
            const [lx, ly] = toLocal(layer, ux, uy);
            applySmudge(
              preview,
              g.lastLx / layer.scale + CANVAS_W / 2,
              g.lastLy / layer.scale + CANVAS_H / 2,
              lx / layer.scale + CANVAS_W / 2,
              ly / layer.scale + CANVAS_H / 2,
              smudge.size / 2 / layer.scale,
              pen !== undefined
                ? Math.max(1, smudge.strength * pressureFactor(pen))
                : smudge.strength
            );
          }
          const flattened = preview.toDataURL("image/png");
          const img = new Image();
          img.onload = () => registerSyncImage(flattened, img);
          img.src = flattened;
          store.commitBlur(page.id, g.layerId, flattened, snapshot);
        }
      } else if (
        g.kind === "move" ||
        g.kind === "scale" ||
        g.kind === "rotate"
      ) {
        // Commit the gesture's final transform in ONE store update — a single
        // React render + a single undo entry covering the whole drag.
        const live = liveRef.current;
        liveRef.current = null;
        chromeStartRef.current = null;
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        // Live size badge off — the committed chrome re-renders from the store.
        const badge = chromeRef.current?.querySelector<HTMLElement>(
          "[data-size-badge]"
        );
        if (badge) badge.style.opacity = "0";
        if (live && Object.keys(live.patch).length > 0) {
          let patch = live.patch;
          if (
            g.kind === "scale" &&
            g.layer.type === "text" &&
            patch.scale !== undefined
          ) {
            // Corner-handle resizing scales the glyphs themselves
            // (IbisPaint-style): the drag previews through layer.scale, then
            // bakes into fontSize here so the font size stays the single
            // source of truth — panel sliders, the on-page editor and the
            // measures all read it directly. No snap: the gesture already
            // clamped the product into a sane range.
            patch = {
              fontSize: g.layer.fontSize * patch.scale,
              letterSpacing: g.layer.letterSpacing * patch.scale,
              scale: 1,
            };
          }
          store.updateLayer(live.layerId, patch, { history: false });
          store.pushHistory(gestureSnapshotRef.current);
        }
        gestureSnapshotRef.current = null;
      } else if (g.kind === "select-area") {
        // Release closes the loop back to the start point (the mask path and
        // the preview polygon both auto-close). Simplify the traced samples
        // (RDP) so the stored mask stays lean; a degenerate trace — a tap or
        // a hairline scratch — cancels itself instead of masking to nothing.
        const simplified = simplifyPolyline(g.points, 2);
        if (isViableLasso(simplified)) {
          useEditorStore.setState({
            pendingClip: {
              canvasId: page.id,
              shape: { type: "path", points: simplified },
            },
          });
        } else {
          useEditorStore.setState({ pendingClip: null });
        }
      }
    },
    [page.id, toUnits]
  );

  /* ── live chrome follow ──────────────────────────────────────────── */

  /** Imperatively move the selection chrome while a transform gesture runs —
   *  pure DOM style writes, synced to the same rAF frame as the canvas paint
   *  so the box tracks the artwork with zero perceptible lag. The chrome's
   *  children are %-positioned, so resizing the box carries the corner
   *  handles and the action pill along automatically. On release, React
   *  re-renders the chrome from the committed store values — identical to
   *  the last live frame, so there is no snap or flash. */
  const paintChromeLive = useCallback(() => {
    const el = chromeRef.current;
    const live = liveRef.current;
    const g = gestureRef.current;
    if (!el || !live) return;
    if (!chromeStartRef.current) {
      // First live frame: capture the chrome's resting geometry from the DOM
      // (works even when the layer was selected by this very gesture — React
      // will have painted the chrome before this frame runs).
      chromeStartRef.current = {
        cx: el.offsetLeft,
        cy: el.offsetTop,
        w: el.offsetWidth,
        h: el.offsetHeight,
      };
    }
    const start = chromeStartRef.current;
    const patch = live.patch;
    let cx = start.cx;
    let cy = start.cy;
    let w = start.w;
    let h = start.h;
    let rotation: number | undefined;
    if (g.kind === "move") {
      if (patch.x !== undefined) cx += (patch.x - g.layer.x) * (width / CANVAS_W);
      if (patch.y !== undefined) cy += (patch.y - g.layer.y) * (width / CANVAS_W);
    } else if (g.kind === "scale") {
      if (patch.scale !== undefined) {
        const k = patch.scale / g.layer.scale;
        w *= k;
        h *= k;
      }
    } else if (g.kind === "rotate") {
      rotation = patch.rotation;
    }
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
    if (w !== start.w || h !== start.h) {
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    }
    // The chrome's resting transform carries the layer's gesture-start
    // rotation; only the rotate gesture overrides it.
    const baseRotation =
      g.kind === "move" || g.kind === "scale" || g.kind === "rotate"
        ? g.layer.rotation
        : 0;
    el.style.transform = `translate(-50%, -50%) rotate(${rotation ?? baseRotation}deg)`;

    // Live font-size readout while a text layer is corner-scaled (IbisPaint
    // shows the size as you drag) — hidden for every other gesture/state.
    const badge = el.querySelector<HTMLElement>("[data-size-badge]");
    if (badge) {
      if (
        g.kind === "scale" &&
        g.layer.type === "text" &&
        patch.scale !== undefined
      ) {
        badge.textContent = `${Math.round(g.layer.fontSize * patch.scale)} px`;
        badge.style.opacity = "1";
      } else {
        badge.style.opacity = "0";
      }
    }
  }, [width]);

  useLayoutEffect(() => {
    paintChromeRef.current = paintChromeLive;
  });

  /* ── selection chrome (active layer) ──────────────────────────────── */

  const activeLayer =
    page.layers.find((l) => l.id === activeLayerId && l.visible) ?? null;
  const showChrome = active && tool === "select" && activeLayer && !editingTextLayerId;

  const aabb = showChrome && activeLayer ? layerAABB(activeLayer, 8) : null;
  const editingLayer =
    page.layers.find((l) => l.id === editingTextLayerId && l.type === "text") as
      | TextLayer
      | undefined ?? null;

  const startHandleGesture = (
    e: React.PointerEvent,
    kind: "scale" | "rotate",
    corner = 0
  ) => {
    e.stopPropagation();
    if (!activeLayer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gestureSnapshotRef.current = useEditorStore.getState().captureHistory();
    const [ux, uy] = toUnits(e.clientX, e.clientY);
    if (kind === "scale") {
      gestureRef.current = {
        kind: "scale",
        startX: ux,
        startY: uy,
        layer: activeLayer,
        startDist: Math.max(1, Math.hypot(ux - activeLayer.x, uy - activeLayer.y)),
        corner,
      };
    } else {
      gestureRef.current = {
        kind: "rotate",
        layer: activeLayer,
        startAngle:
          (Math.atan2(uy - activeLayer.y, ux - activeLayer.x) * 180) / Math.PI + 90,
        startRotation: activeLayer.rotation,
      };
    }
  };

  const pendingShape =
    pendingClip && pendingClip.canvasId === page.id && tool === "select-area"
      ? pendingClip.shape
      : null;

  return (
    <div
      className="relative select-none"
      style={{ width, height: width * (CANVAS_H / CANVAS_W) }}
      /* Move/up/cancel live on the PAGE ROOT — the common ancestor of both
         the interaction overlay and the selection chrome. Gesture handles
         (scale corners, rotate) setPointerCapture on themselves, so their
         moves target the handle and bubble through the chrome — never
         through the overlay sibling. Root-level handlers see every stream. */
      onPointerMove={active ? onPointerMove : undefined}
      onPointerUp={active ? onPointerUp : undefined}
      onPointerCancel={active ? onPointerUp : undefined}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full rounded-lg bg-white shadow-[0_18px_44px_-18px_rgba(0,0,0,0.18),0_4px_12px_-6px_rgba(0,0,0,0.07)] ring-1 ring-black/[0.08]"
        aria-label={`Canvas page ${page.id}`}
      />

      {/* decorative welcome on a pristine first page — editor chrome only,
          never exported, and it vanishes with the very first mark */}
      {welcome && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center gap-4 px-12 text-center"
        >
          <div className="relative ps-float motion-reduce:animate-none">
            <LogoMark className="h-14 w-[3.9rem] text-silver/70" strokeWidth={2.4} />
            {/* a faint dashed gesture, like the first stroke about to happen */}
            <svg
              viewBox="0 0 120 24"
              fill="none"
              className="absolute -bottom-5 left-1/2 h-4 w-[7.5rem] -translate-x-1/2 text-silver/50"
            >
              <path
                d="M4 16 C 28 4, 52 22, 76 10 S 108 14, 116 8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="1 7"
              />
            </svg>
          </div>
          <p className="font-display text-lg leading-snug text-onyx/55 sm:text-xl">
            This page is waiting for your first mark
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#9a9a9a]">
            pick a brush · begin anywhere
          </p>
        </div>
      )}

      {/* interaction overlay */}
      <div
        ref={overlayRef}
        role="application"
        aria-label={`Edit canvas page — tool: ${tool}`}
        onPointerDown={active ? onPointerDown : undefined}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={(e) => {
          if (tool !== "select") return;
          const [ux, uy] = toUnits(e.clientX, e.clientY);
          const hit = hitLayer(ux, uy);
          if (hit?.type === "text") {
            const store = useEditorStore.getState();
            store.setActiveLayer(hit.id);
            store.setEditingText(hit.id);
          }
        }}
        className={cn(
          "absolute inset-0 rounded-lg",
          active ? "touch-none" : "cursor-pointer",
          tool === "select" && active && "cursor-default",
          (tool === "brush" ||
            tool === "eraser" ||
            tool === "eyedropper" ||
            tool === "blur" ||
            tool === "smudge") &&
            active &&
            "cursor-none",
          tool === "text" && active && "cursor-text"
        )}
      >
        {/* brush size cursor — white ring with a dark inner hairline so it
            stays visible over light AND dark artwork; the soft-focus nib
            gets a dashed ring, the smudge finger a thicker solid one */}
        {cursor &&
          active &&
          (tool === "brush" || tool === "eraser" || tool === "blur" || tool === "smudge") && (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute rounded-full bg-white/10 shadow-[0_0_0_1px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(0,0,0,0.35)]",
              tool === "blur"
                ? "border border-dashed border-white/90"
                : tool === "smudge"
                  ? "border-2 border-solid border-white/90"
                  : "border border-white/95"
            )}
            style={{
              left: cursor.x,
              top: cursor.y,
              width:
                (tool === "brush"
                  ? brush.size
                  : tool === "eraser"
                    ? eraserSize
                    : tool === "blur"
                      ? blurTool.size
                      : smudgeTool.size) * factor,
              height:
                (tool === "brush"
                  ? brush.size
                  : tool === "eraser"
                    ? eraserSize
                    : tool === "blur"
                      ? blurTool.size
                      : smudgeTool.size) * factor,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>

      {/* active page ring — a crisp hairline with a heartstring glow */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -inset-[3px] rounded-[10px] transition-all duration-300",
          active
            ? "ring-1 ring-night/[0.14] shadow-[0_0_0_4px_rgba(232,68,106,0.16),0_0_28px_-6px_rgba(232,68,106,0.22)]"
            : "ring-0 shadow-none"
        )}
      />

      {/* selection chrome */}
      {showChrome && aabb && activeLayer && (
        <SelectionChrome
          layer={activeLayer}
          aabb={aabb}
          factor={factor}
          chromeRef={chromeRef}
          onHandleDown={startHandleGesture}
          onEdit={
            activeLayer.type === "text"
              ? () =>
                  useEditorStore.getState().setEditingText(activeLayer.id)
              : undefined
          }
          onDelete={() => {
            const id = activeLayer.id;
            useEditorStore.getState().deleteLayer(id);
            toast.success("Removed from the page", {
              description: "You can undo it right away.",
              action: {
                label: "Undo",
                onClick: () => useEditorStore.getState().undo(),
              },
            });
          }}
        />
      )}

      {/* lasso (keep-inside) selection preview — the dashed rose loop traces
          the drag in real time; the polygon auto-closes back to the start
          point, and the anchor dot marks where the loop will seal */}
      {pendingShape &&
        (pendingShape.type === "path" ? (
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <polygon
              points={pendingShape.points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="rgba(232,68,106,0.08)"
              fillRule="evenodd"
              stroke="#e8446a"
              strokeWidth={5}
              strokeDasharray="20 16"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {pendingShape.points.length > 0 && (
              <circle
                cx={pendingShape.points[0][0]}
                cy={pendingShape.points[0][1]}
                r={18}
                fill="#fff"
                stroke="#e8446a"
                strokeWidth={5}
              />
            )}
          </svg>
        ) : (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-2 border-dashed border-[#e8446a] bg-[#e8446a]/10"
            style={{
              left: pendingShape.x * factor,
              top: pendingShape.y * factor,
              width: pendingShape.w * factor,
              height: pendingShape.h * factor,
              borderRadius: pendingShape.type === "ellipse" ? "50%" : 8,
            }}
          />
        ))}

      {/* live text editor */}
      {editingLayer && (
        <TextEditorOverlay layer={editingLayer} factor={factor} />
      )}
    </div>
  );
}

/* ── text editor overlay ─────────────────────────────────────────── */

/** One icon button inside the floating action pill — iOS-style rounded
 *  rectangle (12px), quiet pressed state, soft shadow on the container. */
function ChromeAction({
  label,
  onPointerDown,
  onClick,
  children,
  danger,
}: {
  label: string;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown?.(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-xl transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8446a] active:scale-90",
        danger
          ? "text-[#c73a56] hover:bg-[#fdeef2] active:bg-[#fbdde6]"
          : "text-night/70 hover:bg-smoke active:bg-[#e9e9e9]",
        onPointerDown && "touch-none"
      )}
    >
      {children}
    </button>
  );
}

function SelectionChrome({
  layer,
  aabb,
  factor,
  chromeRef,
  onHandleDown,
  onEdit,
  onDelete,
}: {
  layer: Layer;
  aabb: { x0: number; y0: number; x1: number; y1: number };
  factor: number;
  /** Live-transform root — moved imperatively (rAF) while a gesture runs. */
  chromeRef: React.RefObject<HTMLDivElement | null>;
  onHandleDown: (
    e: React.PointerEvent,
    kind: "scale" | "rotate",
    corner?: number
  ) => void;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  // Draw chrome around the *rotated content box* center-aligned like the art.
  const cx = (aabb.x0 + aabb.x1) / 2;
  const cy = (aabb.y0 + aabb.y1) / 2;
  const w = (aabb.x1 - aabb.x0) * factor;
  const h = (aabb.y1 - aabb.y0) * factor;
  // When the layer sits near the page's top edge, the floating action pill
  // (52px above the box) would poke under the TopBar or offscreen — flip it
  // below the box instead so it is always reachable.
  const pillBelow = aabb.y0 * factor < 72;
  // %-positioned so the live rAF resizes carry them along automatically.
  const corners: [string, string][] = [
    ["0%", "0%"],
    ["100%", "0%"],
    ["100%", "100%"],
    ["0%", "100%"],
  ];
  return (
    <div
      ref={chromeRef}
      className="pointer-events-none absolute"
      style={{
        left: cx * factor,
        top: cy * factor,
        width: w,
        height: h,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
      }}
    >
      <div className="absolute inset-0 rounded-[6px] border-[1.5px] border-[#e8446a]" />

      {/* floating action pill — rotate · edit text · delete (iOS style);
          flips below the box when the layer hugs the page's top edge, and
          counter-rotates so it always reads upright (Figma-style) */}
      <div
        style={{ transform: `translateX(-50%) rotate(${-layer.rotation}deg)` }}
        className={cn(
          "pointer-events-auto absolute left-1/2 flex items-center gap-0.5 rounded-2xl border border-black/[0.06] bg-white/95 p-1 shadow-[0_10px_28px_-10px_rgba(0,0,0,0.28),0_2px_6px_-2px_rgba(0,0,0,0.08)] backdrop-blur-md",
          pillBelow ? "-bottom-[3.25rem]" : "-top-[3.25rem]"
        )}
      >
        <ChromeAction
          label="Rotate layer"
          onPointerDown={(e) => onHandleDown(e, "rotate")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="cursor-grab">
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 3v5h-5" />
          </svg>
        </ChromeAction>
        {onEdit && (
          <ChromeAction label="Edit text" onClick={() => onEdit()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </ChromeAction>
        )}
        <span aria-hidden="true" className="mx-0.5 h-4 w-px rounded-full bg-black/[0.08]" />
        <ChromeAction label="Delete layer" onClick={() => onDelete()} danger>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </ChromeAction>
      </div>

      {/* scale corners — on text layers they resize the font itself */}
      {corners.map(([x, y], i) => (
        <button
          key={i}
          type="button"
          aria-label={
            layer.type === "text"
              ? `Resize text from corner ${i + 1} — the font scales with the box`
              : `Resize from corner ${i + 1}`
          }
          onPointerDown={(e) => onHandleDown(e, "scale", i)}
          className="pointer-events-auto absolute h-[18px] w-[18px] touch-none -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-full border-[1.5px] border-[#e8446a] bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)] transition-transform duration-150 hover:scale-[1.3] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8446a]"
          style={{ left: x, top: y }}
        />
      ))}

      {/* live font-size readout — driven imperatively by paintChromeLive
          while a text layer is corner-scaled; counter-rotates like the pill
          and sits on the side opposite the action pill */}
      <div
        data-size-badge
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 -z-10 whitespace-nowrap rounded-full bg-night/90 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white opacity-0 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)] transition-opacity duration-100",
          pillBelow ? "-top-[2.4rem]" : "-bottom-[2.4rem]"
        )
        }
        style={{
          transform: `translateX(-50%) rotate(${-layer.rotation}deg)`,
        }}
      >
        0 px
      </div>
    </div>
  );
}

/* ── text editor overlay ─────────────────────────────────────────────── */

function TextEditorOverlay({
  layer,
  factor,
}: {
  layer: TextLayer;
  factor: number;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const { updateLayer, setEditingText, captureHistory, pushHistory } =
    useEditorStore.getState();
  const [snapshot] = useState(() => captureHistory());

  const commit = () => {
    pushHistory(snapshot);
    setEditingText(null);
  };

  return (
    <div
      className="absolute z-10"
      style={{
        left: layer.x * factor,
        top: layer.y * factor,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
      }}
    >
      <textarea
        ref={ref}
        value={layer.text}
        onChange={(e) =>
          updateLayer(layer.id, { text: e.target.value }, { history: false })
        }
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            commit();
          }
          e.stopPropagation();
        }}
        rows={Math.max(1, layer.text.split("\n").length)}
        spellCheck={false}
        aria-label="Edit text content"
        className="resize-none overflow-hidden whitespace-pre rounded-md border border-dashed border-[#e8446a]/70 bg-white/70 px-2 py-1 text-center outline-none backdrop-blur-[1px] focus:border-solid"
        style={{
          fontFamily: layer.fontFamily,
          fontSize: layer.fontSize * factor,
          lineHeight: layer.lineHeight,
          letterSpacing: layer.letterSpacing * factor,
          color: layer.color,
          fontWeight: layer.bold ? 700 : 400,
          fontStyle: layer.italic ? "italic" : "normal",
          textDecoration: layer.underline ? "underline" : "none",
          minWidth: 80,
          width: Math.max(120, measureWidth(layer) * factor + 40),
        }}
      />
    </div>
  );
}

function measureWidth(l: TextLayer): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 200;
  ctx.font = `${l.italic ? "italic " : ""}${l.bold ? 700 : 400} ${l.fontSize}px ${l.fontFamily}`;
  const lines = l.text.split("\n");
  return Math.max(...lines.map((s) => ctx.measureText(s || " ").width), 80);
}

export const PageCanvas = memo(PageCanvasInner);
