"use client";

/**
 * Contextual tool panel — opens beside the tool rail (desktop) or as a bottom
 * sheet (mobile) showing options for the active tool.
 */

import { useState } from "react";
import { Loader2, Scissors, X } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import { isViableTrace, polygonBBox } from "@/lib/paperstring/trace";
import { findCutoutTarget, rasterizeImageCutout } from "@/lib/paperstring/cutout";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { ColorPanel } from "./panels/ColorPanel";
import { TextPanel } from "./panels/TextPanel";
import { ElementsPanel } from "./panels/ElementsPanel";
import { ImageAdjustPanel } from "./panels/ImageAdjustPanel";

export function ToolPanel() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const activeLayer = useEditorStore((s) => {
    const c = s.canvases.find((c) => c.id === s.activeCanvasId);
    const id = c ? s.activeLayerIds[c.id] : undefined;
    return c?.layers.find((l) => l.id === id) ?? null;
  });
  const [dismissed, setDismissed] = useState(false);
  // Re-open whenever a different tool is picked (state adjust during render —
  // the sanctioned pattern, no effect needed).
  const [prevTool, setPrevTool] = useState(tool);
  if (prevTool !== tool) {
    setPrevTool(tool);
    setDismissed(false);
  }

  const baseOpen =
    tool === "brush" ||
    tool === "eraser" ||
    tool === "blur" ||
    tool === "smudge" ||
    tool === "color" ||
    tool === "text" ||
    tool === "select-area" ||
    tool === "image" ||
    tool === "elements" ||
    (tool === "select" &&
      (activeLayer?.type === "text" || activeLayer?.type === "image"));

  if (!baseOpen || dismissed) return null;

  return (
    <aside
      aria-label="Tool options"
      data-tour="panel"
      className={cn(
        "z-20 flex w-full shrink-0 flex-col border-editor-border bg-editor-panel",
        "max-md:fixed inset-x-0 bottom-[4.25rem] z-30 max-h-[56vh] overflow-y-auto rounded-t-2xl border-t pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.2)]",
        "md:h-full md:w-64 md:border-r"
      )}
    >
      {/* mobile close strip */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-editor-border bg-editor-panel px-4 py-2.5 md:hidden">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-editor-dim">
          Options
        </span>
        <button
          type="button"
          aria-label="Close options"
          onClick={() => setDismissed(true)}
          className="grid h-8 w-8 place-items-center rounded-lg text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {tool === "brush" && <BrushPanel eraser={false} />}
        {tool === "eraser" && <BrushPanel eraser />}
        {tool === "blur" && <BlurPanel />}
        {tool === "smudge" && <SmudgePanel />}
        {tool === "color" && <ColorPanel />}
        {tool === "text" && <TextPanel />}
        {(tool === "image" || tool === "elements") && <ElementsPanel />}
        {tool === "select-area" && <SelectionAreaPanel />}
        {tool === "select" && activeLayer?.type === "text" && (
          <TextPanel context="select" />
        )}
        {tool === "select" && activeLayer?.type === "image" && <ImageAdjustPanel />}
      </div>
    </aside>
  );
}

function PanelShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-editor-dim">
          {title}
        </h2>
        {hint && <p className="mt-1 text-xs leading-relaxed text-editor-dim/80">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Stylus discoverability row — a quiet gradient of growing dots that says
 *  “your pencil's pressure is being read” without a wall of text. The chip
 *  brightens while a pen is the active pointer (store.penActive). */
function PressureNote({ verb }: { verb: string }) {
  const penActive = useEditorStore((s) => s.penActive);
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors duration-300",
        penActive
          ? "border-[#155EEF]/40 bg-[#155EEF]/[0.06]"
          : "border-editor-border-strong bg-editor-raised/40"
      )}
      title="Apple Pencil and other pens: press lighter or harder while you draw"
    >
      <span className="flex shrink-0 items-center gap-[3px]" aria-hidden="true">
        {[2.5, 4, 6, 8.5, 11].map((d, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full transition-colors duration-300",
              penActive ? "bg-[#155EEF]/70" : "bg-editor-dim/50"
            )}
            style={{ width: d, height: d }}
          />
        ))}
      </span>
      <span className="text-[10px] leading-tight text-editor-dim">
        Apple Pencil{penActive ? " · live" : ""} — press to {verb}
      </span>
    </div>
  );
}

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-editor-text">{label}</span>
        <span className="tabular-nums text-editor-dim">{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        aria-label={label}
        className={cn(
          "text-editor-dim",
          // iOS-grade light slider: light track, dark fill, white thumb with a
          // subtle border + soft shadow (same as shared.tsx).
          "[&_[data-slot=slider-track]]:bg-[#ececec] [&_[data-slot=slider-track]]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]",
          "[&_[data-slot=slider-range]]:bg-night",
          "[&_[data-slot=slider-thumb]]:size-4.5 [&_[data-slot=slider-thumb]]:border-[#d8d8d8] [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-[0_2px_6px_rgba(0,0,0,0.18)] [&_[data-slot=slider-thumb]]:transition-transform hover:[&_[data-slot=slider-thumb]]:scale-110"
        )}
      />
    </div>
  );
}

function BrushPanel({ eraser }: { eraser: boolean }) {
  const brush = useEditorStore((s) => s.brush);
  const setBrush = useEditorStore((s) => s.setBrush);
  const eraserSize = useEditorStore((s) => s.eraserSize);
  const setEraserSize = useEditorStore((s) => s.setEraserSize);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <PanelShell
      title={eraser ? "Eraser" : "Brush"}
      hint={
        eraser
          ? "Erase only from the active layer — everything underneath stays untouched."
          : "Paint on the active layer. The stroke follows your gesture with a smooth pen feel."
      }
    >
      {eraser ? (
        <>
          <SliderRow
            label="Size"
            value={eraserSize}
            display={`${Math.round(eraserSize)} px`}
            min={2}
            max={220}
            step={1}
            onChange={setEraserSize}
          />
          <PressureNote verb="erase finer or wider" />
        </>
      ) : (
        <>
          <SliderRow
            label="Size"
            value={brush.size}
            display={`${Math.round(brush.size)} px`}
            min={1}
            max={200}
            step={1}
            onChange={(size) => setBrush({ size })}
          />
          <SliderRow
            label="Opacity"
            value={brush.opacity * 100}
            display={`${Math.round(brush.opacity * 100)}%`}
            min={5}
            max={100}
            step={1}
            onChange={(v) => setBrush({ opacity: v / 100 })}
          />

          {/* quick presets — one tap sets a whole brush personality */}
          <div className="flex flex-col gap-2">
            <span className="text-xs text-editor-text">Presets</span>
            <div className="grid grid-cols-2 gap-2">
              {BRUSH_PRESETS.map((p) => {
                const active =
                  Math.round(brush.size) === p.size &&
                  Math.round(brush.opacity * 100) === p.opacity;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={active}
                    title={`${p.label} — ${p.size}px at ${p.opacity}% opacity`}
                    onClick={() => setBrush({ size: p.size, opacity: p.opacity / 100 })}
                    className={cn(
                      "group flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#155EEF]",
                      active
                        ? "border-[#155EEF]/70 bg-[#155EEF]/10 text-editor-text"
                        : "border-editor-border-strong text-editor-dim hover:bg-editor-raised hover:text-editor-text"
                    )}
                  >
                    <span className="grid h-6 w-6 place-items-center" aria-hidden="true">
                      <span
                        className="rounded-full bg-current transition-transform duration-200 group-hover:scale-110"
                        style={{ width: p.dot, height: p.dot }}
                      />
                    </span>
                    <span className="text-[11px] font-medium leading-none">{p.label}</span>
                    <span className="text-[9px] tabular-nums leading-none text-editor-dim/70">
                      {p.size}px · {p.opacity}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTool("color")}
            className="flex items-center justify-between rounded-lg border border-editor-border-strong px-3 py-2.5 text-xs text-editor-text transition hover:bg-editor-raised"
          >
            <span>Color</span>
            <span className="flex items-center gap-2 text-editor-dim">
              <span
                className="h-5 w-5 rounded-full border border-white/20"
                style={{ background: brush.color }}
              />
              {brush.color.toUpperCase()}
            </span>
          </button>

          <PressureNote verb="taper your strokes" />
        </>
      )}
    </PanelShell>
  );
}

/** One-tap brush personalities — size (canvas units) at an opacity %. */
const BRUSH_PRESETS = [
  { id: "fineliner", label: "Fine liner", size: 6, opacity: 100, dot: 4 },
  { id: "marker", label: "Marker", size: 28, opacity: 90, dot: 10 },
  { id: "soft", label: "Soft paint", size: 64, opacity: 55, dot: 16 },
  { id: "wash", label: "Ink wash", size: 120, opacity: 35, dot: 22 },
] as const;

/** Soft-focus nib personalities — size × strength pairs. */
const BLUR_PRESETS = [
  { id: "kiss", label: "Kiss", size: 70, strength: 2, dot: 8 },
  { id: "glow", label: "Glow", size: 130, strength: 4, dot: 14 },
  { id: "mist", label: "Mist", size: 220, strength: 8, dot: 20 },
] as const;

function BlurPanel() {
  const blur = useEditorStore((s) => s.blur);
  const setBlurTool = useEditorStore((s) => s.setBlurTool);

  return (
    <PanelShell
      title="Soft focus"
      hint="Paint over artwork to soften it — dreamy backgrounds, gentle vignettes. Linger to deepen; one undo step brings it back."
    >
      <SliderRow
        label="Nib size"
        value={blur.size}
        display={`${Math.round(blur.size)} px`}
        min={20}
        max={320}
        step={1}
        onChange={(size) => setBlurTool({ size })}
      />
      <SliderRow
        label="Strength"
        value={blur.strength}
        display={blur.strength <= 2 ? "Feather" : blur.strength <= 5 ? "Glow" : "Mist"}
        min={1}
        max={10}
        step={1}
        onChange={(strength) => setBlurTool({ strength })}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs text-editor-text">Presets</span>
        <div className="grid grid-cols-3 gap-2">
          {BLUR_PRESETS.map((p) => {
            const active =
              Math.round(blur.size) === p.size && blur.strength === p.strength;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                title={`${p.label} — ${p.size}px nib, strength ${p.strength}`}
                onClick={() => setBlurTool({ size: p.size, strength: p.strength })}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#155EEF]",
                  active
                    ? "border-[#155EEF]/70 bg-[#155EEF]/10 text-editor-text"
                    : "border-editor-border-strong text-editor-dim hover:bg-editor-raised hover:text-editor-text"
                )}
              >
                <span className="grid h-6 w-6 place-items-center" aria-hidden="true">
                  {/* a soft blurred halo instead of a hard dot */}
                  <span
                    className="rounded-full bg-current blur-[1.5px] transition-transform duration-200 group-hover:scale-110"
                    style={{ width: p.dot, height: p.dot }}
                  />
                </span>
                <span className="text-[11px] font-medium leading-none">{p.label}</span>
                <span className="text-[9px] tabular-nums leading-none text-editor-dim/70">
                  {p.size}px · {p.strength}×
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <PressureNote verb="soften more or less" />
    </PanelShell>
  );
}

/* ── smudge ───────────────────────────────────────────────────────── */

/** Smudge finger personalities — size × strength pairs. */
const SMUDGE_PRESETS = [
  { id: "caress", label: "Caress", size: 60, strength: 3, dot: 10 },
  { id: "blend", label: "Blend", size: 120, strength: 6, dot: 16 },
  { id: "drag", label: "Drag", size: 220, strength: 9, dot: 22 },
] as const;

function SmudgePanel() {
  const smudge = useEditorStore((s) => s.smudge);
  const setSmudgeTool = useEditorStore((s) => s.setSmudgeTool);

  return (
    <PanelShell
      title="Smudge"
      hint="Drag your finger through the artwork and it follows — soften edges, pull color, turn strokes into mist. One undo step brings it all back."
    >
      <SliderRow
        label="Finger size"
        value={smudge.size}
        display={`${Math.round(smudge.size)} px`}
        min={30}
        max={320}
        step={1}
        onChange={(size) => setSmudgeTool({ size })}
      />
      <SliderRow
        label="Drag"
        value={smudge.strength}
        display={
          smudge.strength <= 3 ? "Whisper" : smudge.strength <= 6 ? "Smear" : "Drag"
        }
        min={1}
        max={10}
        step={1}
        onChange={(strength) => setSmudgeTool({ strength })}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs text-editor-text">Presets</span>
        <div className="grid grid-cols-3 gap-2">
          {SMUDGE_PRESETS.map((p) => {
            const active =
              Math.round(smudge.size) === p.size && smudge.strength === p.strength;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                title={`${p.label} — ${p.size}px finger, drag ${p.strength}`}
                onClick={() => setSmudgeTool({ size: p.size, strength: p.strength })}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#155EEF]",
                  active
                    ? "border-[#155EEF]/70 bg-[#155EEF]/10 text-editor-text"
                    : "border-editor-border-strong text-editor-dim hover:bg-editor-raised hover:text-editor-text"
                )}
              >
                <span className="grid h-6 w-9 place-items-center" aria-hidden="true">
                  {/* a smeared streak — the dot trailing off to the right,
                      like a finger dragging through wet ink */}
                  <span
                    className="h-[9px] rounded-full bg-gradient-to-r from-current via-current/60 to-transparent transition-all duration-200 group-hover:[transform:scaleX(1.15)]"
                    style={{ width: p.dot + 8 }}
                  />
                </span>
                <span className="text-[11px] font-medium leading-none">{p.label}</span>
                <span className="text-[9px] tabular-nums leading-none text-editor-dim/70">
                  {p.size}px · {p.strength}×
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <PressureNote verb="smear more or less" />
    </PanelShell>
  );
}

function SelectionAreaPanel() {
  const pendingTrace = useEditorStore((s) => s.pendingTrace);
  const activeCanvasId = useEditorStore((s) => s.activeCanvasId);
  const activeCanvas = useEditorStore((s) =>
    s.canvases.find((c) => c.id === s.activeCanvasId) ?? null
  );
  const activeLayerId = useEditorStore((s) =>
    s.activeCanvasId ? s.activeLayerIds[s.activeCanvasId] : undefined
  );
  const [busy, setBusy] = useState(false);

  const trace =
    pendingTrace && pendingTrace.canvasId === activeCanvasId
      ? pendingTrace
      : null;
  const points = trace?.points ?? null;
  const viable = !!points && isViableTrace(points);
  // Which photo the loop will cut — computed live so the confirm card can
  // name it (and so we can guide the user when no photo is underneath).
  const target =
    viable && activeCanvas
      ? findCutoutTarget(activeCanvas, points!, activeLayerId)
      : null;
  const bounds = points ? polygonBBox(points) : null;
  const hasPhotos = !!activeCanvas?.layers.some((l) => l.type === "image");

  const apply = async () => {
    if (!trace || !points || !target || busy) return;
    setBusy(true);
    try {
      const patch = await rasterizeImageCutout(target, points, target.clipShape);
      if (!patch) {
        toast.error("The loop misses the photo", {
          description: "Trace over the photo itself — only its pixels can be cut.",
        });
        return;
      }
      useEditorStore.getState().patchLayer(trace.canvasId, target.id, {
        ...patch,
        // the crop bakes the adjustments; the mask era ends here
        adjust: undefined,
        clipShape: undefined,
      });
      useEditorStore.setState({ pendingTrace: null });
      useEditorStore.getState().setTool("select");
      toast.success("Photo cut out", {
        description:
          "Its box now hugs the cut edges exactly — move and resize it freely.",
        action: {
          label: "Undo",
          onClick: () => useEditorStore.getState().undo(),
        },
      });
    } catch (err) {
      console.error("[cutout] failed", err);
      toast.error("Could not cut this photo", {
        description: "The photo file may be unreadable — try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Cutout"
      hint="Trace a freehand outline over a photo — release closes the loop and the photo is cropped to exactly what you traced. The box hugs the cut edges, so moving and resizing always move the real pixels."
    >
      {!viable ? (
        <div className="flex flex-col gap-3 rounded-lg border border-editor-border-strong bg-editor-raised/40 p-3.5">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-heart" aria-hidden="true" />
            <span className="text-xs font-medium text-editor-text">
              Freehand photo cutout
            </span>
          </div>
          <ol className="flex flex-col gap-2">
            {[
              "Drag over a photo to trace the shape you want to keep — it follows your finger exactly, any shape you like.",
              "Release — the loop seals itself back to the start point.",
              "Confirm the cut — the photo is cropped to your trace, edges and all.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-px grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-[#155EEF]/12 text-[9px] font-bold text-heart-deep"
                >
                  {i + 1}
                </span>
                <span className="text-[11px] leading-relaxed text-editor-dim">
                  {step}
                </span>
              </li>
            ))}
          </ol>
          {!hasPhotos && (
            <p className="text-[11px] leading-relaxed text-editor-dim/80">
              No photos on this page yet — add one from Elements (image icon)
              first.
            </p>
          )}
        </div>
      ) : target ? (
        <div className="rounded-lg border border-editor-border-strong bg-editor-raised/60 p-3">
          <p className="mb-3 text-xs leading-relaxed text-editor-dim">
            Cut{" "}
            <span className="text-editor-text">{target.name}</span>{" "}
            down to this loop? Only the traced shape survives — the rest of
            the photo is cropped away for good (one undo brings it back).
          </p>
          {bounds && (
            <p className="mb-3 text-[10px] tabular-nums text-editor-dim/70">
              {Math.round(bounds.x1 - bounds.x0)} ×{" "}
              {Math.round(bounds.y1 - bounds.y0)} px area · {points!.length}{" "}
              points traced
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void apply()}
              disabled={busy}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-smoke px-3 py-2 text-xs font-medium text-night transition hover:bg-white disabled:opacity-60"
              )}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Scissors className="h-3.5 w-3.5" />
              )}{" "}
              {busy ? "Cutting…" : "Cutout"}
            </button>
            <button
              type="button"
              onClick={() => useEditorStore.setState({ pendingTrace: null })}
              disabled={busy}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-editor-border-strong px-3 py-2 text-xs text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-editor-border-strong bg-editor-raised/60 p-3">
          <p className="mb-3 text-xs leading-relaxed text-editor-dim">
            No photo under this loop. The cutout crops photos — paint, text and
            stickers stay untouched.
          </p>
          <button
            type="button"
            onClick={() => useEditorStore.setState({ pendingTrace: null })}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-editor-border-strong px-3 py-2 text-xs text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
          >
            <X className="h-3.5 w-3.5" /> Clear the loop
          </button>
        </div>
      )}
    </PanelShell>
  );
}
