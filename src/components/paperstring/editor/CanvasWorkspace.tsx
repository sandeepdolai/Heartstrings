"use client";

/**
 * CanvasWorkspace — the shared grid workspace (FR-2.1/2.2): all canvases in
 * one continuous scrollable grid on desktop/tablet; one page at a time with
 * prev/next controls + "Page 2 / 5" indicator on mobile (FR-2.3). Page
 * changes are always instant — no flip animations (FR-2.4, OOS-4).
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Copy, GripHorizontal, MoreHorizontal, Plus, Trash2, Type } from "lucide-react";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import { CANVAS_W, CANVAS_H, type CanvasPageData } from "@/lib/paperstring/types";
import { renderPage, onEngineContentLoaded } from "@/lib/paperstring/render";
import { PageCanvas } from "./PageCanvas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function CanvasWorkspace() {
  const canvases = useEditorStore((s) => s.canvases);
  const activeCanvasId = useEditorStore((s) => s.activeCanvasId);
  const setActiveCanvas = useEditorStore((s) => s.setActiveCanvas);
  const addCanvas = useEditorStore((s) => s.addCanvas);
  const duplicateCanvas = useEditorStore((s) => s.duplicateCanvas);
  const reorderCanvas = useEditorStore((s) => s.reorderCanvas);
  const [isMobile, setIsMobile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  /** Grid scroll container (desktop) — root for the windowing observer. */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  /** Live per-page card elements, for scroll-follow on active-page changes. */
  const pageEls = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  /* Follow the active page: when it changes (filmstrip jump, keyboard nav,
     context-menu move, undo), bring its card smoothly into view if it is
     off-screen. No-op while it is already visible — so editing in place
     never drifts. Desktop grid only; mobile is one page at a time already. */
  useEffect(() => {
    if (isMobile) return;
    const el = activeCanvasId ? pageEls.current.get(activeCanvasId) : null;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [activeCanvasId, canvases.length, isMobile]);

  const activeIdx = Math.max(
    0,
    canvases.findIndex((c) => c.id === activeCanvasId)
  );
  const mobilePage = canvases[activeIdx] ?? canvases[0];

  /* A pristine book — one untouched white page — shows the decorative
     welcome hint that dissolves with the creator's very first mark. */
  const isPristinePage = (page: CanvasPageData) =>
    canvases.length === 1 &&
    page.background === "#FFFFFF" &&
    page.layers.length === 1 &&
    page.layers[0].type === "raster" &&
    page.layers[0].strokes.length === 0;

  /* ── mobile: one page at a time (FR-2.3, FR-2.8) ───────────────────── */
  if (isMobile) {
    return (
      <div data-tour="canvas" className="flex min-h-0 flex-1 flex-col pb-[4.75rem]">
        {/* The canvas area is measured, not guessed: whatever height the
            shell leaves after the TopBar, page indicator, nav row and the
            fixed bottom tool rail (including dynamic mobile-browser chrome
            like the collapsing URL bar), the 9:16 page contain-fits into it
            — the full canvas is ALWAYS visible, never cropped or overflowing. */}
        <MobileFitCanvas
          page={mobilePage}
          welcome={mobilePage ? isPristinePage(mobilePage) : false}
        />
        {mobilePage && (
          <div className="flex shrink-0 items-center justify-center gap-2 px-3 pb-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-editor-dim">
              Page {activeIdx + 1} / {canvases.length}
            </p>
            <MobilePageMenu
              pageId={mobilePage.id}
              onConfirmDelete={setConfirmDelete}
            />
          </div>
        )}
        <div className="flex items-center justify-center gap-4 px-4 pb-4">
          <button
            type="button"
            aria-label="Previous page"
            disabled={activeIdx === 0}
            onClick={() => setActiveCanvas(canvases[activeIdx - 1].id)}
            className="grid h-11 w-14 place-items-center rounded-lg border border-editor-border-strong bg-editor-panel text-editor-text transition-colors duration-150 hover:border-night/25 active:bg-editor-raised disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Add a page"
            onClick={addCanvas}
            className="grid h-11 w-14 place-items-center rounded-lg bg-night text-white transition-colors duration-150 hover:bg-onyx active:bg-[#000]"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={activeIdx === canvases.length - 1}
            onClick={() => setActiveCanvas(canvases[activeIdx + 1].id)}
            className="grid h-11 w-14 place-items-center rounded-lg border border-editor-border-strong bg-editor-panel text-editor-text transition-colors duration-150 hover:border-night/25 active:bg-editor-raised disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <DeleteConfirmDialog
          pageId={confirmDelete}
          onClose={() => setConfirmDelete(null)}
        />
      </div>
    );
  }

  /* ── desktop/tablet: the continuous grid (FR-2.1/2.2) ──────────────── */
  return (
    <div data-tour="canvas" className="flex min-h-0 flex-1 flex-col">
      {/* filmstrip — slim page thumbnails for instant jumps in long books
          (3+ pages; scrolls horizontally, active page keeps itself in view) */}
      {canvases.length >= 3 && (
        <PageFilmstrip
          canvases={canvases}
          activeCanvasId={activeCanvasId}
          onSelect={setActiveCanvas}
          onReorder={reorderCanvas}
        />
      )}
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
      {/* subtle dot-grid — the quiet graph-paper feel of a real studio desk */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.055)_1px,transparent_1.5px)] [background-size:26px_26px]"
      />
      <div className="relative flex flex-wrap items-start justify-center gap-10 px-8 py-10">
        {canvases.map((page, i) => (
          <div
            key={page.id}
            data-page-idx={i}
            ref={(el) => {
              if (el) pageEls.current.set(page.id, el);
              else pageEls.current.delete(page.id);
            }}
            className="group relative"
          >
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open page ${i + 1}`}
                  aria-current={page.id === activeCanvasId}
                  onClick={() => setActiveCanvas(page.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveCanvas(page.id);
                    }
                  }}
                  className={cn(
                    "block cursor-pointer rounded-lg outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-[#155EEF]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-editor",
                    // inactive pages offer a quiet lift so "click to edit"
                    // reads before the first tap; the active page already
                    // wears its halo and stays anchored
                    page.id === activeCanvasId
                      ? ""
                      : "hover:-translate-y-1 motion-reduce:hover:translate-y-0"
                  )}
                >
                  <VirtualPageCanvas
                    page={page}
                    active={page.id === activeCanvasId}
                    welcome={isPristinePage(page)}
                    scrollerRef={scrollerRef}
                  />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="border-editor-border-strong bg-editor-panel text-editor-text">
                <ContextMenuItem
                  onClick={() => {
                    setActiveCanvas(page.id);
                    useEditorStore.getState().addTextLayer(CANVAS_W / 2, CANVAS_H / 2);
                    toast.success(`Text added to page ${i + 1}`);
                  }}
                >
                  <Type className="h-4 w-4" /> Add text here
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    duplicateCanvas(page.id);
                    toast.success("Page duplicated");
                  }}
                >
                  <Copy className="h-4 w-4" /> Duplicate page
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => setConfirmDelete(page.id)}
                  className="text-[#c73a56] focus:text-[#1047C7]"
                >
                  <Trash2 className="h-4 w-4" /> Delete page
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-editor-border" />
                <ContextMenuItem
                  disabled={i === 0}
                  onClick={() => setActiveCanvas(canvases[i - 1].id)}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous page
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={i === canvases.length - 1}
                  onClick={() => setActiveCanvas(canvases[i + 1].id)}
                >
                  <ChevronRight className="h-4 w-4" /> Next page
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-editor-border" />
                <ContextMenuItem
                  disabled={i === 0}
                  onClick={() => {
                    reorderCanvas(page.id, i - 1);
                    toast.success(`Page ${i + 1} moved to position ${i}`);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" /> Move page earlier
                </ContextMenuItem>
                <ContextMenuItem
                  disabled={i === canvases.length - 1}
                  onClick={() => {
                    reorderCanvas(page.id, i + 1);
                    toast.success(`Page ${i + 1} moved to position ${i + 2}`);
                  }}
                >
                  <ChevronRight className="h-4 w-4" /> Move page later
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            <div className="mt-3 flex items-center justify-between px-1">
              <span className="text-[11px] uppercase tracking-[0.2em] text-editor-dim">
                Page {i + 1}
              </span>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <PageActions pageId={page.id} onConfirmDelete={setConfirmDelete} />
              </div>
            </div>
          </div>
        ))}

        {/* add page */}
        <div className="flex flex-col items-center gap-3 pt-1">
          <button
            type="button"
            onClick={addCanvas}
            aria-label="Add a new page"
            className="group/add grid aspect-[9/16] w-[300px] place-items-center rounded-2xl border border-editor-border-strong bg-white/60 text-dim shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#155EEF]/60 hover:bg-[#155EEF]/[0.03] hover:text-night hover:shadow-[0_10px_30px_-10px_rgba(21,94,239,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/70 motion-reduce:hover:translate-y-0"
          >
            <span className="flex flex-col items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-editor-border-strong bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-all duration-300 group-hover/add:rotate-90 group-hover/add:border-[#155EEF]/70 group-hover/add:text-[#155EEF]">
                <Plus className="h-6 w-6 transition-transform duration-300" />
              </span>
              <span className="text-xs uppercase tracking-[0.2em]">Add page</span>
              <span className="text-[10px] tracking-wide text-editor-dim/70 transition-colors group-hover/add:text-editor-dim">
                Keep the story going
              </span>
            </span>
          </button>
        </div>
      </div>

      <DeleteConfirmDialog
        pageId={confirmDelete}
        onClose={() => setConfirmDelete(null)}
      />
      </div>
    </div>
  );
}

/* ── mobile canvas — measured contain-fit ─────────────────────────── */

/** The phone canvas area. A ResizeObserver measures the space the shell
 *  actually leaves (TopBar, indicator, nav row, fixed bottom rail, and the
 *  mobile browser's collapsing URL bar) and the 9:16 page contain-fits into
 *  it — replacing the old fixed `innerHeight - 210` guess that fought the
 *  wrapper's own `62vh` cap and cropped the canvas on many phones. */
function MobileFitCanvas({
  page,
  welcome,
}: {
  page: CanvasPageData | undefined;
  welcome: boolean;
}) {
  const fitRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      const fit = Math.floor(Math.min(w, (h * CANVAS_W) / CANVAS_H));
      setWidth((prev) => (Math.abs(prev - fit) > 0.5 ? fit : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={fitRef} className="flex min-h-0 flex-1 items-center justify-center px-3 pt-2">
      {page && width > 0 && (
        <PageCanvas key={page.id} page={page} active welcome={welcome} width={width} />
      )}
    </div>
  );
}

/* ── windowed page rendering (NFR-1) ───────────────────────────────── */

/** Books at or above this many pages render their grid windowed: pages far
 *  outside the scroll viewport mount as a cheap same-size placeholder and
 *  swap in ~900px before they enter view. Shorter books render every page
 *  directly — zero behavior change for the common case. */
const WINDOW_FROM = 12;
/** Filmstrip windowing threshold: books with at least this many pages swap
 *  offscreen chip thumbnails for same-size quiet placeholders. Chosen so the
 *  common case (short books) stays fully live; 28+ chips start to matter for
 *  initial composite time and the per-asset repaint fan-out. */
const FILMSTRIP_WINDOW_FROM = 28;

/** One grid page card with lazy mounting. The host wrapper always stays in
 *  the DOM (identical 300×533 box either way) so the observer never loses its
 *  target and the grid layout never shifts while cards swap. The active page
 *  never unmounts once mounted — gestures, text editors and previews that
 *  live inside the card must survive scrolling. */
function VirtualPageCanvas({
  page,
  active,
  welcome,
  scrollerRef,
}: {
  page: CanvasPageData;
  active: boolean;
  welcome: boolean;
  scrollerRef: RefObject<HTMLDivElement | null>;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(active);
  // Keep the observer's liveness check current (sanctioned pattern — refs
  // are updated in effects, never during render).
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const [near, setNear] = useState(false);
  const windowed = useEditorStore((s) => s.canvases.length >= WINDOW_FROM);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) setNear(en.isIntersecting || activeRef.current);
      },
      { root: scrollerRef.current ?? null, rootMargin: "900px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollerRef]);

  /* Short books render eagerly — no windowing, no placeholders, ever.
     The host wrapper renders in BOTH branches so the observer attaches on
     the very first mount: a book that later grows past the windowing
     threshold must not leave its early cards observer-less (and thus
     stuck on the placeholder). `near` keeps tracking either way, so the
     moment windowing turns on, every card already has the right state. */
  if (!windowed) {
    return (
      <div ref={hostRef}>
        <PageCanvas page={page} active={active} welcome={welcome} width={300} />
      </div>
    );
  }

  return (
    <div ref={hostRef}>
      {near ? (
        <PageCanvas page={page} active={active} welcome={welcome} width={300} />
      ) : (
        /* a resting page — same box, same ring and shadow language as a
           rendered card, but ghosted: dashed inner page, quiet center dot */
        <div
          aria-hidden="true"
          className="grid aspect-[9/16] w-[300px] place-items-center rounded-lg bg-night/[0.015] shadow-[0_18px_44px_-18px_rgba(0,0,0,0.18),0_4px_12px_-6px_rgba(0,0,0,0.07)] ring-1 ring-black/[0.08] transition-colors duration-300 hover:bg-night/[0.03]"
        >
          <span className="flex flex-col items-center gap-3">
            <span className="grid h-16 w-10 place-items-center rounded-[7px] border border-dashed border-[#c4c4c4]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b5b5b5]" />
            </span>
            <span className="text-[9px] font-medium uppercase tracking-[0.3em] text-editor-dim/60">
              resting
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

/* ── filmstrip — quick page jumps for long books ──────────────────────── */

/** Live mini page preview for a filmstrip chip. Repaints (debounced) when
 *  the page data changes, and again whenever async engine assets (uploaded
 *  photos, stickers, fonts) finish loading. Draws at 2× for crisp screens. */
function PageChipThumb({ page }: { page: CanvasPageData }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const paint = () => {
      if (!alive) return;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      const scale = el.width / CANVAS_W;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      renderPage(ctx, page);
    };
    // Debounce: strokes/edits mutate page identity rapidly — collapse repaints.
    const t = window.setTimeout(paint, 220);
    const unsub = onEngineContentLoaded(paint);
    return () => {
      alive = false;
      window.clearTimeout(t);
      unsub();
    };
  }, [page]);

  return (
    <canvas
      ref={ref}
      width={40}
      height={Math.round((40 * CANVAS_H) / CANVAS_W)}
      aria-hidden="true"
      className="h-8 w-[18px] shrink-0 rounded-[4px] bg-white ring-1 ring-inset ring-black/25 transition-transform duration-200 group-hover:scale-110"
    />
  );
}

/** One filmstrip chip. In long books (windowed) the live thumbnail only
 *  renders while the chip is within the strip scroller's viewport ±640px —
 *  far-away chips show a same-size quiet ghost so the strip keeps its exact
 *  geometry (scroll offsets, drop-slot math and edge autoscroll all depend
 *  on children keeping their rects). */
function FilmstripChip({
  page,
  i,
  active,
  dragging,
  dropIdx,
  fromIdx,
  windowed,
  scrollerRef,
  onSelect,
  onDropIdx,
  onDragChip,
  onDragEnd,
}: {
  page: CanvasPageData;
  i: number;
  active: boolean;
  dragging: boolean;
  dropIdx: number | null;
  fromIdx: number;
  windowed: boolean;
  scrollerRef: RefObject<HTMLOListElement | null>;
  onSelect: (id: string) => void;
  onDropIdx: (idx: number) => void;
  onDragChip: (id: string) => void;
  onDragEnd: () => void;
}) {
  const hostRef = useRef<HTMLLIElement | null>(null);
  const [near, setNear] = useState(!windowed);

  useEffect(() => {
    // The observer attaches even while unwindowed (same lesson as the grid's
    // Round 14 fix): when a short book grows past the threshold, every chip
    // already knows whether it is near — no stuck placeholders.
    const host = hostRef.current;
    const root = scrollerRef.current;
    if (!host || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setNear(entry.isIntersecting);
      },
      { root, rootMargin: "640px" }
    );
    io.observe(host);
    return () => io.disconnect();
  }, [scrollerRef]);

  return (
    <li
      ref={hostRef}
      className="relative shrink-0"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        onDropIdx(e.clientX > rect.left + rect.width / 2 ? i + 1 : i);
      }}
    >
      {/* insertion indicator — a fine accent seam between chips.
          One seam = one bar: the right edge of the chip before the
          slot (plus a left bar only before the very first chip). */}
      {dropIdx === i && i === 0 && (
        <span
          aria-hidden="true"
          className="absolute -left-[5px] top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full bg-[#155EEF] shadow-[0_0_8px_rgba(21,94,239,0.7)]"
        />
      )}
      {dropIdx === i + 1 && !(dragging && i === fromIdx) && (
        <span
          aria-hidden="true"
          className="absolute -right-[5px] top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full bg-[#155EEF] shadow-[0_0_8px_rgba(21,94,239,0.7)]"
        />
      )}
      <button
        type="button"
        aria-label={`Go to page ${i + 1}`}
        aria-current={active}
        onClick={() => onSelect(page.id)}
        title={`Page ${i + 1} — drag to reorder`}
        draggable
        onDragStart={(e) => {
          onDragChip(page.id);
          e.dataTransfer.effectAllowed = "move";
          // Firefox requires data for drag to start at all.
          e.dataTransfer.setData("text/plain", page.id);
        }}
        onDragEnd={onDragEnd}
        className={cn(
          "group relative flex h-11 items-center gap-1.5 rounded-full border px-3 text-[11px] tabular-nums transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#155EEF]",
          dragging
            ? "cursor-grabbing border-[#155EEF]/60 bg-[#155EEF]/10 opacity-40"
            : "cursor-grab active:cursor-grabbing",
          dragging
            ? ""
            : active
              ? "border-[#155EEF]/70 bg-[#155EEF]/10 text-editor-text shadow-[0_0_12px_-4px_rgba(21,94,239,0.4)]"
              : "border-editor-border-strong text-editor-dim hover:border-dim/50 hover:bg-editor-raised hover:text-editor-text"
        )}
      >
        {/* live mini page preview — the whole page at a glance (ghosted
            while far away in windowed strips, same 18px footprint) */}
        {near ? (
          <PageChipThumb page={page} />
        ) : (
          <span
            aria-hidden="true"
            className="h-8 w-[18px] shrink-0 rounded-[4px] bg-[#ececec] bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(0,0,0,0.04)_3px_6px)] ring-1 ring-inset ring-black/10"
          />
        )}
        {i + 1}
        {/* reorder affordance — appears on hover, whisper-quiet */}
        <GripHorizontal
          aria-hidden="true"
          className="h-3 w-3 text-editor-dim/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        />
      </button>
    </li>
  );
}

function PageFilmstrip({
  canvases,
  activeCanvasId,
  onSelect,
  onReorder,
}: {
  canvases: CanvasPageData[];
  activeCanvasId: string;
  onSelect: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
}) {
  const listRef = useRef<HTMLOListElement | null>(null);
  /* drag state — which chip is being carried, and the insertion slot
     (an index BETWEEN chips: 0 = before page 1, n = after page n). */
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const edgeScroll = useRef<number | null>(null);

  const fromIdx = dragId ? canvases.findIndex((c) => c.id === dragId) : -1;
  // Window the chips for long books: beyond FILMSTRIP_WINDOW_FROM pages only
  // chips near the viewport render their live thumbnails; the rest render a
  // same-size quiet placeholder (Round 15 rec c — render work stays
  // proportional to what is visible, not to the book's length).
  const windowed = canvases.length >= FILMSTRIP_WINDOW_FROM;

  const clearDrag = useCallback(() => {
    setDragId(null);
    setDropIdx(null);
    if (edgeScroll.current !== null) {
      window.clearInterval(edgeScroll.current);
      edgeScroll.current = null;
    }
  }, []);

  // Keep the active thumbnail visible when the page changes (keyboard nav,
  // context menu, layer panel — they all land here).
  useEffect(() => {
    const idx = canvases.findIndex((c) => c.id === activeCanvasId);
    if (idx < 0 || !listRef.current) return;
    const item = listRef.current.children[idx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeCanvasId, canvases]);

  // Nudge the strip sideways while a chip is dragged near either edge.
  const startEdgeScroll = (dir: -1 | 0 | 1) => {
    if (dir === 0) {
      if (edgeScroll.current !== null) {
        window.clearInterval(edgeScroll.current);
        edgeScroll.current = null;
      }
      return;
    }
    if (edgeScroll.current !== null) return;
    edgeScroll.current = window.setInterval(() => {
      listRef.current?.scrollBy({ left: dir * 9, behavior: "instant" as ScrollBehavior });
    }, 16);
  };

  useEffect(() => () => {
    if (edgeScroll.current !== null) window.clearInterval(edgeScroll.current);
  }, []);

  /** Resolve the insertion slot (0..n) from a pointer X — self-sufficient,
      so the drop never depends on the last dragover having flushed state. */
  const computeDropIndex = (clientX: number): number => {
    const items = listRef.current?.children;
    if (!items) return 0;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) return i;
    }
    return items.length;
  };

  return (
    <nav
      aria-label="Jump to page"
      className="z-10 flex shrink-0 items-center gap-2 border-b border-editor-border bg-editor-panel/60 px-4 py-2 backdrop-blur-sm"
    >
      <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-editor-dim lg:inline">
        Pages
      </span>
      <ol
        ref={listRef}
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:thin]"
        onDragLeave={(e) => {
          // Leaving the strip entirely clears the indicator (child hops
          // between chips fire dragleave too — only react to the parent).
          if (e.currentTarget === e.target) setDropIdx(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const zone = 36;
          if (e.clientX < rect.left + zone) startEdgeScroll(-1);
          else if (e.clientX > rect.right - zone) startEdgeScroll(1);
          else startEdgeScroll(0);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId && fromIdx !== -1) {
            // Convert the between-slot into an insert index for the
            // post-removal array (slots right of the source shift by one).
            const slot = computeDropIndex(e.clientX);
            const to = fromIdx < slot ? slot - 1 : slot;
            if (to !== fromIdx) onReorder(dragId, to);
          }
          clearDrag();
        }}
        onDragEnd={clearDrag}
      >
        {canvases.map((page, i) => (
          <FilmstripChip
            key={page.id}
            page={page}
            i={i}
            active={page.id === activeCanvasId}
            dragging={page.id === dragId}
            dropIdx={dropIdx}
            fromIdx={fromIdx}
            windowed={windowed}
            scrollerRef={listRef}
            onSelect={onSelect}
            onDropIdx={setDropIdx}
            onDragChip={setDragId}
            onDragEnd={clearDrag}
          />
        ))}
      </ol>
      {dragId && (
        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[#155EEF]/80">
          Drop to reorder
        </span>
      )}
    </nav>
  );
}

function PageActions({
  pageId,
  onConfirmDelete,
}: {
  pageId: string;
  onConfirmDelete: (id: string) => void;
}) {
  const duplicateCanvas = useEditorStore((s) => s.duplicateCanvas);
  return (
    <>
      <button
        type="button"
        aria-label="Duplicate this page"
        title="Duplicate page"
        onClick={(e) => {
          e.stopPropagation();
          duplicateCanvas(pageId);
          toast.success("Page duplicated");
        }}
        className="grid h-7 w-7 place-items-center rounded-md text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Delete this page"
        title="Delete page"
        onClick={(e) => {
          e.stopPropagation();
          onConfirmDelete(pageId);
        }}
        className="grid h-7 w-7 place-items-center rounded-md text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </>
  );
}

/** Mobile page menu (FR-1.3/1.4 parity): duplicate + confirm-then-delete. */
function MobilePageMenu({
  pageId,
  onConfirmDelete,
}: {
  pageId: string;
  onConfirmDelete: (id: string) => void;
}) {
  const duplicateCanvas = useEditorStore((s) => s.duplicateCanvas);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Page options"
          className="grid h-6 w-6 place-items-center rounded-md text-editor-dim transition hover:bg-editor-raised hover:text-editor-text"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="border-editor-border-strong bg-editor-panel text-editor-text"
      >
        <DropdownMenuItem
          onClick={() => {
            duplicateCanvas(pageId);
            toast.success("Page duplicated");
          }}
        >
          <Copy className="h-4 w-4" /> Duplicate page
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-[#c73a56] focus:text-[#1047C7]"
          onClick={() => onConfirmDelete(pageId)}
        >
          <Trash2 className="h-4 w-4" /> Delete page
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteConfirmDialog({
  pageId,
  onClose,
}: {
  pageId: string | null;
  onClose: () => void;
}) {
  const deleteCanvas = useEditorStore((s) => s.deleteCanvas);
  const canvases = useEditorStore((s) => s.canvases);
  const idx = canvases.findIndex((c) => c.id === pageId);
  return (
    <AlertDialog
      open={!!pageId}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent className="border-editor-border bg-editor-panel text-editor-text">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">
            Delete page {idx >= 0 ? idx + 1 : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-editor-dim">
            This removes the page and its layers from your book. You can still
            undo right after.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-editor-border bg-transparent text-editor-text hover:bg-editor-raised hover:text-editor-text">
            Keep it
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pageId) deleteCanvas(pageId);
              toast.success("Page deleted");
              onClose();
            }}
            className="bg-[#c73a56] text-white hover:bg-[#1047C7]"
          >
            Delete page
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
