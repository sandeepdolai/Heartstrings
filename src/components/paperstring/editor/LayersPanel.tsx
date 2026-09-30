"use client";

/**
 * LayersPanel (FR-3) — the layer stack for the active page: select, reorder,
 * hide/show, opacity, clipping, keep-inside masks, duplicate, merge-down and
 * delete; plus the page background quick-picker. Renders as the right rail on
 * desktop and inside a bottom sheet on mobile (FR-3.6).
 */

import { useEffect, useRef, useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowDownToLine,
  Blend,
  Copy,
  Eye,
  EyeOff,
  Layers,
  MoreVertical,
  Plus,
  Trash2,
  Type,
  Image as ImageIcon,
  Paintbrush,
  Sticker,
  Pencil,
  ArrowUp,
  ArrowDown,
  Merge,
  SquareDashedMousePointer,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import type { CanvasPageData, Layer, LayerType, BlendMode } from "@/lib/paperstring/types";
import { CANVAS_H, CANVAS_W } from "@/lib/paperstring/types";
import { renderLayerThumb, renderPageToCanvas, onEngineContentLoaded } from "@/lib/paperstring/render";
import { TEMPLATES } from "@/lib/paperstring/stickers";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { GroupLabel, useLayerLiveEdit } from "./panels/shared";

const TYPE_ICON: Record<LayerType, React.ComponentType<{ className?: string }>> = {
  raster: Paintbrush,
  text: Type,
  image: ImageIcon,
  sticker: Sticker,
};

/* Blend modes, grouped Photoshop-style so the picker reads at a glance. */
const BLEND_GROUPS: { label: string; modes: { value: BlendMode | "normal"; label: string }[] }[] = [
  {
    label: "Basic",
    modes: [{ value: "normal", label: "Normal" }],
  },
  {
    label: "Darken",
    modes: [
      { value: "multiply", label: "Multiply" },
      { value: "darken", label: "Darken" },
      { value: "color-burn", label: "Color burn" },
    ],
  },
  {
    label: "Lighten",
    modes: [
      { value: "screen", label: "Screen" },
      { value: "lighten", label: "Lighten" },
      { value: "color-dodge", label: "Color dodge" },
    ],
  },
  {
    label: "Contrast",
    modes: [
      { value: "overlay", label: "Overlay" },
      { value: "soft-light", label: "Soft light" },
      { value: "hard-light", label: "Hard light" },
    ],
  },
  {
    label: "Compare",
    modes: [
      { value: "difference", label: "Difference" },
      { value: "exclusion", label: "Exclusion" },
    ],
  },
  {
    label: "Color",
    modes: [
      { value: "hue", label: "Hue" },
      { value: "saturation", label: "Saturation" },
      { value: "color", label: "Color" },
      { value: "luminosity", label: "Luminosity" },
    ],
  },
];

const BLEND_LABELS: Record<string, string> = Object.fromEntries(
  BLEND_GROUPS.flatMap((g) => g.modes.map((m) => [m.value, m.label]))
);

export function LayersPanel({ onClose }: { onClose?: () => void }) {
  const canvas = useEditorStore((s) =>
    s.canvases.find((c) => c.id === s.activeCanvasId) ?? null
  );
  const canvases = useEditorStore((s) => s.canvases);
  const activeCanvasId = useEditorStore((s) => s.activeCanvasId);
  const addRasterLayer = useEditorStore((s) => s.addRasterLayer);
  const pageIdx = canvases.findIndex((c) => c.id === activeCanvasId);

  if (!canvas) return null;
  const layersTopFirst = [...canvas.layers].reverse();

  return (
    <aside
      aria-label={`Layers — page ${pageIdx + 1}`}
      data-tour="layers"
      className="flex h-full w-full flex-col border-editor-border bg-editor-panel md:w-60 md:border-l"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-editor-border px-3 py-2.5">
        <Layers className="h-4 w-4 text-editor-dim" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8a8a8a]">
          Layers
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-editor-dim/70">
          Page {pageIdx + 1} / {canvases.length}
        </span>
        <button
          type="button"
          aria-label="Add a paint layer"
          title="Add a paint layer"
          onClick={() => addRasterLayer()}
          className="grid h-7 w-7 place-items-center rounded-lg text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
        >
          <Plus className="h-4 w-4" />
        </button>
        {onClose && (
          <button
            type="button"
            aria-label="Close layers"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-editor-dim transition hover:bg-editor-raised hover:text-editor-text md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* stack */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {layersTopFirst.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            canvas={canvas}
            isBottom={layer.id === canvas.layers[0]?.id}
          />
        ))}
        {canvas.layers.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-editor-dim">
            No layers on this page yet — draw, add text or drop in a photo.
          </p>
        )}
      </div>

      <ActiveLayerControls />
      <BackgroundPicker canvas={canvas} />
    </aside>
  );
}

/* ── one layer row ─────────────────────────────────────────────────── */

function LayerRow({
  layer,
  canvas,
  isBottom,
}: {
  layer: Layer;
  canvas: CanvasPageData;
  isBottom: boolean;
}) {
  const activeLayerId = useEditorStore(
    (s) => (s.activeCanvasId === canvas.id ? s.activeLayerIds[canvas.id] : undefined)
  );
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer);
  const toggleLayerVisible = useEditorStore((s) => s.toggleLayerVisible);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(layer.name);
  const active = activeLayerId === layer.id;
  const Icon = TYPE_ICON[layer.type];
  const idx = canvas.layers.findIndex((l) => l.id === layer.id);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== layer.name)
      useEditorStore.getState().updateLayer(layer.id, { name: next.slice(0, 48) });
    else setDraft(layer.name);
    setRenaming(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={`Layer ${layer.name}${active ? " (active)" : ""}`}
      onClick={() => setActiveLayer(layer.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setActiveLayer(layer.id);
        }
      }}
      className={cn(
        "group mb-1 flex cursor-pointer items-center gap-2 rounded-xl border px-2 py-1.5 transition outline-none",
        active
          ? "border-[#e8446a]/60 bg-[#e8446a]/10"
          : "border-transparent hover:bg-editor-raised focus-visible:bg-editor-raised"
      )}
    >
      <LayerThumb layer={layer} />
      <div className="min-w-0 flex-1">
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraft(layer.name);
                setRenaming(false);
              }
            }}
            maxLength={48}
            aria-label="Layer name"
            className="w-full rounded border border-editor-border-strong bg-editor px-1.5 py-0.5 text-xs text-editor-text outline-none focus:border-heart/70"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <Icon className="h-3 w-3 shrink-0 text-editor-dim" aria-hidden="true" />
            <span
              className={cn(
                "truncate text-xs",
                active ? "font-semibold text-editor-text" : "font-medium text-editor-text/75"
              )}
            >
              {layer.name}
            </span>
            {layer.clipped && (
              <ArrowDownToLine
                className="h-3 w-3 shrink-0 text-heart"
                aria-label="Clipped to the layer below"
              />
            )}
            {layer.clipShape && (
              <SquareDashedMousePointer
                className="h-3 w-3 shrink-0 text-[#f7c948]"
                aria-label="Keep-inside mask"
              />
            )}
            {layer.blendMode && layer.blendMode !== "normal" && (
              <span
                title={`Blend: ${BLEND_LABELS[layer.blendMode]}`}
                className="shrink-0 rounded-sm bg-heart/10 px-1 py-px text-[8.5px] font-semibold uppercase tracking-wider text-heart-deep"
              >
                {BLEND_LABELS[layer.blendMode]}
              </span>
            )}
          </div>
        )}
        <span className="text-[10px] uppercase tracking-wide text-editor-dim/70">
          {layer.type === "raster"
            ? `${layer.strokes.length} stroke${layer.strokes.length === 1 ? "" : "s"}`
            : layer.type === "text"
              ? (layer as { text: string }).text.split("\n")[0].slice(0, 18) || "Text"
              : layer.type}
        </span>
      </div>

      <button
        type="button"
        aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        onClick={(e) => {
          e.stopPropagation();
          toggleLayerVisible(layer.id);
        }}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-editor-dim transition hover:bg-editor hover:text-editor-text"
      >
        {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Layer options for ${layer.name}`}
            onClick={(e) => e.stopPropagation()}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-editor-dim opacity-0 transition hover:bg-editor hover:text-editor-text focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="left"
          className="border-editor-border-strong bg-editor-panel text-editor-text"
        >
          <DropdownMenuItem
            onClick={() => {
              setDraft(layer.name);
              setRenaming(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => useEditorStore.getState().duplicateLayer(layer.id)}>
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={idx === canvas.layers.length - 1}
            onClick={() => useEditorStore.getState().moveLayer(layer.id, "up")}
          >
            <ArrowUp className="h-3.5 w-3.5" /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={idx === 0}
            onClick={() => useEditorStore.getState().moveLayer(layer.id, "down")}
          >
            <ArrowDown className="h-3.5 w-3.5" /> Move down
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => useEditorStore.getState().toggleLayerClipped(layer.id)}>
            <ArrowDownToLine className="h-3.5 w-3.5" />
            {layer.clipped ? "Unclip from below" : "Clip to layer below"}
          </DropdownMenuItem>
          {!isBottom && (
            <DropdownMenuItem onClick={() => void mergeDownLayer(canvas, layer)}>
              <Merge className="h-3.5 w-3.5" /> Merge down
            </DropdownMenuItem>
          )}
          {layer.clipShape && (
            <DropdownMenuItem onClick={() => useEditorStore.getState().clearClipShape(layer.id)}>
              <SquareDashedMousePointer className="h-3.5 w-3.5" /> Remove keep-inside
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-editor-border" />
          <DropdownMenuItem
            className="text-[#c73a56] focus:text-[#b2334c]"
            onClick={() => {
              useEditorStore.getState().deleteLayer(layer.id);
              toast.success("Layer deleted — undo still works");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete layer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Flatten the pair below+above (clipping respected) into one raster layer. */
async function mergeDownLayer(canvas: CanvasPageData, above: Layer) {
  const idx = canvas.layers.findIndex((l) => l.id === above.id);
  if (idx <= 0) return;
  const below = canvas.layers[idx - 1];
  try {
    const page = {
      id: "merge",
      background: "rgba(0,0,0,0)",
      layers: [below, above],
    };
    // renderPageToCanvas pre-loads every font/image/sticker asset, then
    // composites the pair exactly as it appears on the page.
    const bitmap = await renderPageToCanvas(page, 1, { fonts: true });
    const flattened = bitmap.toDataURL("image/png");
    useEditorStore.getState().mergeDown(above.id, flattened);
    toast.success("Merged into the layer below");
  } catch (err) {
    console.error("[merge]", err);
    toast.error("Could not merge these layers", {
      description: "Nothing was changed — try again in a moment.",
    });
  }
}

/* ── thumbnail ─────────────────────────────────────────────────────── */

function LayerThumb({ layer }: { layer: Layer }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const paint = () => {
      if (alive) renderLayerThumb(layer, el, 44);
    };
    paint();
    // re-paint when async engine assets (fonts/images/stickers) load
    const unsub = onEngineContentLoaded(paint);
    return () => {
      alive = false;
      unsub();
    };
  }, [layer]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="h-10 w-10 shrink-0 rounded-md bg-white ring-1 ring-black/15"
    />
  );
}

/* ── active-layer controls ─────────────────────────────────────────── */

function ActiveLayerControls() {
  const layer = useEditorStore((s) => {
    const c = s.canvases.find((c) => c.id === s.activeCanvasId);
    const id = c ? s.activeLayerIds[c.id] : undefined;
    return c?.layers.find((l) => l.id === id) ?? null;
  });
  const { beginLive, live, endLive } = useLayerLiveEdit(layer?.id ?? null);

  if (!layer) {
    return (
      <div className="border-t border-editor-border px-4 py-3">
        <p className="text-[11px] leading-relaxed text-editor-dim/80">
          Tap a layer to select it — then restyle, reorder or merge it here.
        </p>
      </div>
    );
  }

  const setOpacity = (v: number) => {
    beginLive();
    live({ opacity: v / 100 });
  };

  return (
    <div className="flex shrink-0 flex-col gap-2.5 border-t border-editor-border px-4 py-3">
      <div className="flex items-center justify-between">
        <GroupLabel>{layer.name}</GroupLabel>
        <span className="text-[10px] uppercase tracking-widest text-editor-dim/70">
          {layer.type}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-editor-text">Opacity</span>
          <span className="tabular-nums text-editor-dim">
            {Math.round(layer.opacity * 100)}%
          </span>
        </div>
        <Slider
          value={[Math.round(layer.opacity * 100)]}
          min={5}
          max={100}
          step={1}
          onValueChange={(v) => setOpacity(v[0])}
          onValueCommit={endLive}
          aria-label="Layer opacity"
          className={cn(
            "text-editor-dim",
            "[&_[data-slot=slider-track]]:bg-[#ececec] [&_[data-slot=slider-track]]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]",
            "[&_[data-slot=slider-range]]:bg-night",
            "[&_[data-slot=slider-thumb]]:size-4.5 [&_[data-slot=slider-thumb]]:border-[#d8d8d8] [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
          )}
        />
      </div>
      <div className="flex items-center gap-2">
        <Blend
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-editor-dim"
        />
        <Select
          value={layer.blendMode ?? "normal"}
          onValueChange={(v) =>
            useEditorStore.getState().updateLayer(layer.id, {
              // "normal" persists as undefined — old projects stay byte-clean
              blendMode: v === "normal" ? undefined : (v as BlendMode),
            })
          }
        >
          <SelectTrigger
            aria-label={`Blend mode for ${layer.name}`}
            size="sm"
            className={cn(
              "h-7 flex-1 rounded-lg border-editor-border-strong bg-transparent px-2.5 text-[11px] text-editor-text shadow-none transition hover:bg-editor-raised hover:text-editor-text focus-visible:ring-[#e8446a]/50",
              layer.blendMode && layer.blendMode !== "normal"
                ? "border-[#e8446a]/50 text-[#c73a56]"
                : "text-editor-dim"
            )}
          >
            {layer.blendMode && layer.blendMode !== "normal"
              ? BLEND_LABELS[layer.blendMode]
              : "Blend · Normal"}
          </SelectTrigger>
          <SelectContent className="border-editor-border bg-editor-panel text-editor-text shadow-xl shadow-black/40">
            {BLEND_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-editor-dim/70">
                  {group.label}
                </SelectLabel>
                {group.modes.map((m) => (
                  <SelectItem
                    key={m.value}
                    value={m.value}
                    className="text-xs text-editor-text/90 focus:bg-editor-raised focus:text-editor-text aria-selected:bg-[#e8446a]/15 aria-selected:text-editor-text"
                  >
                    {m.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-label="Center this layer horizontally on the page"
          title="Center on page · horizontal"
          onClick={() =>
            useEditorStore.getState().updateLayer(layer.id, { x: CANVAS_W / 2 })
          }
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-editor-border-strong px-2 py-1.5 text-[11px] text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
        >
          <AlignCenterVertical className="h-3.5 w-3.5" /> Center H
        </button>
        <button
          type="button"
          aria-label="Center this layer vertically on the page"
          title="Center on page · vertical"
          onClick={() =>
            useEditorStore.getState().updateLayer(layer.id, { y: CANVAS_H / 2 })
          }
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-editor-border-strong px-2 py-1.5 text-[11px] text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
        >
          <AlignCenterHorizontal className="h-3.5 w-3.5" /> Center V
        </button>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-pressed={layer.clipped}
          onClick={() => useEditorStore.getState().toggleLayerClipped(layer.id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] transition",
            layer.clipped
              ? "border-[#e8446a]/70 bg-[#e8446a]/15 text-editor-text"
              : "border-editor-border-strong text-editor-dim hover:bg-editor-raised hover:text-editor-text"
          )}
        >
          <ArrowDownToLine className="h-3.5 w-3.5" /> Clip
        </button>
        {layer.clipShape ? (
          <button
            type="button"
            onClick={() => useEditorStore.getState().clearClipShape(layer.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#f7c948]/60 bg-[#f7c948]/10 px-2 py-1.5 text-[11px] text-editor-text transition hover:bg-[#f7c948]/20"
          >
            <SquareDashedMousePointer className="h-3.5 w-3.5" /> Unmask
          </button>
        ) : (
          <button
            type="button"
            onClick={() => useEditorStore.getState().setTool("select-area")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-editor-border-strong px-2 py-1.5 text-[11px] text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
          >
            <SquareDashedMousePointer className="h-3.5 w-3.5" /> Keep inside
          </button>
        )}
      </div>
    </div>
  );
}

/* ── page background picker ────────────────────────────────────────── */

const QUICK_BACKGROUNDS = TEMPLATES.filter((t) =>
  [
    "t-plain-white",
    "t-plain-cream",
    "t-plain-blush",
    "t-plain-mist",
    "t-grad-sunset",
    "t-grad-blossom",
    "t-grad-mint",
    "t-grad-night",
  ].includes(t.id)
);

function BackgroundPicker({ canvas }: { canvas: CanvasPageData }) {
  const setBackground = useEditorStore((s) => s.setBackground);
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-editor-border px-4 py-3">
      <GroupLabel>Page background</GroupLabel>
      <div className="grid grid-cols-8 gap-1.5">
        {QUICK_BACKGROUNDS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-label={`Set background ${t.label}`}
            title={t.label}
            onClick={() => setBackground(canvas.id, t.background)}
            className={cn(
              "aspect-square rounded-md ring-1 ring-white/15 transition hover:scale-110",
              canvas.background === t.background &&
                "outline outline-2 outline-offset-1 outline-[#e8446a]"
            )}
            style={{ background: t.background }}
          />
        ))}
      </div>
    </div>
  );
}
