"use client";

/**
 * ColorPanel (FR-6) — full color tools for the brush: curated palette, HSV
 * sliders, RGB sliders, hex entry, recent colors and the eyedropper.
 * Selection changes TOOL STATE only — never existing layers (FR-2.7).
 */

import { useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Pipette } from "lucide-react";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import {
  hexToRgb,
  hexToHsv,
  hsvToHex,
  rgbToHex,
  type Hsv,
} from "@/lib/paperstring/color";
import { PALETTE } from "@/lib/paperstring/color";
import { cn } from "@/lib/utils";
import { GroupLabel, PanelShell } from "./shared";

const isValidHex = (s: string) => /^#?[0-9a-fA-F]{6}$/.test(s.trim());

export function ColorPanel() {
  const brush = useEditorStore((s) => s.brush);
  const colorHistory = useEditorStore((s) => s.colorHistory);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(brush.color));
  const [hexDraft, setHexDraft] = useState(brush.color.toUpperCase());
  const [rgbMode, setRgbMode] = useState(false);

  // Keep in sync when the color changes elsewhere (eyedropper on canvas) —
  // render-phase adjust; slider drags mark themselves via selfApplied so the
  // HSV values never jitter mid-gesture from hex rounding.
  const [selfApplied, setSelfApplied] = useState(brush.color);
  const [prevColor, setPrevColor] = useState(brush.color);
  if (brush.color !== prevColor) {
    setPrevColor(brush.color);
    if (selfApplied !== brush.color) {
      setHsv(hexToHsv(brush.color));
    }
    setHexDraft(brush.color.toUpperCase());
  }

  const apply = (hex: string, { remember = true }: { remember?: boolean } = {}) => {
    const { setBrush, pushColorHistory, setTextDefaults } =
      useEditorStore.getState();
    setSelfApplied(hex);
    setBrush({ color: hex });
    setTextDefaults({ color: hex });
    if (remember) pushColorHistory(hex);
    setHexDraft(hex.toUpperCase());
  };

  const onHsv = (patch: Partial<Hsv>) => {
    const next = { ...hsv, ...patch };
    const hex = hsvToHex(next);
    setSelfApplied(hex);
    setHsv(next);
    useEditorStore.getState().setBrush({ color: hex });
    setHexDraft(hex.toUpperCase());
  };

  const rgb = hexToRgb(brush.color);
  const onRgb = (part: "r" | "g" | "b", v: number) => {
    const next = { ...rgb, [part]: v };
    apply(rgbToHex(next), { remember: false });
  };

  return (
    <PanelShell
      title="Color"
      hint="Choose a color for your brush and new text — layers themselves are never recolored here."
    >
      {/* current + hex + eyedropper */}
      <div className="flex items-center gap-2.5">
        <label className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/20" title="Current brush color">
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: brush.color }}
          />
          <input
            type="color"
            value={brush.color}
            onChange={(e) => apply(e.target.value, { remember: false })}
            onBlur={(e) => apply(e.target.value)}
            aria-label="Pick a color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-editor-dim">
            #
          </span>
          <input
            value={hexDraft.replace(/^#/, "")}
            onChange={(e) => setHexDraft(e.target.value)}
            onBlur={() => {
              const d = hexDraft.trim();
              if (isValidHex(d)) apply(d.startsWith("#") ? d : `#${d}`);
              else setHexDraft(brush.color.toUpperCase());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            maxLength={7}
            spellCheck={false}
            aria-label="Hex color value"
            className="h-10 w-full rounded-xl border border-editor-border-strong bg-editor px-6 py-2 font-mono text-xs uppercase text-editor-text outline-none transition focus:border-[#e8446a]/70"
          />
        </div>
        <button
          type="button"
          onClick={() => useEditorStore.getState().setTool("eyedropper")}
          aria-label="Eyedropper — pick a color from the page"
          title="Pick from page"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-editor-border-strong text-editor-text transition hover:bg-editor-raised"
        >
          <Pipette className="h-4 w-4" />
        </button>
      </div>

      {/* mode toggle */}
      <div className="flex rounded-lg border border-editor-border-strong p-0.5" role="tablist" aria-label="Slider mode">
        {(["HSV", "RGB"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={(m === "HSV") !== rgbMode}
            onClick={() => setRgbMode(m === "RGB")}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold tracking-wide transition",
              (m === "HSV") !== rgbMode
                ? "bg-editor-raised text-editor-text"
                : "text-editor-dim hover:text-editor-text"
            )}
          >
            {m === "HSV" ? "HSV" : "RGB"}
          </button>
        ))}
      </div>

      {!rgbMode ? (
        <div className="flex flex-col gap-3.5">
          <GradientSlider
            label="Hue"
            display={`${Math.round(hsv.h)}°`}
            value={hsv.h}
            min={0}
            max={360}
            onChange={(h) => onHsv({ h })}
            onCommit={() => apply(brush.color)}
            track="linear-gradient(90deg,#f00,#ff0 16.6%,#0f0 33.3%,#0ff 50%,#00f 66.6%,#f0f 83.3%,#f00)"
          />
          <GradientSlider
            label="Saturation"
            display={`${hsv.s}%`}
            value={hsv.s}
            min={0}
            max={100}
            onChange={(s) => onHsv({ s })}
            onCommit={() => apply(brush.color)}
            track={`linear-gradient(90deg, hsl(${hsv.h} 0% ${hsv.v}%), hsl(${hsv.h} 100% ${hsv.v}%))`}
          />
          <GradientSlider
            label="Brightness"
            display={`${hsv.v}%`}
            value={hsv.v}
            min={0}
            max={100}
            onChange={(v) => onHsv({ v })}
            onCommit={() => apply(brush.color)}
            track={`linear-gradient(90deg, #000, hsl(${hsv.h} ${hsv.s}% 100%))`}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <GradientSlider
            label="Red"
            display={`${rgb.r}`}
            value={rgb.r}
            min={0}
            max={255}
            onChange={(v) => onRgb("r", v)}
            onCommit={() => apply(brush.color)}
            track={`linear-gradient(90deg, rgb(0 ${rgb.g} ${rgb.b}), rgb(255 ${rgb.g} ${rgb.b}))`}
          />
          <GradientSlider
            label="Green"
            display={`${rgb.g}`}
            value={rgb.g}
            min={0}
            max={255}
            onChange={(v) => onRgb("g", v)}
            onCommit={() => apply(brush.color)}
            track={`linear-gradient(90deg, rgb(${rgb.r} 0 ${rgb.b}), rgb(${rgb.r} 255 ${rgb.b}))`}
          />
          <GradientSlider
            label="Blue"
            display={`${rgb.b}`}
            value={rgb.b}
            min={0}
            max={255}
            onChange={(v) => onRgb("b", v)}
            onCommit={() => apply(brush.color)}
            track={`linear-gradient(90deg, rgb(${rgb.r} ${rgb.g} 0), rgb(${rgb.r} ${rgb.g} 255))`}
          />
        </div>
      )}

      {/* curated palette */}
      <div className="flex flex-col gap-2">
        <GroupLabel>PaperString palette</GroupLabel>
        <div className="grid grid-cols-9 gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Use ${c}`}
              title={c.toUpperCase()}
              onClick={() => apply(c)}
              className={cn(
                "aspect-square rounded-md ring-1 ring-white/15 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8446a]",
                brush.color.toLowerCase() === c.toLowerCase() &&
                  "outline outline-2 outline-offset-1 outline-[#e8446a]"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* recent colors */}
      {colorHistory.length > 0 && (
        <div className="flex flex-col gap-2">
          <GroupLabel>Recent</GroupLabel>
          <div className="flex flex-wrap gap-1.5">
            {colorHistory.slice(0, 12).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Reuse ${c}`}
                title={c.toUpperCase()}
                onClick={() => apply(c, { remember: false })}
                className="h-6 w-6 rounded-md ring-1 ring-white/15 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8446a]"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  );
}

/** A Radix slider whose track IS a color gradient (no filled range). */
function GradientSlider({
  label,
  display,
  value,
  min,
  max,
  onChange,
  onCommit,
  track,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onCommit: () => void;
  track: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-editor-text">{label}</span>
        <span className="tabular-nums text-editor-dim">{display}</span>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(v) => onChange(v[0])}
        onValueCommit={() => onCommit()}
        aria-label={label}
        className="relative flex h-5 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track
          className="relative h-2.5 w-full grow overflow-hidden rounded-full ring-1 ring-white/15"
          style={{ background: track }}
        />
        <SliderPrimitive.Thumb className="block h-4.5 w-4.5 cursor-grab rounded-full border-2 border-white bg-transparent shadow-[0_1px_4px_rgba(0,0,0,0.5)] transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/90 active:cursor-grabbing" />
      </SliderPrimitive.Root>
    </div>
  );
}
