"use client";

/**
 * ToolRail — the vertical tool strip (desktop) / horizontal bar (mobile).
 * Keyboard shortcuts: V select · B brush · E eraser · F soft focus · T text ·
 * C color · S select-area · K elements.
 */

import {
  Droplets,
  ImagePlus,
  Layers,
  MousePointer2,
  Paintbrush,
  Palette,
  Pipette,
  SquareDashedMousePointer,
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
  { id: "text", label: "Text", shortcut: "T", icon: Type },
  { id: "color", label: "Color & eyedropper", shortcut: "C", icon: Palette },
  { id: "select-area", label: "Keep-inside selection", shortcut: "S", icon: SquareDashedMousePointer },
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
          "z-20 flex shrink-0 items-center gap-1 border-editor-border bg-editor",
          "max-md:fixed inset-x-0 bottom-0 z-40 flex-row justify-around gap-0.5 border-t px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5",
          "md:h-full md:w-14 md:flex-col md:border-r md:px-1.5 md:py-3"
        )}
      >
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const activeTool = tool === t.id || (t.id === "color" && tool === "eyedropper");
          // On phones the rail stays one tidy row: the color tool folds away
          // (the brush panel's Color row opens the same panel + eyedropper).
          const hideOnMobile = t.id === "color";
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t.label}
                  aria-pressed={activeTool}
                  onClick={() => setTool(t.id)}
                  className={cn(
                    "relative grid h-11 w-11 place-items-center rounded-xl transition-all duration-150 max-md:h-10 max-md:w-10",
                    hideOnMobile && "max-md:hidden",
                    activeTool
                      ? "bg-smoke text-night shadow-lg"
                      : "text-editor-dim hover:bg-editor-raised hover:text-editor-text"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {activeTool && (
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-[#e8446a] md:left-0 md:top-1/2 md:h-1.5 md:w-1.5 md:-translate-y-1/2 md:translate-x-0"
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
                className="grid h-11 w-10 place-items-center rounded-xl text-editor-dim transition hover:bg-editor-raised hover:text-editor-text md:hidden"
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
      className="flex items-center gap-2 rounded-lg border border-editor-border-strong px-3 py-2 text-xs text-editor-text transition hover:bg-editor-raised"
    >
      <Pipette className="h-4 w-4" /> Pick from page
    </button>
  );
}
