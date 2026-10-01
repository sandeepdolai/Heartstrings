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
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { CustomFont, ProjectData, ProjectSummary, PsUser } from "@/lib/paperstring/types";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import { renderPageToCoverJpg } from "@/lib/paperstring/render";
import { exportPagesAsImages } from "@/lib/paperstring/export";
import { migrateLegacyImageMasks } from "@/lib/paperstring/cutout";
import { psNavigate } from "@/lib/paperstring/navigation";
import { LogoMark } from "../brand";
import { TopBar, type SaveState, type ExportRequest } from "./TopBar";
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
  /* transient HUD for brush/eraser/soft-focus/smudge size changes via [ / ] keys,
     and for text-curve nudges via Alt+[ / Alt+] */
  const [sizeHud, setSizeHud] = useState<{
    value: number;
    tool: "brush" | "eraser" | "blur" | "smudge" | "curve";
  } | null>(null);
  const sizeHudTimer = useRef<number | null>(null);

  const flashSizeHud = useCallback(
    (value: number, tool: "brush" | "eraser" | "blur" | "smudge" | "curve") => {
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

  /* The editor fetches its project DIRECTLY on every mount (no React Query
   * cache) — this is deliberate. The old useQuery with staleTime: Infinity
   * cached the first load forever, so re-entering the editor (dashboard →
   * book, or "Open the book as they'll see it" → back) rehydrated the STALE
   * pre-edit state: freshly added stickers vanished and a share from there
   * published blank pages (live bug report). A per-mount no-store fetch
   * guarantees the canvas always opens on the newest saved state, while the
   * loadedRef guard keeps a single load per mount (the `user` object may be
   * replaced by a ["me"] refetch — it must never re-trigger the load and
   * clobber live edits). */
  const [project, setProject] = useState<FullProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedProjectRef = useRef<string | null>(null);
  const storeProjectId = useEditorStore((s) => s.projectId);

  useEffect(() => {
    // Skip only when THIS project is already live in the store — a ["me"]
    // refetch after a completed load must never re-load and clobber live
    // edits. But when a previous run was cancelled mid-flight (the user
    // object was replaced while the fetch was in the air), the store does
    // NOT have the project yet — fall through and retry, or the editor
    // orphans into "Opening your book…" forever (found live in QA: HMR
    // full-reload + me-refetch raced the project fetch).
    const store = useEditorStore.getState();
    if (
      loadedProjectRef.current === projectId &&
      store.projectId === projectId
    )
      return;
    loadedProjectRef.current = projectId;
    let cancelled = false;
    setProject(null);
    setLoadError(null);
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Could not open this project");
        }
        const json = (await res.json()) as { project: FullProject };
        if (cancelled) return;
        const fonts = json.project.data?.fonts ?? [];
        setShareToken(json.project.shareToken);
        await registerSavedFonts(fonts);
        if (cancelled) return;
        setCustomFonts(fonts);
        useEditorStore
          .getState()
          .load(projectId, json.project.title, json.project.data, user);
        setProject(json.project);
        // Load-time upgrade: image layers still carrying a legacy
        // keep-inside mask (the retired round-23 lasso) become true
        // cutouts — identical pixels, but the mask's page-anchored,
        // box-detaching behaviour is gone. Fire-and-forget: failures keep
        // the legacy mask rendering, and the migration persists with the
        // next autosave.
        void (async () => {
          const count = await migrateLegacyImageMasks(
            useEditorStore.getState().canvases,
            (canvasId, layerId, patch) =>
              useEditorStore
                .getState()
                .patchLayer(canvasId, layerId, patch, { history: false })
          );
          if (count > 0) {
            toast.success(
              count === 1
                ? "1 photo upgraded from mask to cutout"
                : `${count} photos upgraded from masks to cutouts`,
              {
                description:
                  "Nothing changed visually — they just move and resize as one piece now.",
              }
            );
          }
        })();
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Could not open this project"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, user]);

  const isLoading = !project && !loadError;
  const error = loadError ? new Error(loadError) : null;

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

  const savePromiseRef = useRef<Promise<{ ok: boolean; coverImage?: string }> | null>(
    null
  );
  const save = useCallback(
    async ({ force = false }: { force?: boolean } = {}): Promise<{
      ok: boolean;
      coverImage?: string;
    }> => {
      const begin = useEditorStore.getState();
      if (!begin.projectId || !begin.canvases.length) return { ok: false };
      if (savePromiseRef.current) {
        // A save is already in flight. A debounced autosave can ride along
        // (its PUT carries the state as of its start, and the next autosave
        // picks up anything newer). A FORCED save (Share, Ctrl+S) must
        // guarantee the newest edits persist — wait for the in-flight one,
        // then save again if the store is still dirty. Returning ok without
        // persisting (the old behaviour) let share publish stale/empty data.
        if (!force) return { ok: true };
        await savePromiseRef.current.catch(() => {});
        const now = useEditorStore.getState();
        if (!now.projectId || !now.canvases.length) return { ok: false };
        if (!now.dirty) return { ok: true }; // the in-flight save carried it
      }
      if (!useEditorStore.getState().dirty && !force) return { ok: true };
      if (savePromiseRef.current) return { ok: true }; // someone raced in
      const run = (async () => {
        setSaveState("saving");
        try {
          const s = useEditorStore.getState();
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
          const savedCanvases = s.canvases;
          const savedTitle = s.title;
          useEditorStore.getState().markSaved();
          // Edits that landed while this request was in flight set dirty=true,
          // which markSaved just erased — their autosave timer would have been
          // cancelled with it. Re-flag so the debounce picks them up. (Every
          // store mutation produces fresh references, so this comparison is
          // exact.)
          const after = useEditorStore.getState();
          if (
            !after.dirty &&
            (after.canvases !== savedCanvases || after.title !== savedTitle)
          ) {
            useEditorStore.setState({ dirty: true });
          }
          setSaveState("saved");
          void queryClient.invalidateQueries({ queryKey: ["projects"] });
          return { ok: true, coverImage };
        } catch (err) {
          console.error("[editor] save failed", err);
          setSaveState("error");
          return { ok: false };
        }
      })();
      savePromiseRef.current = run;
      try {
        return await run;
      } finally {
        if (savePromiseRef.current === run) savePromiseRef.current = null;
      }
    },
    [projectId, queryClient]
  );
  const saveRef = useRef(save);
  saveRef.current = save;

  /* ── export: every created page as PNG/JPG files ──────────────────── */

  const [exporting, setExporting] = useState(false);
  const runExport = useCallback(async (req: ExportRequest) => {
    const s = useEditorStore.getState();
    if (!s.canvases.length) return;
    setExporting(true);
    const loading = toast.loading(
      req.scope === "all" ? "Rendering every page…" : "Rendering this page…"
    );
    try {
      const pages =
        req.scope === "all"
          ? s.canvases
          : s.canvases.filter((c) => c.id === s.activeCanvasId);
      const list = pages.length ? pages : s.canvases;
      const written = await exportPagesAsImages({
        title: s.title || "Untitled book",
        pages: list,
        formats: req.formats,
      });
      if (written > 0) {
        toast.success(`Exported ${written} file${written === 1 ? "" : "s"}`, {
          id: loading,
          description:
            "Check your downloads — PNG keeps every pixel, JPG is share-ready.",
        });
      } else {
        toast.error("Nothing to export", {
          id: loading,
          description: "Add some artwork to the page first.",
        });
      }
    } catch (err) {
      console.error("[editor] export failed", err);
      toast.error("Export failed", {
        id: loading,
        description: "Something went wrong while rendering — try again.",
      });
    } finally {
      setExporting(false);
    }
  }, []);
  const runExportRef = useRef(runExport);
  runExportRef.current = runExport;

  /** Save = persist to the studio AND hand over the graphics as files
   *  (every page, both formats) — the creator asked for exactly that. */
  const saveAndExport = useCallback(async () => {
    await saveRef.current({ force: true });
    try {
      await runExportRef.current({ scope: "all", formats: ["png", "jpg"] });
    } catch (err) {
      console.error("[editor] save-and-export failed", err);
    }
  }, []);
  const saveAndExportRef = useRef(saveAndExport);
  saveAndExportRef.current = saveAndExport;

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
  const penActive = useEditorStore((s) => s.penActive);
  useEffect(() => {
    if (!ready || !dirty) return;
    const t = setTimeout(() => void saveRef.current(), 2500);
    return () => clearTimeout(t);
  }, [ready, dirty, canvasesRev, titleRev]);

  // Autosave safety net: whatever left the store dirty for 20s straight (a
  // cancelled debounce, a missed edge) gets saved anyway — "forgot to
  // save" is simply not a failure mode anymore.
  useEffect(() => {
    if (!ready) return;
    const iv = window.setInterval(() => {
      const s = useEditorStore.getState();
      if (s.dirty && s.projectId && s.canvases.length) void saveRef.current();
    }, 20000);
    return () => window.clearInterval(iv);
  }, [ready]);

  // Leaving the tab or app: flush immediately. On visibilitychange the
  // page stays alive, so the full save pipeline (cover render included)
  // runs fine; on pagehide (tab close) a keepalive PUT fires when the
  // snapshot is small enough and a plain fetch otherwise — best effort,
  // the windows above already made the at-risk interval tiny.
  useEffect(() => {
    const snapshotBody = (): string | null => {
      const s = useEditorStore.getState();
      if (!s.projectId || !s.dirty || !s.canvases.length) return null;
      const fonts = fontsRef.current.fonts;
      try {
        return JSON.stringify({
          title: s.title,
          data: {
            version: 1,
            canvases: s.canvases,
            ...(fonts.length ? { fonts } : {}),
          },
        } satisfies { title: string; data: ProjectData });
      } catch {
        return null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Dirty-guarded: a CLEAN editor must never force-save on hide — a
        // stale store could then clobber newer server data (another tab's
        // save, or an external write) in the unload race.
        const s = useEditorStore.getState();
        if (s.dirty) void saveRef.current({ force: true });
      }
    };
    const onPageHide = () => {
      const s = useEditorStore.getState();
      const body = snapshotBody();
      if (!s.projectId || !body) return;
      const init: RequestInit = {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      };
      if (body.length <= 60000) {
        void fetch(`/api/projects/${s.projectId}`, {
          ...init,
          keepalive: true,
        }).catch(() => {});
      } else {
        void fetch(`/api/projects/${s.projectId}`, init).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

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

  // Leave the store clean behind us — and never lose the last edits on the
  // way out: the debounced autosave can still be waiting (its 2.5s window)
  // or a save can be mid-flight when the user navigates to the dashboard or
  // the shared viewer. Snapshot the newest state BEFORE reset (reset empties
  // the store synchronously), then flush it after any in-flight save settles
  // so the newer write always lands last. Found via a live bug report —
  // stickers added right before sharing/viewing vanished and the link
  // published blank pages.
  useEffect(
    () => () => {
      const s = useEditorStore.getState();
      const fonts = fontsRef.current.fonts;
      let snapshot: string | null = null;
      if (s.projectId && s.canvases.length && (s.dirty || savePromiseRef.current)) {
        try {
          snapshot = JSON.stringify({
            title: s.title,
            data: {
              version: 1,
              canvases: s.canvases,
              ...(fonts.length ? { fonts } : {}),
            },
            // coverImage omitted on purpose — the exit flush skips the cover
            // re-render, and the stored cover stays as-is.
          } satisfies { title: string; data: ProjectData });
        } catch {
          snapshot = null; // serialisation issue — nothing more to do here
        }
      }
      useEditorStore.getState().reset();
      if (!snapshot) return;
      const projectIdAtExit = s.projectId;
      void (async () => {
        // Let any in-flight (older) save finish first so this newer write can
        // never be overwritten by a late-landing stale response.
        if (savePromiseRef.current) {
          await savePromiseRef.current.catch(() => {});
        }
        try {
          await fetch(`/api/projects/${projectIdAtExit}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: snapshot,
          });
        } catch {
          /* best-effort exit flush — the dirty-exit guard already warned on
             tab close; in-app navigation keeps the page alive so this fetch
             virtually always completes. */
        }
      })();
    },
    []
  );

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
        void saveAndExportRef.current();
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
      // Text curve nudge: Alt+[ / Alt+] bends the selected text ∓5 — the
      // keyboard sibling of the Curve slider (Round 15 rec d). Runs before
      // the alt-key bail-out below (page nav uses Alt+arrows, not brackets).
      if (
        e.altKey &&
        !mod &&
        (e.key === "[" || e.key === "{" || e.key === "]" || e.key === "}")
      ) {
        const layer = store.getActiveLayer();
        if (layer && layer.type === "text") {
          e.preventDefault();
          const down = e.key === "[" || e.key === "{";
          const cur = layer.curve ?? 0;
          const next = Math.round(
            Math.max(-100, Math.min(100, cur + (down ? -5 : 5)))
          );
          if (next !== cur) {
            store.updateLayer(layer.id, { curve: next });
            flashSizeHud(next, "curve");
          }
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
          className="rounded-lg bg-smoke text-night hover:bg-white"
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
          onSave={() => void saveAndExportRef.current()}
          onShare={() => setShareOpen(true)}
          onExport={(req) => void runExportRef.current(req)}
          exporting={exporting}
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
              <div className="flex items-center gap-3 rounded-full border border-editor-border-strong bg-editor-panel/95 px-4 py-2.5 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                <span
                  className="rounded-full"
                  style={{
                    width:
                      sizeHud.tool === "curve"
                        ? "18px"
                        : `${Math.min(28, Math.max(4, sizeHud.value / 6))}px`,
                    height:
                      sizeHud.tool === "curve"
                        ? "18px"
                        : `${Math.min(28, Math.max(4, sizeHud.value / 6))}px`,
                    background:
                      sizeHud.tool === "brush"
                        ? "#155EEF"
                        : sizeHud.tool === "blur"
                          ? "radial-gradient(circle, rgba(181,181,181,0.65), rgba(181,181,181,0.05))"
                          : sizeHud.tool === "smudge"
                            ? "linear-gradient(90deg, rgba(181,181,181,0.9), rgba(21,94,239,0.45), rgba(181,181,181,0.1))"
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
                {sizeHud.tool === "curve" ? (
                  <svg
                    width="22"
                    height="14"
                    viewBox="0 0 22 14"
                    fill="none"
                    aria-hidden="true"
                    style={{ flex: "0 0 auto" }}
                  >
                    <path
                      d={
                        sizeHud.value > 0
                          ? "M1.5 12.5 Q11 -2 20.5 12.5"
                          : sizeHud.value < 0
                            ? "M1.5 1.5 Q11 16 20.5 1.5"
                            : "M1.5 7 H20.5"
                      }
                      stroke="#155EEF"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <span className="text-[11px] uppercase tracking-[0.18em] text-editor-dim">
                    {sizeHud.tool === "eraser"
                      ? "Eraser"
                      : sizeHud.tool === "blur"
                        ? "Soft focus"
                        : sizeHud.tool === "smudge"
                          ? "Smudge"
                          : "Brush"}
                  </span>
                )}
                {sizeHud.tool === "curve" ? (
                  <span className="text-sm tabular-nums text-editor-text">
                    {sizeHud.value === 0
                      ? "Flat"
                      : sizeHud.value > 0
                        ? `Arch ${sizeHud.value}`
                        : `Smile ${-sizeHud.value}`}
                  </span>
                ) : (
                  <span className="text-sm tabular-nums text-editor-text">
                    {sizeHud.value} px
                  </span>
                )}
              </div>
            </div>
          )}

          {/* stylus confirmation chip — shown while the last paint pointer was
              a pen: taper + pressure-scaled soft focus/smudge are live */}
          {penActive && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-6 left-6 z-30 hidden md:block"
            >
              <div className="flex items-center gap-2 rounded-full border border-editor-border-strong bg-editor-panel/95 py-1.5 pl-1.5 pr-3 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.22)] backdrop-blur-sm">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#155EEF]/10 text-[#155EEF]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19l7-7 3 3-7 7-3-3z" />
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    <path d="M2 2l7.586 7.586" />
                    <circle cx="11" cy="11" r="2" />
                  </svg>
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-editor-dim">
                  Pencil · pressure
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
