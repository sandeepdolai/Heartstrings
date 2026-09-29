"use client";

/**
 * Contextual tool panel — opens beside the tool rail (desktop) or as a bottom
 * sheet (mobile) showing options for the active tool.
 */

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useEditorStore } from "@/lib/paperstring/editor-store";
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
        "max-md:fixed inset-x-0 bottom-[4.25rem] z-30 max-h-[56vh] overflow-y-auto rounded-t-2xl border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl",
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
        {tool === "color" && <ColorPanel />}
        {tool === "text" && <TextPanel />}
        {(tool === "image" || tool === "elements") && <ElementsPanel />}
        {tool === "select-area" && <SelectionAreaPanel />}
        {tool === "select" && activeLayer?.type === "text" && <TextPanel />}
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
          // Editor panels are always dark: explicit high-contrast slider
          // colors so the fill level reads at a glance (same as shared.tsx).
          "[&_[data-slot=slider-track]]:bg-editor-raised [&_[data-slot=slider-track]]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]",
          "[&_[data-slot=slider-range]]:bg-[#d4d4d4]",
          "[&_[data-slot=slider-thumb]]:size-4.5 [&_[data-slot=slider-thumb]]:border-[#5a5a5a] [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-[0_2px_6px_rgba(0,0,0,0.5)] [&_[data-slot=slider-thumb]]:transition-transform hover:[&_[data-slot=slider-thumb]]:scale-110"
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
        <SliderRow
          label="Size"
          value={eraserSize}
          display={`${Math.round(eraserSize)} px`}
          min={2}
          max={220}
          step={1}
          onChange={setEraserSize}
        />
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
                      "group flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#e8446a]",
                      active
                        ? "border-[#e8446a]/70 bg-[#e8446a]/10 text-editor-text"
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
                  "group flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#e8446a]",
                  active
                    ? "border-[#e8446a]/70 bg-[#e8446a]/10 text-editor-text"
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
    </PanelShell>
  );
}

function SelectionAreaPanel() {
  const selectionShape = useEditorStore((s) => s.selectionShape);
  const setSelectionShape = useEditorStore((s) => s.setSelectionShape);
  const pendingClip = useEditorStore((s) => s.pendingClip);
  const applyClipShape = useEditorStore((s) => s.applyClipShape);
  const activeCanvasId = useEditorStore((s) => s.activeCanvasId);
  const activeLayer = useEditorStore((s) => {
    const c = s.canvases.find((c) => c.id === s.activeCanvasId);
    const id = c ? s.activeLayerIds[c.id] : undefined;
    return c?.layers.find((l) => l.id === id) ?? null;
  });
  const hasSelection =
    !!pendingClip && pendingClip.canvasId === activeCanvasId && pendingClip.shape.w > 4;

  return (
    <PanelShell
      title="Keep inside"
      hint="Drag an area on the page. Whatever you keep stays inside it; the rest is masked away — reversible from the layer list."
    >
      <div className="grid grid-cols-2 gap-2">
        {(["rect", "ellipse"] as const).map((shape) => (
          <button
            key={shape}
            type="button"
            aria-pressed={selectionShape === shape}
            onClick={() => setSelectionShape(shape)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-xs transition",
              selectionShape === shape
                ? "border-[#e8446a]/70 bg-[#e8446a]/10 text-editor-text"
                : "border-editor-border-strong text-editor-dim hover:bg-editor-raised"
            )}
          >
            {shape === "rect" ? (
              <span className="h-6 w-8 rounded-[4px] border-2 border-current" />
            ) : (
              <span className="h-6 w-9 rounded-[50%] border-2 border-current" />
            )}
            {shape === "rect" ? "Rectangle" : "Ellipse"}
          </button>
        ))}
      </div>

      {hasSelection && (
        <div className="rounded-lg border border-editor-border-strong bg-editor-raised/60 p-3">
          <p className="mb-3 text-xs leading-relaxed text-editor-dim">
            Keep <span className="text-editor-text">{activeLayer?.name ?? "the active layer"}</span>{" "}
            inside this area?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyClipShape(pendingClip!.shape)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-smoke px-3 py-2 text-xs font-medium text-night transition hover:bg-white"
            >
              <Check className="h-3.5 w-3.5" /> Keep inside
            </button>
            <button
              type="button"
              onClick={() => useEditorStore.setState({ pendingClip: null })}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-editor-border-strong px-3 py-2 text-xs text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {!activeLayer && (
        <p className="text-xs text-editor-dim">Select a layer first.</p>
      )}
    </PanelShell>
  );
}
