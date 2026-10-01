"use client";

/**
 * ToolRail — the vertical tool strip (desktop) / horizontal bar (mobile).
 * Tools are grouped like a professional application — Navigate · Paint ·
 * Content — with hairline separators between the groups. The active tool
 * reads as an accent state: blue icon, blue-tinted surface and a 2px
 * indicator bar (left on desktop, top on mobile) — never a heavy block.
 * Keyboard shortcuts: V select · B brush · E eraser · F soft focus · D smudge ·
 * T text · C color · S select-area · K elements.
 */

import {
  Droplets,
  Fingerprint,
  ImagePlus,
  Layers,
  MousePointer2,
  Paintbrush,
  Palette,
  Pipette,
  Scissors,
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
  { id: "select-area", label: "Cutout — freehand photo crop", shortcut: "S", icon: Scissors },
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
          "z-20 flex shrink-0 items-center border-editor-border bg-editor-panel",
          // mobile: a fixed bottom bar inside thumb reach, grouped by
          // hairlines into Navigate / Paint / Content clusters
          "max-md:fixed inset-x-0 bottom-0 z-40 flex-row justify-around gap-0.5 border-t px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5",
          // desktop: a slim grouped rail
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
          // Group starts: select (Navigate) · brush (Paint) · text (Content)
          const startsGroup = t.id === "brush" || t.id === "text";
          return (
            <Tooltip key={t.id}>
              {startsGroup && (
                <span
                  aria-hidden="true"
                  className="h-5 w-px shrink-0 self-center bg-editor-border-strong md:my-1.5 md:h-px md:w-5"
                />
              )}
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t.label}
                  aria-pressed={activeTool}
                  onClick={() => setTool(t.id)}
                  className={cn(
                    "relative grid h-11 w-11 place-items-center rounded-lg transition-colors duration-150 max-md:h-10 max-md:w-10",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    hideOnMobile && "max-md:hidden",
                    activeTool
                      ? "bg-[#155EEF]/10 text-[#155EEF]"
                      : "text-editor-dim hover:bg-editor-raised hover:text-editor-text active:scale-95"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {activeTool && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0.5 left-1/2 h-[2.5px] w-[2.5px] rounded-full bg-[#155EEF] md:bottom-auto md:left-0.5 md:top-1/2 md:h-4 md:w-[2.5px] md:-translate-y-1/2 md:translate-x-0 md:rounded-full"
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
                className="grid h-11 w-10 place-items-center rounded-lg text-editor-dim transition hover:bg-editor-raised hover:text-editor-text active:scale-95 md:hidden"
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
      className="flex items-center gap-2 rounded-lg border border-editor-border-strong bg-white px-3 py-2 text-xs text-editor-text transition hover:bg-editor-raised active:scale-[0.98]"
    >
      <Pipette className="h-4 w-4" /> Pick from page
    </button>
  );
}
