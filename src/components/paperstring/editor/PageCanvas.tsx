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
  layerContentBox,
  onEngineContentLoaded,
  pointInLayer,
  renderPage,
} from "@/lib/paperstring/render";
import { useEditorStore, type HistoryEntry } from "@/lib/paperstring/editor-store";
import { cn } from "@/lib/utils";

interface Props {
  page: CanvasPageData;
  active: boolean;
  width: number; // CSS px
}

type Gesture =
  | { kind: "none" }
  | { kind: "draw" }
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
  | { kind: "select-area"; x0: number; y0: number };

function PageCanvasInner({ page, active, width }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture>({ kind: "none" });
  const gestureSnapshotRef = useRef<HistoryEntry | null>(null);
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
    renderPage(ctx, page, {
      liveStroke: liveStroke?.layerId ? liveStroke : null,
      hideLayerId: editingTextLayerId ?? undefined,
    });
  }, [page, width, liveStroke, editingTextLayerId]);

  useLayoutEffect(draw);

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

  /* ── pointer interactions ─────────────────────────────────────────── */

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const store = useEditorStore.getState();
      if (store.activeCanvasId !== page.id) store.setActiveCanvas(page.id);
      const [ux, uy] = toUnits(e.clientX, e.clientY);

      // Text edit overlay owns interactions while open.
      if (store.editingTextLayerId) return;

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
          const stroke = {
            tool: store.tool as "brush" | "eraser",
            color: store.brush.color,
            size: store.tool === "brush" ? store.brush.size : store.eraserSize,
            opacity: store.tool === "brush" ? store.brush.opacity : 1,
            points: [[ux, uy]] as [number, number][],
          };
          store.beginStroke(layer.id, stroke);
          gestureRef.current = { kind: "draw" };
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
          e.currentTarget.setPointerCapture(e.pointerId);
          gestureRef.current = { kind: "select-area", x0: ux, y0: uy };
          useEditorStore.setState({
            pendingClip: { canvasId: page.id, shape: { type: store.selectionShape, x: ux, y: uy, w: 0, h: 0 } },
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
        (store.tool === "brush" || store.tool === "eraser") &&
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
        store.extendStroke([ux, uy]);
      } else if (g.kind === "move") {
        store.updateLayer(
          g.layer.id,
          {
            x: g.layer.x + (ux - g.startX),
            y: g.layer.y + (uy - g.startY),
          },
          { history: false }
        );
      } else if (g.kind === "scale") {
        const dist = Math.hypot(ux - g.layer.x, uy - g.layer.y);
        const scale = Math.max(
          0.05,
          Math.min(12, g.layer.scale * (dist / g.startDist))
        );
        store.updateLayer(g.layer.id, { scale }, { history: false });
      } else if (g.kind === "rotate") {
        const angle =
          (Math.atan2(uy - g.layer.y, ux - g.layer.x) * 180) / Math.PI + 90;
        store.updateLayer(
          g.layer.id,
          { rotation: g.startRotation + (angle - g.startAngle) },
          { history: false }
        );
      } else if (g.kind === "select-area") {
        const shape = {
          type: store.selectionShape,
          x: Math.min(g.x0, ux),
          y: Math.min(g.y0, uy),
          w: Math.abs(ux - g.x0),
          h: Math.abs(uy - g.y0),
        };
        useEditorStore.setState({
          pendingClip: { canvasId: page.id, shape },
        });
      }
    },
    [active, page.id, toUnits]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const store = useEditorStore.getState();
      const g = gestureRef.current;
      gestureRef.current = { kind: "none" };
      if (g.kind === "none") return;

      if (g.kind === "draw") {
        const [ux, uy] = toUnits(e.clientX, e.clientY);
        store.extendStroke([ux, uy]);
        store.commitStroke();
      } else if (
        g.kind === "move" ||
        g.kind === "scale" ||
        g.kind === "rotate"
      ) {
        // One undo entry covering the whole gesture (captured at start).
        store.pushHistory(gestureSnapshotRef.current);
      } else if (g.kind === "select-area") {
        // keep pendingClip alive for apply/cancel in the panel
      }
    },
    [page.layers, toUnits]
  );

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
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full rounded-lg bg-white shadow-[0_24px_60px_-18px_rgba(0,0,0,0.65),0_6px_16px_-8px_rgba(0,0,0,0.4)] ring-1 ring-black/15"
        aria-label={`Canvas page ${page.id}`}
      />

      {/* interaction overlay */}
      <div
        ref={overlayRef}
        role="application"
        aria-label={`Edit canvas page — tool: ${tool}`}
        onPointerDown={active ? onPointerDown : undefined}
        onPointerMove={active ? onPointerMove : undefined}
        onPointerUp={active ? onPointerUp : undefined}
        onPointerCancel={active ? onPointerUp : undefined}
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
          (tool === "brush" || tool === "eraser" || tool === "eyedropper") &&
            active &&
            "cursor-none",
          tool === "text" && active && "cursor-text"
        )}
      >
        {/* brush size cursor — white ring with a dark inner hairline so it
            stays visible over light AND dark artwork */}
        {cursor && active && (tool === "brush" || tool === "eraser") && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full border border-white/95 bg-white/10 shadow-[0_0_0_1px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(0,0,0,0.35)]"
            style={{
              left: cursor.x,
              top: cursor.y,
              width: (tool === "brush" ? brush.size : eraserSize) * factor,
              height: (tool === "brush" ? brush.size : eraserSize) * factor,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>

      {/* active page ring — a soft paper-white edge with a heartstring glow */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -inset-[3px] rounded-[10px] transition-all duration-300",
          active
            ? "ring-1 ring-white/90 shadow-[0_0_0_4px_rgba(232,68,106,0.25),0_0_28px_-4px_rgba(232,68,106,0.3)]"
            : "ring-0 shadow-none"
        )}
      />

      {/* selection chrome */}
      {showChrome && aabb && activeLayer && (
        <SelectionChrome
          layer={activeLayer}
          aabb={aabb}
          factor={factor}
          onHandleDown={startHandleGesture}
          onEdit={
            activeLayer.type === "text"
              ? () =>
                  useEditorStore.getState().setEditingText(activeLayer.id)
              : undefined
          }
        />
      )}

      {/* keep-inside selection preview */}
      {pendingShape && (
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
      )}

      {/* live text editor */}
      {editingLayer && (
        <TextEditorOverlay layer={editingLayer} factor={factor} />
      )}
    </div>
  );
}

/* ── text editor overlay ─────────────────────────────────────────── */

function SelectionChrome({
  layer,
  aabb,
  factor,
  onHandleDown,
  onEdit,
}: {
  layer: Layer;
  aabb: { x0: number; y0: number; x1: number; y1: number };
  factor: number;
  onHandleDown: (
    e: React.PointerEvent,
    kind: "scale" | "rotate",
    corner?: number
  ) => void;
  onEdit?: () => void;
}) {
  const box = layerContentBox(layer);
  // Draw chrome around the *rotated content box* center-aligned like the art.
  const cx = (aabb.x0 + aabb.x1) / 2;
  const cy = (aabb.y0 + aabb.y1) / 2;
  const w = (aabb.x1 - aabb.x0) * factor;
  const h = (aabb.y1 - aabb.y0) * factor;
  void box;
  const corners: [number, number][] = [
    [aabb.x0, aabb.y0],
    [aabb.x1, aabb.y0],
    [aabb.x1, aabb.y1],
    [aabb.x0, aabb.y1],
  ];
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: cx * factor,
        top: cy * factor,
        width: w,
        height: h,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
      }}
    >
      <div className="absolute inset-0 rounded-[6px] border border-[#e8446a]" />
      {/* rotate handle */}
      <button
        type="button"
        aria-label="Rotate layer"
        onPointerDown={(e) => onHandleDown(e, "rotate")}
        className="pointer-events-auto absolute -top-9 left-1/2 grid h-6 w-6 -translate-x-1/2 cursor-grab place-items-center rounded-full border border-[#e8446a] bg-white text-[#b23354] shadow-sm hover:bg-[#fdf2f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8446a]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>
      {/* scale corners */}
      {corners.map(([x, y], i) => (
        <button
          key={i}
          type="button"
          aria-label={`Resize from corner ${i + 1}`}
          onPointerDown={(e) => onHandleDown(e, "scale", i)}
          className="pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-full border border-[#e8446a] bg-white shadow-sm hover:scale-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8446a]"
          style={{ left: (x - aabb.x0) * factor, top: (y - aabb.y0) * factor }}
        />
      ))}
      {onEdit && (
        <button
          type="button"
          aria-label="Edit text"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="pointer-events-auto absolute -top-9 right-0 grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-[#e8446a] bg-white text-[#b23354] shadow-sm hover:bg-[#fdf2f5]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      )}
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
