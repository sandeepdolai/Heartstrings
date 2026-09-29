"use client";

/**
 * CanvasWorkspace — the shared grid workspace (FR-2.1/2.2): all canvases in
 * one continuous scrollable grid on desktop/tablet; one page at a time with
 * prev/next controls + "Page 2 / 5" indicator on mobile (FR-2.3). Page
 * changes are always instant — no flip animations (FR-2.4, OOS-4).
 */

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import { PageCanvas } from "./PageCanvas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  const [isMobile, setIsMobile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const activeIdx = Math.max(
    0,
    canvases.findIndex((c) => c.id === activeCanvasId)
  );
  const mobilePage = canvases[activeIdx] ?? canvases[0];

  /* ── mobile: one page at a time (FR-2.3, FR-2.8) ───────────────────── */
  if (isMobile) {
    return (
      <div className="flex min-h-0 flex-1 flex-col pb-[4.75rem]">
        <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-2">
          {mobilePage && (
            <div className="w-full" style={{ maxWidth: "min(100%, 62vh * 9 / 16)" }}>
              <PageCanvas
                key={mobilePage.id}
                page={mobilePage}
                active
                width={Math.min(
                  typeof window !== "undefined" ? window.innerWidth - 24 : 360,
                  ((typeof window !== "undefined" ? window.innerHeight : 800) - 210) *
                    (9 / 16)
                )}
              />
              <div className="mt-3 flex items-center justify-center gap-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-editor-dim">
                  Page {activeIdx + 1} / {canvases.length}
                </p>
                <MobilePageMenu
                  pageId={mobilePage.id}
                  onConfirmDelete={setConfirmDelete}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-8 pb-4">
          <button
            type="button"
            aria-label="Previous page"
            disabled={activeIdx === 0}
            onClick={() => setActiveCanvas(canvases[activeIdx - 1].id)}
            className="grid h-11 w-11 place-items-center rounded-full border border-editor-border-strong text-editor-text transition hover:bg-editor-raised disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Add a page"
            onClick={addCanvas}
            className="grid h-11 w-11 place-items-center rounded-full bg-editor-raised text-editor-text transition hover:bg-editor-border-strong"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={activeIdx === canvases.length - 1}
            onClick={() => setActiveCanvas(canvases[activeIdx + 1].id)}
            className="grid h-11 w-11 place-items-center rounded-full border border-editor-border-strong text-editor-text transition hover:bg-editor-raised disabled:opacity-30"
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
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-center gap-10 px-8 py-10">
        {canvases.map((page, i) => (
          <div key={page.id} className="group relative">
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
              className="block cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#e8446a]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-editor"
            >
              <PageCanvas page={page} active={page.id === activeCanvasId} width={300} />
            </div>
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
            className="grid aspect-[9/16] w-[300px] place-items-center rounded-lg border-2 border-dashed border-editor-border-strong text-editor-dim transition hover:border-[#e8446a]/60 hover:text-editor-text"
          >
            <span className="flex flex-col items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-current">
                <Plus className="h-6 w-6" />
              </span>
              <span className="text-xs uppercase tracking-[0.2em]">Add page</span>
            </span>
          </button>
        </div>
      </div>

      <DeleteConfirmDialog
        pageId={confirmDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
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
          className="text-[#f08ca0] focus:text-[#f5a8bb]"
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
            className="bg-[#c73a56] text-white hover:bg-[#b2334c]"
          >
            Delete page
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
