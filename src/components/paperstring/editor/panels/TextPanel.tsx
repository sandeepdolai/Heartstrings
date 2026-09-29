"use client";

/**
 * TextPanel (FR-4) — the advanced text tool options.
 *
 * Two modes:
 *  • a text layer is active (or the select tool holds one) → every control
 *    edits THAT layer live, with one undo entry per gesture;
 *  • otherwise the controls set the defaults for the next inserted text.
 *
 * Includes the PaperString font collection (FR-4.3), custom-font import
 * (FR-4.4) and per-layer styling (FR-4.5).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import type { TextLayer } from "@/lib/paperstring/types";
import { CANVAS_W, CANVAS_H } from "@/lib/paperstring/types";
import {
  CREATIVE_FONTS,
  ensureCreativeFonts,
  type FontDef,
} from "@/lib/paperstring/fonts";
import { PALETTE } from "@/lib/paperstring/color";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  GroupLabel,
  PanelShell,
  SliderRow,
  useActiveLayer,
  useLayerLiveEdit,
} from "./shared";
import { importFontFile, registerFontFace, useEditorFonts } from "../fonts-context";

type Align = TextLayer["align"];

/** One-tap styled text — romantic starters from the PaperString font
 *  library. In insert mode a tap drops ready-styled text on the page and
 *  opens the editor; with a text layer selected it restyles that layer. */
const TEXT_PRESETS: {
  label: string;
  preview: string;
  props: Partial<TextProps>;
  style: React.CSSProperties;
}[] = [
  {
    label: "Love script",
    preview: "Love",
    props: { fontFamily: "'Great Vibes'", fontSize: 190, color: "#e8446a", italic: false, bold: false, letterSpacing: 0 },
    style: { fontFamily: "'Great Vibes'", color: "#e8446a" },
  },
  {
    label: "Bold heart",
    preview: "Always",
    props: { fontFamily: "'Abril Fatface'", fontSize: 130, color: "#131313", italic: false, bold: false, letterSpacing: 0 },
    style: { fontFamily: "'Abril Fatface'", color: "#f3f3f3" },
  },
  {
    label: "Notebook",
    preview: "my notes",
    props: { fontFamily: "Caveat", fontSize: 130, color: "#646464", italic: false, bold: false, letterSpacing: 0 },
    style: { fontFamily: "Caveat", color: "#b5b5b5" },
  },
  {
    label: "Elegant",
    preview: "Yours",
    props: { fontFamily: "'Playfair Display'", fontSize: 110, color: "#3c3c3c", italic: true, bold: false, letterSpacing: 2 },
    style: { fontFamily: "'Playfair Display'", fontStyle: "italic", color: "#f3f3f3" },
  },
  {
    label: "Poster",
    preview: "MINE",
    props: { fontFamily: "'Bebas Neue'", fontSize: 150, color: "#f7c948", italic: false, bold: false, letterSpacing: 8 },
    style: { fontFamily: "'Bebas Neue'", color: "#f7c948" },
  },
  {
    label: "Whisper",
    preview: "xoxo",
    props: { fontFamily: "Sacramento", fontSize: 170, color: "#f06e8c", italic: false, bold: false, letterSpacing: 0 },
    style: { fontFamily: "Sacramento", color: "#f06e8c" },
  },
];

/** Arc-bend presets — small inline SVG arcs so the shape reads at a glance. */
const CURVE_PRESETS = [
  {
    label: "Arch",
    aria: "arch the text upward",
    title: "Arch — badge-style, ends rising",
    value: 60,
    path: "M3 10 C 10 2, 22 2, 29 10",
  },
  {
    label: "Flat",
    aria: "straight text",
    title: "Flat — no curve",
    value: 0,
    path: "M3 6 H 29",
  },
  {
    label: "Smile",
    aria: "curve the text downward",
    title: "Smile — ribbon-style, ends dipping",
    value: -60,
    path: "M3 2 C 10 10, 22 10, 29 2",
  },
] as const;

/** Everything a text layer and the next-insert defaults share. */
type TextProps = Pick<
  TextLayer,
  | "fontFamily"
  | "fontSize"
  | "color"
  | "align"
  | "bold"
  | "italic"
  | "underline"
  | "letterSpacing"
  | "lineHeight"
  | "curve"
>;

export function TextPanel() {
  const layer = useActiveLayer();
  const target: TextLayer | null = layer?.type === "text" ? (layer as TextLayer) : null;
  const defaults = useEditorStore((s) => s.textDefaults);
  const editingTextLayerId = useEditorStore((s) => s.editingTextLayerId);
  const { beginLive, live, endLive } = useLayerLiveEdit(target?.id ?? null);

  /** Apply a patch to the active text layer (or the insert defaults). */
  const apply = (patch: Partial<TextProps>, { live: isLive = false } = {}) => {
    if (target) {
      if (isLive) live(patch);
      else useEditorStore.getState().updateLayer(target.id, patch);
    } else {
      useEditorStore.getState().setTextDefaults(patch);
    }
  };

  const values: TextProps = target
    ? {
        fontFamily: target.fontFamily,
        fontSize: target.fontSize,
        color: target.color,
        align: target.align,
        bold: target.bold,
        italic: target.italic,
        underline: target.underline,
        letterSpacing: target.letterSpacing,
        lineHeight: target.lineHeight,
        curve: target.curve ?? 0,
      }
    : defaults;

  return (
    <PanelShell
      title="Text"
      hint={
        target
          ? editingTextLayerId === target.id
            ? "Type on the page to rewrite this text."
            : "Styling the selected text layer. Double-tap text on the page to rewrite it."
          : "These settings apply to the next text you add — tap the page with the text tool."
      }
    >
      {/* one-tap styled starters */}
      <div className="flex flex-col gap-2">
        <GroupLabel>{target ? "Restyle with a preset" : "Start from a style"}</GroupLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {TEXT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-label={`${target ? "Restyle with" : "Add"} ${p.label} text style`}
              title={target ? `Restyle: ${p.label}` : `Add ${p.label} text to the page`}
              onClick={() => {
                if (target) {
                  useEditorStore.getState().updateLayer(target.id, p.props);
                  toast.success(`Restyled with ${p.label.toLowerCase()}`);
                } else {
                  // style the insert defaults, then drop ready text at page center
                  useEditorStore.getState().setTextDefaults(p.props);
                  useEditorStore.getState().addTextLayer(CANVAS_W / 2, CANVAS_H / 2);
                }
              }}
              className="group flex h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border border-editor-border-strong bg-editor px-1 py-1 transition hover:-translate-y-0.5 hover:border-[#e8446a]/50 hover:bg-editor-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e8446a]"
            >
              <span
                aria-hidden="true"
                className="max-w-full truncate text-lg leading-none"
                style={p.style}
              >
                {p.preview}
              </span>
              <span className="text-[8.5px] uppercase tracking-[0.14em] text-editor-dim/70 group-hover:text-editor-dim">
                {p.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <FontPicker
        value={values.fontFamily}
        onChange={(cssFamily) => apply({ fontFamily: cssFamily })}
      />

      <SliderRow
        label="Size"
        value={values.fontSize}
        display={`${Math.round(values.fontSize)} px`}
        min={24}
        max={420}
        step={2}
        onChange={(v) => {
          if (target) {
            beginLive();
            apply({ fontSize: v }, { live: true });
          } else apply({ fontSize: v });
        }}
        onCommit={endLive}
      />

      {/* style toggles */}
      <div className="flex gap-1.5" role="group" aria-label="Text style">
        <StyleToggle
          label="Bold"
          active={values.bold}
          onClick={() => apply({ bold: !values.bold })}
        >
          <Bold className="h-4 w-4" />
        </StyleToggle>
        <StyleToggle
          label="Italic"
          active={values.italic}
          onClick={() => apply({ italic: !values.italic })}
        >
          <Italic className="h-4 w-4" />
        </StyleToggle>
        <StyleToggle
          label="Underline"
          active={values.underline}
          onClick={() => apply({ underline: !values.underline })}
        >
          <Underline className="h-4 w-4" />
        </StyleToggle>
        <div className="mx-0.5 w-px bg-editor-border-strong" aria-hidden="true" />
        {(["left", "center", "right"] as Align[]).map((a) => (
          <StyleToggle
            key={a}
            label={`Align ${a}`}
            active={values.align === a}
            onClick={() => apply({ align: a })}
          >
            {a === "left" ? (
              <AlignLeft className="h-4 w-4" />
            ) : a === "center" ? (
              <AlignCenter className="h-4 w-4" />
            ) : (
              <AlignRight className="h-4 w-4" />
            )}
          </StyleToggle>
        ))}
      </div>

      <SliderRow
        label="Letter spacing"
        value={values.letterSpacing}
        display={`${values.letterSpacing > 0 ? "+" : ""}${Math.round(values.letterSpacing)}`}
        min={-20}
        max={80}
        step={1}
        onChange={(v) => {
          if (target) {
            beginLive();
            apply({ letterSpacing: v }, { live: true });
          } else apply({ letterSpacing: v });
        }}
        onCommit={endLive}
      />

      {/* arc bend — text-on-path, the badge/ribbon flourish */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-editor-text">Curve</span>
          <span className="tabular-nums text-editor-dim">
            {(values.curve ?? 0) === 0
              ? "Flat"
              : `${(values.curve ?? 0) > 0 ? "Arch" : "Smile"} ${Math.abs(Math.round(values.curve ?? 0))}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {CURVE_PRESETS.map((p) => {
            const active = Math.round(values.curve ?? 0) === p.value;
            return (
              <button
                key={p.label}
                type="button"
                aria-label={`Curve: ${p.aria}`}
                aria-pressed={active}
                title={`${p.title}`}
                onClick={() => apply({ curve: p.value })}
                className={cn(
                  "group flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#e8446a]",
                  active
                    ? "border-[#e8446a]/70 bg-[#e8446a]/10 text-editor-text"
                    : "border-editor-border-strong text-editor-dim hover:bg-editor-raised hover:text-editor-text"
                )}
              >
                <svg
                  viewBox="0 0 32 12"
                  aria-hidden="true"
                  className="h-3.5 w-8 shrink-0"
                  fill="none"
                >
                  <path
                    d={p.path}
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[10px] font-medium leading-none">{p.label}</span>
              </button>
            );
          })}
        </div>
        <Slider
          value={[Math.round(values.curve ?? 0)]}
          min={-100}
          max={100}
          step={5}
          onValueChange={(v) => {
            if (target) {
              beginLive();
              apply({ curve: v[0] }, { live: true });
            } else apply({ curve: v[0] });
          }}
          onValueCommit={() => target && endLive()}
          aria-label="Curve amount"
          className={cn(
            "text-editor-dim",
            "[&_[data-slot=slider-track]]:bg-editor-raised [&_[data-slot=slider-track]]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]",
            "[&_[data-slot=slider-range]]:bg-[#d4d4d4]",
            "[&_[data-slot=slider-thumb]]:size-4.5 [&_[data-slot=slider-thumb]]:border-[#5a5a5a] [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-[0_2px_6px_rgba(0,0,0,0.5)] [&_[data-slot=slider-thumb]]:transition-transform hover:[&_[data-slot=slider-thumb]]:scale-110"
          )}
        />
      </div>
      <SliderRow
        label="Line height"
        value={values.lineHeight}
        display={`${values.lineHeight.toFixed(2)}×`}
        min={0.9}
        max={2.6}
        step={0.05}
        onChange={(v) => {
          if (target) {
            beginLive();
            apply({ lineHeight: v }, { live: true });
          } else apply({ lineHeight: v });
        }}
        onCommit={endLive}
      />

      {/* text color */}
      <div className="flex flex-col gap-2">
        <GroupLabel>{target ? "Text color" : "Color for new text"}</GroupLabel>
        <div className="flex items-center gap-2">
          <label
            className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/20"
            title="Text color"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{ background: values.color }}
            />
            <input
              type="color"
              value={values.color}
              onChange={(e) => apply({ color: e.target.value })}
              aria-label="Pick the text color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <div className="grid flex-1 grid-cols-9 gap-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Text color ${c}`}
                title={c.toUpperCase()}
                onClick={() => apply({ color: c })}
                className={cn(
                  "aspect-square rounded ring-1 ring-white/15 transition hover:scale-110",
                  values.color.toLowerCase() === c.toLowerCase() &&
                    "outline outline-2 outline-offset-1 outline-[#e8446a]"
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

function StyleToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg border transition",
        active
          ? "border-[#e8446a]/70 bg-[#e8446a]/15 text-editor-text"
          : "border-editor-border-strong text-editor-dim hover:bg-editor-raised hover:text-editor-text"
      )}
    >
      {children}
    </button>
  );
}

/* ── font picker ───────────────────────────────────────────────────── */

function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (cssFamily: string) => void;
}) {
  const { fonts: customFonts, addFont } = useEditorFonts();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    ensureCreativeFonts();
  }, []);

  const customDefs: FontDef[] = useMemo(
    () =>
      customFonts.map((f) => ({
        id: f.id,
        label: f.label,
        cssFamily: f.family,
        category: "Your fonts" as FontDef["category"],
      })),
    [customFonts]
  );

  const groups = useMemo(() => {
    const map = new Map<string, FontDef[]>();
    for (const f of CREATIVE_FONTS) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return [...map.entries()];
  }, []);

  const current =
    [...CREATIVE_FONTS, ...customDefs].find((f) => f.cssFamily === value) ?? null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const font = await importFontFile(file);
      await registerFontFace(font);
      addFont(font);
      toast.success(`“${font.label}” added to your fonts`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not import that font",
        { description: "Your pages and layers are untouched." }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <GroupLabel>Font</GroupLabel>
      <input
        ref={fileRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="h-9 w-full justify-between gap-2 rounded-lg border-editor-border-strong bg-transparent px-3 text-xs text-editor-text hover:bg-editor-raised hover:text-editor-text"
      >
        <span className="flex items-center gap-2">
          <Upload className="h-3.5 w-3.5" /> {busy ? "Importing…" : "Import a font"}
        </span>
        <span className="text-[10px] text-editor-dim">TTF · OTF</span>
      </Button>

      {/* current font + browser */}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-editor-border-strong bg-editor px-3 py-2.5">
        <span
          className="truncate text-base text-editor-text"
          style={{ fontFamily: current?.cssFamily ?? value }}
        >
          {current?.label ?? "Current font"}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
        >
          {expanded ? "Close" : "Browse"}
        </button>
      </div>

      {expanded && (
        <div className="max-h-80 overflow-y-auto rounded-lg border border-editor-border p-1.5">
          {customDefs.length > 0 && (
            <FontGroup
              title="Your fonts"
              fonts={customDefs}
              value={value}
              onChange={onChange}
            />
          )}
          {groups.map(([category, fonts]) => (
            <FontGroup
              key={category}
              title={category}
              fonts={fonts}
              value={value}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FontGroup({
  title,
  fonts,
  value,
  onChange,
}: {
  title: string;
  fonts: FontDef[];
  value: string;
  onChange: (cssFamily: string) => void;
}) {
  return (
    <div className="mb-1.5 last:mb-0">
      <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-editor-dim/70">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-1">
        {fonts.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.cssFamily)}
            aria-pressed={value === f.cssFamily}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 rounded-md px-1.5 py-1 text-center transition",
              value === f.cssFamily
                ? "bg-[#e8446a]/15 ring-1 ring-[#e8446a]/70"
                : "hover:bg-editor-raised"
            )}
          >
            <span
              className="w-full truncate text-xs text-editor-text"
              style={{ fontFamily: f.cssFamily }}
            >
              {f.label}
            </span>
            <span
              className="text-lg leading-none text-editor-dim"
              style={{ fontFamily: f.cssFamily }}
              aria-hidden="true"
            >
              Aa
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
