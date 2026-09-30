"use client";

/**
 * ToolRail — the vertical tool strip (desktop) / horizontal bar (mobile).
 * Keyboard shortcuts: V select · B brush · E eraser · F soft focus · D smudge ·
 * T text · C color · S select-area · K elements.
 */

import {
  Droplets,
  Fingerprint,
  ImagePlus,
  Lasso,
  Layers,
  MousePointer2,
  Paintbrush,
  Palette,
  Pipette,
  Sticker,
  Eraser,
  Type,
} from "lucide-react";
import { useEditorStore, type EditorTool } from "@/lib/paperstring/editor-store";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TOOLS: {
  id: EditorTool;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "select", label: "Select & transform", shortcut: "V", icon: MousePointer2 },
  { id: "brush", label: "Brush", shortcut: "B", icon: Paintbrush },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
  { id: "blur", label: "Soft focus", shortcut: "F", icon: Droplets },
  { id: "smudge", label: "Smudge", shortcut: "D", icon: Fingerprint },
  { id: "text", label: "Text", shortcut: "T", icon: Type },
  { id: "color", label: "Color & eyedropper", shortcut: "C", icon: Palette },
  { id: "select-area", label: "Lasso — freehand keep-inside", shortcut: "S", icon: Lasso },
  { id: "image", label: "Add a photo", shortcut: "I", icon: ImagePlus },
  { id: "elements", label: "Stickers & templates", shortcut: "K", icon: Sticker },
];

export function ToolRail({ onOpenLayers }: { onOpenLayers?: () => void }) {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const showLayers = !!onOpenLayers;

  return (
    <TooltipProvider delayDuration={350}>
      <nav
        aria-label="Tools"
        data-tour="tools"
        className={cn(
          "z-20 flex shrink-0 items-center gap-1 border-editor-border bg-editor-panel",
          "max-md:fixed inset-x-0 bottom-0 z-40 flex-row justify-around gap-0.5 border-t px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-1px_0_0_rgba(0,0,0,0.03)]",
          "md:h-full md:w-14 md:flex-col md:border-r md:px-1.5 md:py-3"
        )}
      >
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const activeTool = tool === t.id || (t.id === "color" && tool === "eyedropper");
          // On phones the rail stays one tidy row: the color tool folds away
          // (the brush panel's Color row opens the same panel + eyedropper),
          // and so does the photo tool — the Elements panel carries the very
          // same photo uploader, so nothing is lost.
          const hideOnMobile = t.id === "color" || t.id === "image";
          // Mobile grouping: hairline dividers separate "navigate" (select)
          // from "paint" (brush…smudge) from "content" (text…elements) so the
          // row reads as 3 clusters instead of 8 same-weight icons.
          const startsGroup = t.id === "brush" || t.id === "text";
          return (
            <Tooltip key={t.id}>
              {startsGroup && (
                <span
                  aria-hidden="true"
                  className="h-5 w-px shrink-0 self-center rounded-full bg-editor-border-strong md:hidden"
                />
              )}
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t.label}
                  aria-pressed={activeTool}
                  onClick={() => setTool(t.id)}
                  className={cn(
                    "relative grid h-11 w-11 place-items-center rounded-2xl transition-all duration-150 max-md:h-10 max-md:w-10",
                    hideOnMobile && "max-md:hidden",
                    activeTool
                      ? "bg-night text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)]"
                      : "text-editor-dim hover:bg-editor-raised hover:text-editor-text active:scale-95"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {activeTool && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-heart md:left-0 md:top-1/2 md:h-1.5 md:w-1.5 md:-translate-y-1/2 md:translate-x-0"
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-md:hidden">
                {t.label} · {t.shortcut}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {showLayers && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Layers"
                data-tour="layers-mobile"
                onClick={onOpenLayers}
                className="grid h-11 w-10 place-items-center rounded-2xl text-editor-dim transition hover:bg-editor-raised hover:text-editor-text active:scale-95 md:hidden"
              >
                <Layers className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Layers</TooltipContent>
          </Tooltip>
        )}
      </nav>
    </TooltipProvider>
  );
}

/** The eyedropper is a transient color-tool sub-mode. */
export function EyedropperButton() {
  const setTool = useEditorStore((s) => s.setTool);
  return (
    <button
      type="button"
      onClick={() => setTool("eyedropper")}
      className="flex items-center gap-2 rounded-xl border border-editor-border-strong bg-white px-3 py-2 text-xs text-editor-text shadow-[0_1px_4px_-1px_rgba(0,0,0,0.06)] transition hover:bg-smoke active:scale-[0.98]"
    >
      <Pipette className="h-4 w-4" /> Pick from page
    </button>
  );
}
