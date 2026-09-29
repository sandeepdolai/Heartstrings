"use client";

/**
 * ImageAdjustPanel — non-destructive photo adjustments for the selected image
 * layer: brightness / contrast / saturation applied via ctx.filter at draw
 * time (so editor previews and 4K publishes stay pixel-identical), plus
 * one-tap romantic looks.
 */

import { RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import {
  IMAGE_ADJUST_NEUTRAL,
  type ImageAdjust,
  type ImageLayer,
} from "@/lib/paperstring/types";
import { cn } from "@/lib/utils";
import { GroupLabel, PanelShell, SliderRow, useActiveLayer, useLayerLiveEdit } from "./shared";

/** One-tap looks — every value is a full ImageAdjust. */
const LOOKS: { id: string; label: string; adjust: ImageAdjust }[] = [
  { id: "original", label: "Original", adjust: IMAGE_ADJUST_NEUTRAL },
  { id: "dreamy", label: "Dreamy", adjust: { brightness: 1.08, contrast: 0.9, saturate: 1.12 } },
  { id: "noir", label: "Noir", adjust: { brightness: 0.96, contrast: 1.35, saturate: 0 } },
  { id: "vintage", label: "Vintage", adjust: { brightness: 1.04, contrast: 0.88, saturate: 0.72 } },
  { id: "vivid", label: "Vivid", adjust: { brightness: 1.02, contrast: 1.16, saturate: 1.45 } },
  { id: "golden", label: "Golden hour", adjust: { brightness: 1.1, contrast: 1.05, saturate: 1.2 } },
];

const isNeutral = (a: ImageAdjust) =>
  Math.abs(a.brightness - 1) < 0.005 &&
  Math.abs(a.contrast - 1) < 0.005 &&
  Math.abs(a.saturate - 1) < 0.005;

const looksEqual = (a: ImageAdjust, b: ImageAdjust) =>
  Math.abs(a.brightness - b.brightness) < 0.005 &&
  Math.abs(a.contrast - b.contrast) < 0.005 &&
  Math.abs(a.saturate - b.saturate) < 0.005;

export function ImageAdjustPanel() {
  const layer = useActiveLayer();
  const { beginLive, live, endLive } = useLayerLiveEdit(layer?.id ?? null);

  if (!layer || layer.type !== "image") {
    return (
      <PanelShell title="Photo" hint="Select a photo layer to adjust it.">
        <p className="text-xs text-editor-dim">No photo selected.</p>
      </PanelShell>
    );
  }

  const img = layer as ImageLayer;
  const adjust: ImageAdjust = img.adjust ?? IMAGE_ADJUST_NEUTRAL;

  /** Neutral adjustments persist as undefined — old projects stay byte-clean. */
  const setAdjust = (next: ImageAdjust) => {
    beginLive();
    live({ adjust: isNeutral(next) ? undefined : next });
  };

  const applyLook = (look: ImageAdjust) => {
    useEditorStore.getState().updateLayer(img.id, {
      adjust: isNeutral(look) ? undefined : look,
    });
    toast.success("Photo look applied");
  };

  return (
    <PanelShell
      title="Photo"
      hint="Non-destructive adjustments — the original photo is never overwritten, and published pages bake them in at full 4K quality."
    >
      {/* one-tap looks */}
      <div className="flex flex-col gap-2">
        <GroupLabel>Looks</GroupLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {LOOKS.map((look) => {
            const active = looksEqual(adjust, look.adjust);
            return (
              <button
                key={look.id}
                type="button"
                aria-pressed={active}
                title={`${look.label} look`}
                onClick={() => applyLook(look.adjust)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-1 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#e8446a]",
                  active
                    ? "border-[#e8446a]/70 bg-[#e8446a]/10 text-editor-text"
                    : "border-editor-border-strong text-editor-dim hover:bg-editor-raised hover:text-editor-text"
                )}
              >
                {/* a tiny gradient swatch hinting at each look */}
                <span
                  aria-hidden="true"
                  className="h-6 w-6 rounded-full ring-1 ring-white/10"
                  style={{ background: lookSwatch(look.id) }}
                />
                <span className="text-[10px] font-medium leading-none">{look.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* fine sliders */}
      <div className="flex flex-col gap-3">
        <GroupLabel>Fine-tune</GroupLabel>
        <SliderRow
          label="Brightness"
          value={Math.round(adjust.brightness * 100)}
          display={`${Math.round(adjust.brightness * 100)}%`}
          min={50}
          max={150}
          step={1}
          onChange={(v) => setAdjust({ ...adjust, brightness: v / 100 })}
          onCommit={endLive}
        />
        <SliderRow
          label="Contrast"
          value={Math.round(adjust.contrast * 100)}
          display={`${Math.round(adjust.contrast * 100)}%`}
          min={50}
          max={150}
          step={1}
          onChange={(v) => setAdjust({ ...adjust, contrast: v / 100 })}
          onCommit={endLive}
        />
        <SliderRow
          label="Saturation"
          value={Math.round(adjust.saturate * 100)}
          display={`${Math.round(adjust.saturate * 100)}%`}
          min={0}
          max={200}
          step={1}
          onChange={(v) => setAdjust({ ...adjust, saturate: v / 100 })}
          onCommit={endLive}
        />
      </div>

      <button
        type="button"
        onClick={() => applyLook(IMAGE_ADJUST_NEUTRAL)}
        disabled={isNeutral(adjust)}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-editor-border-strong px-3 py-2 text-xs text-editor-dim transition hover:bg-editor-raised hover:text-editor-text disabled:pointer-events-none disabled:opacity-40"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reset adjustments
      </button>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-editor-dim/80">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        For a soft background behind your text, try the soft-focus tool (F) on a
        paint layer instead.
      </p>
    </PanelShell>
  );
}

/** Small circular swatch gradients hinting at each look. */
function lookSwatch(id: string): string {
  switch (id) {
    case "original":
      return "linear-gradient(135deg, #d9d9d9, #8f8f8f)";
    case "dreamy":
      return "linear-gradient(135deg, #f6d9e4, #e8b7c9)";
    case "noir":
      return "linear-gradient(135deg, #f0f0f0, #1a1a1a)";
    case "vintage":
      return "linear-gradient(135deg, #e8d9bd, #a98f6a)";
    case "vivid":
      return "linear-gradient(135deg, #ff8fa8, #e8446a)";
    case "golden":
      return "linear-gradient(135deg, #ffe3a3, #e2a03d)";
    default:
      return "#d9d9d9";
  }
}
