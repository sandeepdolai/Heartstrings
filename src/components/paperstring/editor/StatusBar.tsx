"use client";

/**
 * StatusBar — the editor's bottom information rail (desktop). A professional
 * application signature: document position on the left, the active tool in
 * the centre, save state and studio mark on the right. Desktop only — on
 * mobile the bottom tool rail owns that zone and CanvasWorkspace already
 * surfaces the page indicator.
 */

import { Check, CloudUpload, Loader2 } from "lucide-react";
import { useEditorStore, type EditorTool } from "@/lib/paperstring/editor-store";
import type { SaveState } from "./TopBar";
import { WordMark } from "@/components/paperstring/brand";

const TOOL_NAMES: Record<EditorTool, string> = {
  select: "Select & transform",
  brush: "Brush",
  eraser: "Eraser",
  blur: "Soft focus",
  smudge: "Smudge",
  text: "Text",
  color: "Color",
  eyedropper: "Eyedropper",
  "select-area": "Cutout",
  image: "Photo",
  elements: "Elements",
};

export function StatusBar({ saveState }: { saveState: SaveState }) {
  const canvases = useEditorStore((s) => s.canvases);
  const activeCanvasId = useEditorStore((s) => s.activeCanvasId);
  const tool = useEditorStore((s) => s.tool);

  const idx = canvases.findIndex((c) => c.id === activeCanvasId);
  const page = idx >= 0 ? idx + 1 : 0;
  const total = canvases.length;

  return (
    <footer
      aria-label="Status"
      className="hidden shrink-0 items-center gap-4 border-t border-editor-border bg-editor-panel px-3 py-1.5 text-[11px] text-editor-dim md:flex"
    >
      {/* document position */}
      <p className="tabular-nums">
        Page {total > 0 ? page : "–"} <span aria-hidden="true">/</span> {total}
        {total === 1 ? " page" : " pages"}
      </p>

      <span aria-hidden="true" className="h-3 w-px bg-editor-border-strong" />

      {/* active tool */}
      <p className="flex items-center gap-1.5 text-editor-text/80">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-sm bg-[#155EEF]"
        />
        {TOOL_NAMES[tool]}
      </p>

      {/* save state */}
      <p
        className="ml-auto flex items-center gap-1.5 tabular-nums"
        role="status"
        aria-live="polite"
      >
        {saveState === "saving" ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : saveState === "saved" ? (
          <Check className="h-3 w-3 text-[#155EEF]" aria-hidden="true" />
        ) : saveState === "dirty" ? (
          <CloudUpload className="h-3 w-3" aria-hidden="true" />
        ) : null}
        {saveState === "saved"
          ? "All changes saved"
          : saveState === "saving"
            ? "Saving…"
            : saveState === "dirty"
              ? "Unsaved changes"
              : "Save failed"}
      </p>

      <span aria-hidden="true" className="h-3 w-px bg-editor-border-strong" />

      <WordMark className="text-[10px] text-editor-dim" markClassName="h-3.5 w-4" />
    </footer>
  );
}
