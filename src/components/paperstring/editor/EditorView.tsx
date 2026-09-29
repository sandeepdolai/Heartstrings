"use client";

/**
 * EditorView — the authenticated creation experience (PRD §5 Editor Mode).
 *
 * Owns the project lifecycle: load into the editor store, debounced autosave +
 * manual save with clear states (FR-1.10), the share pipeline entry, keyboard
 * shortcuts, a dirty-exit guard, and the responsive shell:
 *   desktop/tablet → ToolRail · ToolPanel · continuous grid · LayersPanel
 *   mobile         → rail at the bottom, panels as sheets, one page at a time
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { CustomFont, ProjectData, ProjectSummary, PsUser } from "@/lib/paperstring/types";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import { renderPageToCoverJpg } from "@/lib/paperstring/render";
import { psNavigate } from "@/lib/paperstring/navigation";
import { LogoMark } from "../brand";
import { TopBar, type SaveState } from "./TopBar";
import { ToolRail } from "./ToolRail";
import { ToolPanel } from "./ToolPanel";
import { CanvasWorkspace } from "./CanvasWorkspace";
import { LayersPanel } from "./LayersPanel";
import { ShareDialog } from "./ShareDialog";
import { EditorTour, TOUR_STORAGE_KEY } from "./EditorTour";
import { EditorFontsProvider, registerSavedFonts } from "./fonts-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type FullProject = ProjectSummary & { data: ProjectData };

export function EditorView({ projectId, user }: { projectId: string; user: PsUser }) {
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [shareOpen, setShareOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [tourOpen, setTourOpen] = useState(false);
  /* transient HUD for brush/eraser/soft-focus/smudge size changes via [ / ] keys */
  const [sizeHud, setSizeHud] = useState<{
    value: number;
    tool: "brush" | "eraser" | "blur" | "smudge";
  } | null>(null);
  const sizeHudTimer = useRef<number | null>(null);

  const flashSizeHud = useCallback(
    (value: number, tool: "brush" | "eraser" | "blur" | "smudge") => {
      setSizeHud({ value, tool });
      if (sizeHudTimer.current !== null) window.clearTimeout(sizeHudTimer.current);
      sizeHudTimer.current = window.setTimeout(() => setSizeHud(null), 1000);
    },
    []
  );

  useEffect(
    () => () => {
      if (sizeHudTimer.current !== null) window.clearTimeout(sizeHudTimer.current);
    },
    []
  );

  /* ── load the project ─────────────────────────────────────────────── */

  const { data, isLoading, error } = useQuery<FullProject>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not open this project");
      }
      return (await res.json()).project as FullProject;
    },
    retry: false,
    staleTime: Infinity,
  });

  const loadedRef = useRef(false);
  const storeProjectId = useEditorStore((s) => s.projectId);
  useEffect(() => {
    if (!data || loadedRef.current) return;
    loadedRef.current = true;
    const fonts = data.data?.fonts ?? [];
    setShareToken(data.shareToken);
    void registerSavedFonts(fonts).then(() => {
      setCustomFonts(fonts);
      useEditorStore.getState().load(projectId, data.title, data.data, user);
    });
  }, [data, projectId, user]);

  // Leave the store clean behind us.
  useEffect(
    () => () => {
      useEditorStore.getState().reset();
    },
    []
  );

  const ready = !!storeProjectId;

  /* ── first-time guided tour ────────────────────────────────────────── */

  useEffect(() => {
    if (!ready) return;
    let seen = true;
    try {
      seen = !!window.localStorage.getItem(TOUR_STORAGE_KEY);
    } catch {
      seen = true; // storage unavailable → don't nag with the tour
    }
    if (seen) return;
    const t = window.setTimeout(() => setTourOpen(true), 650);
    return () => window.clearTimeout(t);
  }, [ready]);

  /* ── custom font registry (FR-4.4) ────────────────────────────────── */

  const fontsApi = useMemo(
    () => ({
      fonts: customFonts,
      addFont: (font: CustomFont) => {
        setCustomFonts((prev) =>
          prev.some((f) => f.id === font.id) ? prev : [...prev, font]
        );
        // fonts are persisted with the next save
        useEditorStore.setState({ dirty: true });
      },
    }),
    [customFonts]
  );
  const fontsRef = useRef(fontsApi);
  fontsRef.current = fontsApi;

  /* ── save (manual + autosave + share pipeline) ────────────────────── */

  const savingRef = useRef(false);
  const save = useCallback(
    async ({ force = false }: { force?: boolean } = {}): Promise<{
      ok: boolean;
      coverImage?: string;
    }> => {
      const s = useEditorStore.getState();
      if (!s.projectId || !s.canvases.length) return { ok: false };
      if (savingRef.current) return { ok: true };
      if (!s.dirty && !force) return { ok: true };
      savingRef.current = true;
      setSaveState("saving");
      try {
        let coverImage: string | undefined;
        try {
          coverImage = await renderPageToCoverJpg(s.canvases[0], 360);
        } catch (err) {
          console.warn("[editor] cover render skipped", err);
        }
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: s.title,
            data: {
              version: 1,
              canvases: s.canvases,
              fonts: fontsRef.current.fonts.length
                ? fontsRef.current.fonts
                : undefined,
            } satisfies ProjectData,
            coverImage: coverImage ?? null,
          }),
        });
        if (!res.ok) throw new Error(`save ${res.status}`);
        useEditorStore.getState().markSaved();
        setSaveState("saved");
        void queryClient.invalidateQueries({ queryKey: ["projects"] });
        return { ok: true, coverImage };
      } catch (err) {
        console.error("[editor] save failed", err);
        setSaveState("error");
        return { ok: false };
      } finally {
        savingRef.current = false;
      }
    },
    [projectId, queryClient]
  );
  const saveRef = useRef(save);
  saveRef.current = save;

  /** Stable identity for the ShareDialog (an inline arrow here would restart
   *  the publish pipeline on every EditorView re-render). */
  const performShareSave = useCallback(
    () => saveRef.current({ force: true }),
    []
  );

  // Debounced autosave: fires 2.5s after the last edit, never mid-gesture.
  const canvasesRev = useEditorStore((s) => s.canvases);
  const titleRev = useEditorStore((s) => s.title);
  const dirty = useEditorStore((s) => s.dirty);
  useEffect(() => {
    if (!ready || !dirty) return;
    const t = setTimeout(() => void saveRef.current(), 2500);
    return () => clearTimeout(t);
  }, [ready, dirty, canvasesRev, titleRev]);

  /* ── dirty-exit guard ─────────────────────────────────────────────── */

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /* ── keyboard shortcuts (V/B/E/F/T/C/S/K/I · undo/redo · save · delete) */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;
      const store = useEditorStore.getState();
      if (store.editingTextLayerId) return; // the canvas text editor owns keys

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current({ force: true });
        return;
      }
      // Move the active page: Ctrl+Shift+←/→ (the keyboard twin of
      // filmstrip drag-reorder; navigation stays on Alt/Ctrl alone).
      if (mod && e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        const { canvases, activeCanvasId, reorderCanvas } = store;
        const idx = canvases.findIndex((c) => c.id === activeCanvasId);
        if (idx >= 0) {
          const to = e.key === "ArrowRight" ? idx + 1 : idx - 1;
          if (to >= 0 && to < canvases.length) {
            e.preventDefault();
            reorderCanvas(canvases[idx].id, to);
            toast.success(`Page ${idx + 1} moved to position ${to + 1}`);
          }
        }
        return;
      }
      // Page navigation: Alt+←/→ anywhere, PageUp/PageDown too. Never fires
      // while a text editor is open (guarded above) or inputs hold focus.
      if (
        e.key === "PageDown" ||
        (e.altKey && e.key === "ArrowRight") ||
        (e.ctrlKey && e.key === "ArrowRight")
      ) {
        const { canvases, activeCanvasId, setActiveCanvas } = store;
        const idx = canvases.findIndex((c) => c.id === activeCanvasId);
        if (idx >= 0 && idx < canvases.length - 1) {
          e.preventDefault();
          setActiveCanvas(canvases[idx + 1].id);
        }
        return;
      }
      if (
        e.key === "PageUp" ||
        (e.altKey && e.key === "ArrowLeft") ||
        (e.ctrlKey && e.key === "ArrowLeft")
      ) {
        const { canvases, activeCanvasId, setActiveCanvas } = store;
        const idx = canvases.findIndex((c) => c.id === activeCanvasId);
        if (idx > 0) {
          e.preventDefault();
          setActiveCanvas(canvases[idx - 1].id);
        }
        return;
      }
      if (mod || e.altKey) return;

      // Brush / eraser / soft-focus / smudge size: [ smaller, ] larger
      // (Shift = ×10 step). Shift+[ / Shift+] surface as "{" / "}" — both count.
      const sizeKey = e.key === "[" || e.key === "{" ? "[" : e.key === "]" || e.key === "}" ? "]" : null;
      if (sizeKey) {
        e.preventDefault();
        const bigStep = e.shiftKey ? 10 : 1;
        const delta = sizeKey === "[" ? -bigStep : bigStep;
        const { tool, brush, eraserSize, blur, smudge, setBrush, setEraserSize, setBlurTool, setSmudgeTool } = store;
        if (tool === "eraser") {
          const next = Math.round(Math.min(220, Math.max(2, eraserSize + delta)));
          if (next !== eraserSize) {
            setEraserSize(next);
            flashSizeHud(next, "eraser");
          }
        } else if (tool === "blur") {
          const next = Math.round(Math.min(320, Math.max(20, blur.size + delta)));
          if (next !== blur.size) {
            setBlurTool({ size: next });
            flashSizeHud(next, "blur");
          }
        } else if (tool === "smudge") {
          const next = Math.round(Math.min(320, Math.max(30, smudge.size + delta)));
          if (next !== smudge.size) {
            setSmudgeTool({ size: next });
            flashSizeHud(next, "smudge");
          }
        } else {
          const next = Math.round(Math.min(200, Math.max(1, brush.size + delta)));
          if (next !== brush.size) {
            setBrush({ size: next });
            flashSizeHud(next, "brush");
          }
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v": store.setTool("select"); break;
        case "b": store.setTool("brush"); break;
        case "e": store.setTool("eraser"); break;
        case "f": store.setTool("blur"); break;
        case "d": store.setTool("smudge"); break;
        case "t": store.setTool("text"); break;
        case "c": store.setTool("color"); break;
        case "s": store.setTool("select-area"); break;
        case "k": store.setTool("elements"); break;
        case "i": store.setTool("image"); break;
        case "delete":
        case "backspace": {
          const layer = store.getActiveLayer();
          if (layer) {
            e.preventDefault();
            store.deleteLayer(layer.id);
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── error / loading states ───────────────────────────────────────── */

  if (error) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-editor px-6 text-center text-editor-text">
        <LogoMark className="h-10 w-10 text-silver" />
        <div>
          <h1 className="font-display text-2xl">This book can&apos;t be opened</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-editor-dim">
            {error instanceof Error ? error.message : "Something went wrong."} It may
            have been deleted, or it belongs to another creator.
          </p>
        </div>
        <Button
          onClick={() => psNavigate("dashboard")}
          className="rounded-full bg-smoke text-night hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to your studio
        </Button>
      </main>
    );
  }

  if (isLoading || !ready) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-editor text-editor-text">
        <Loader2 className="h-6 w-6 animate-spin text-editor-dim" />
        <p className="text-xs uppercase tracking-[0.22em] text-editor-dim">
          Opening your book…
        </p>
      </main>
    );
  }

  /* ── the editor shell ─────────────────────────────────────────────── */

  return (
    <EditorFontsProvider value={fontsApi}>
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-editor text-editor-text">
        <TopBar
          saveState={saveState}
          onSave={() => void save({ force: true })}
          onShare={() => setShareOpen(true)}
          shareToken={shareToken}
          onStartTour={() => setTourOpen(true)}
        />

        <div className="relative flex min-h-0 flex-1">
          <ToolRail onOpenLayers={() => setLayersOpen(true)} />
          <ToolPanel />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <CanvasWorkspace />
          </div>
          <div className="hidden md:block">
            <LayersPanel />
          </div>

          {/* transient size HUD — a quiet confirm for [ / ] size changes */}
          {sizeHud && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2"
            >
              <div className="flex items-center gap-3 rounded-full border border-editor-border-strong bg-editor-panel/95 px-4 py-2.5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.5)] backdrop-blur-sm">
                <span
                  className="rounded-full"
                  style={{
                    width: `${Math.min(28, Math.max(4, sizeHud.value / 6))}px`,
                    height: `${Math.min(28, Math.max(4, sizeHud.value / 6))}px`,
                    background:
                      sizeHud.tool === "brush"
                        ? "#e8446a"
                        : sizeHud.tool === "blur"
                          ? "radial-gradient(circle, rgba(181,181,181,0.65), rgba(181,181,181,0.05))"
                          : sizeHud.tool === "smudge"
                            ? "linear-gradient(90deg, rgba(181,181,181,0.9), rgba(232,68,106,0.45), rgba(181,181,181,0.1))"
                            : "transparent",
                    border:
                      sizeHud.tool === "eraser"
                        ? "1.5px dashed #b5b5b5"
                        : sizeHud.tool === "blur"
                          ? "1.5px dotted #b5b5b5"
                          : "none",
                    filter:
                      sizeHud.tool === "blur" ? "blur(0.75px)" : undefined,
                  }}
                />
                <span className="text-[11px] uppercase tracking-[0.18em] text-editor-dim">
                  {sizeHud.tool === "eraser"
                    ? "Eraser"
                    : sizeHud.tool === "blur"
                      ? "Soft focus"
                      : sizeHud.tool === "smudge"
                        ? "Smudge"
                        : "Brush"}
                </span>
                <span className="text-sm tabular-nums text-editor-text">
                  {sizeHud.value} px
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* mobile layers sheet (FR-3.6) */}
      <Sheet open={layersOpen} onOpenChange={setLayersOpen}>
        <SheetContent
          side="bottom"
          className="h-[70dvh] border-editor-border bg-editor-panel p-0 text-editor-text"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Layers</SheetTitle>
            <SheetDescription>
              The layer stack for the page you are editing.
            </SheetDescription>
          </SheetHeader>
          <div className="h-full">
            <LayersPanel onClose={() => setLayersOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={projectId}
        performSave={performShareSave}
        onPublished={(token) => setShareToken(token)}
      />

      {/* first-time guided tour (auto once; replayable from shortcuts) */}
      <EditorTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </EditorFontsProvider>
  );
}
