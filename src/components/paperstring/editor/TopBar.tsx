"use client";

/**
 * Editor top bar: back to studio, editable title, undo/redo, save state and
 * the Save + Share actions (clear progress/success/failure states, FR-1.10).
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CloudUpload,
  Compass,
  Keyboard,
  Loader2,
  Pencil,
  Redo2,
  Share2,
  Undo2,
} from "lucide-react";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SaveState = "saved" | "dirty" | "saving" | "error";

export function TopBar({
  saveState,
  onSave,
  onShare,
  shareToken,
  onStartTour,
}: {
  saveState: SaveState;
  onSave: () => void;
  onShare: () => void;
  shareToken: string | null;
  onStartTour?: () => void;
}) {
  const title = useEditorStore((s) => s.title);
  const setTitle = useEditorStore((s) => s.setTitle);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const dirty = useEditorStore((s) => s.dirty);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(title); // always edit from the live title
    setEditing(true);
  };

  const commitTitle = () => {
    const next = draft.trim();
    if (next && next !== title) setTitle(next);
    else setDraft(title);
    setEditing(false);
  };

  const saveLabel: Record<SaveState, string> = {
    saved: "All changes saved",
    dirty: "Unsaved changes",
    saving: "Saving…",
    error: "Save failed — tap to retry",
  };

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-editor-border bg-editor px-3 sm:px-4">
      <TooltipProvider delayDuration={400}>
        <button
          type="button"
          aria-label="Back to your studio"
          onClick={() => window.history.back()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>

        {/* title — the book's name, set in the display serif; hovering
            reveals the rename affordance (pencil + a fine accent underline) */}
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitTitle();
              if (e.key === "Escape") {
                setDraft(title);
                setEditing(false);
              }
            }}
            maxLength={120}
            aria-label="Project title"
            className="min-w-0 flex-1 rounded-md border border-editor-border-strong bg-editor-panel px-2.5 py-1.5 font-display text-sm italic text-editor-text outline-none focus:border-[#e8446a]/70 sm:max-w-xs"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            aria-label="Rename project"
            title="Rename this book"
            className="group/title min-w-0 max-w-[32vw] rounded-md px-2.5 py-1.5 text-sm text-editor-text transition hover:bg-editor-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#e8446a]/70 sm:max-w-xs"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-display italic tracking-tight">
                {title || "Untitled book"}
              </span>
              <Pencil
                aria-hidden="true"
                className="h-3 w-3 shrink-0 text-editor-dim/0 transition-all duration-200 group-hover/title:text-editor-dim group-hover/title:translate-x-px group-focus-visible/title:text-editor-dim"
              />
            </span>
            <span
              aria-hidden="true"
              className="mt-0.5 block h-px w-full origin-left scale-x-0 bg-[#e8446a]/70 transition-transform duration-300 group-hover/title:scale-x-100"
            />
          </button>
        )}

        {/* undo / redo — visible on every viewport so touch creators keep
            FR-10.1 parity (no keyboard required) */}
        <div className="mx-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={undo}
                className="grid h-8 w-8 place-items-center rounded-lg text-editor-dim transition hover:bg-editor-raised hover:text-editor-text disabled:opacity-30 disabled:hover:bg-transparent md:h-9 md:w-9"
              >
                <Undo2 className="h-4 w-4 md:h-4.5 md:w-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={redo}
                className="grid h-8 w-8 place-items-center rounded-lg text-editor-dim transition hover:bg-editor-raised hover:text-editor-text disabled:opacity-30 disabled:hover:bg-transparent md:h-9 md:w-9"
              >
                <Redo2 className="h-4 w-4 md:h-4.5 md:w-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
        </div>

        {/* save state */}
        <div
          className={cn(
            "ml-auto hidden items-center gap-1.5 text-xs sm:flex",
            saveState === "error" && "text-[#c73a56]",
            saveState === "saving" && "text-editor-dim",
            (saveState === "saved" || saveState === "dirty") && "text-editor-dim"
          )}
          role="status"
          aria-live="polite"
        >
          {saveState === "saving" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saveState === "error" ? (
            <CloudUpload className="h-3.5 w-3.5" />
          ) : saveState === "saved" ? (
            /* keyed on state so each save pops the check afresh */
            <Check key="saved-check" className="ps-pop-in h-3.5 w-3.5" />
          ) : null}
          <span className="hidden lg:inline">{saveLabel[saveState]}</span>
        </div>

        {/* keyboard shortcuts cheatsheet */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
              className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-editor-dim transition hover:bg-editor-raised hover:text-editor-text sm:ml-0 md:h-9 md:w-9"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            className="w-64 border-editor-border-strong bg-editor-panel text-editor-text"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-editor-dim">
              Shortcuts
            </p>
            <ul className="grid gap-1.5 text-xs">
              {SHORTCUTS.map(([keys, label]) => (
                <li key={keys} className="flex items-center justify-between gap-3">
                  <span className="text-editor-dim">{label}</span>
                  <kbd className="rounded-md border border-editor-border-strong bg-editor px-1.5 py-0.5 font-mono text-[10px] text-editor-text">
                    {keys}
                  </kbd>
                </li>
              ))}
            </ul>
            {/* touch hints — the phone-native gestures behind the same button */}
            <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-editor-dim md:hidden">
              Touch
            </p>
            <ul className="grid gap-1.5 text-xs md:hidden">
              {TOUCH_HINTS.map(([gesture, label]) => (
                <li key={gesture} className="flex items-center justify-between gap-3">
                  <span className="text-editor-dim">{label}</span>
                  <span className="rounded-md border border-editor-border-strong bg-editor px-1.5 py-0.5 text-[10px] text-editor-text">
                    {gesture}
                  </span>
                </li>
              ))}
            </ul>
            {onStartTour && (
              <>
                <div className="my-3 border-t border-editor-border/70" />
                <button
                  type="button"
                  onClick={onStartTour}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-editor-text transition hover:bg-editor-raised"
                >
                  <Compass className="h-4 w-4 text-editor-dim" aria-hidden="true" />
                  Show the guided tour
                </button>
              </>
            )}
          </PopoverContent>
        </Popover>

        <div className="flex shrink-0 items-center gap-2" data-tour="share">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={saveState === "saving"}
            aria-label="Save"
            className={cn(
              "gap-1.5 rounded-xl text-editor-dim hover:bg-editor-raised hover:text-editor-text active:scale-[0.97]",
              dirty && saveState !== "saving" && "text-editor-text"
            )}
          >
            {saveState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Save</span>
          </Button>
          <Button
            size="sm"
            onClick={onShare}
            aria-label="Share your book"
            className={cn(
              "group gap-1.5 rounded-xl bg-night text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.35)] transition-all hover:bg-onyx hover:shadow-[0_6px_18px_-6px_rgba(0,0,0,0.4)] active:scale-[0.97]",
              shareToken && "bg-onyx"
            )}
          >
            <Share2
              className={cn(
                "h-4 w-4 transition-transform",
                !shareToken &&
                  "ps-heartbeat motion-reduce:animate-none motion-reduce:transform-none"
              )}
            />
            <span className="hidden sm:inline">{shareToken ? "Shared" : "Share"}</span>
          </Button>
        </div>
      </TooltipProvider>
    </header>
  );
}

const SHORTCUTS: [string, string][] = [
  ["V", "Select & transform"],
  ["B", "Brush"],
  ["E", "Eraser"],
  ["F", "Soft focus (blur brush)"],
  ["D", "Smudge brush"],
  ["T", "Text"],
  ["C", "Color tools"],
  ["S", "Keep-inside selection"],
  ["K", "Stickers & templates"],
  ["I", "Add a photo"],
  ["Ctrl + Z", "Undo"],
  ["Ctrl + ⇧ + Z", "Redo"],
  ["Ctrl + S", "Save"],
  ["Del", "Delete active layer"],
  ["[ / ]", "Brush, eraser, soft-focus or smudge size (⇧ = ×10)"],
  ["Alt + [ / ]", "Bend selected text (arch ∩ / smile ∪)"],
  ["Alt + ← / →", "Previous / next page"],
  ["PgUp / PgDn", "Previous / next page"],
  ["Ctrl + ⇧ + ← / →", "Move page earlier / later"],
  ["Apple Pencil", "Pressure tapers strokes, scales blur & smudge"],
];

/** Touch-friendly equivalents shown on small screens instead of the
 *  keyboard cheatsheet (keyboards are rare on phones — gestures are the UI). */
const TOUCH_HINTS: [string, string][] = [
  ["Drag corners", "Resize / rotate"],
  ["Trash button", "Remove the selected photo or text"],
  ["⋯ page menu", "Duplicate / delete page"],
  ["Layers button", "Reorder & blend layers"],
];
