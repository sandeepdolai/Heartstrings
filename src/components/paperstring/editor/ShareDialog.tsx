"use client";

/**
 * ShareDialog (FR-1.6, FR-1.10, §6 Save & Share flow) — the publishing pipeline:
 * save the project → render every canvas to a 4K PNG master → upload the pages
 * → present the shareable URL. Every stage shows clear progress / success /
 * failure states; a failure is never presented as published.
 *
 * Long books publish in chunks: pages are rendered one at a time and streamed
 * to a server-side staging session (start → chunk… → finish), so neither the
 * browser nor the request body ever holds the whole book. Short books keep
 * the single-shot endpoint. The dialog can be cancelled midway — nothing is
 * written until the final call.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Heart, Link2, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEditorStore } from "@/lib/paperstring/editor-store";
import type { CanvasPageData, RasterLayer } from "@/lib/paperstring/types";
import { renderPageToPublishPng } from "@/lib/paperstring/render";
import { psNavigate } from "@/lib/paperstring/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

type Stage = "preparing" | "empty" | "saving" | "rendering" | "uploading" | "publishing" | "ready" | "error";

/** Books up to this many pages use the legacy single-shot publish. */
const LEGACY_MAX = 3;
/** Pages streamed per chunk request in the chunked pipeline. */
const CHUNK_SIZE = 3;

/** Does this page carry anything the viewer would see? Raster layers count
 *  only with strokes; any visible text/sticker/photo layer counts; a tinted
 *  background (anything but plain white) is intentional design, not blank. */
function pageHasContent(page: CanvasPageData): boolean {
  if (page.background && page.background.toUpperCase() !== "#FFFFFF") return true;
  return page.layers.some((l) => {
    if (!l.visible || l.opacity === 0) return false;
    if (l.type === "raster") return ((l as RasterLayer).strokes?.length ?? 0) > 0;
    return true; // text / sticker / image layers are content by existing
  });
}

export function ShareDialog({
  open,
  onOpenChange,
  projectId,
  /** EditorView's save() — persists the project and returns the fresh cover. */
  performSave: performSaveProp,
  /** Called with the (possibly new) share token once published. */
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  performSave: () => Promise<{ ok: boolean; coverImage?: string }>;
  onPublished?: (token: string) => void;
}) {
  const [stage, setStage] = useState<Stage>("preparing");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const runRef = useRef(0);
  const startedRef = useRef(false);

  const run = useCallback(async () => {
    const runId = ++runRef.current;
    const alive = () => runRef.current === runId;
    setError(null);
    setCopied(false);
    setDetail(null);
    setStage("saving");

    try {
      // 1 — save the project (returns the freshly rendered cover)
      const saved = await performSaveProp();
      if (!alive()) return;
      if (!saved.ok) throw new Error("save-failed");

      // 2 — render every canvas to a 4K PNG master (FR-Q.2)
      const { canvases } = useEditorStore.getState();
      setTotal(canvases.length);
      setDone(0);
      setStage("rendering");

      const cover = saved.coverImage ? { coverImage: saved.coverImage } : {};

      if (canvases.length <= LEGACY_MAX) {
        // Short book — one request, exactly like before.
        const pages: string[] = [];
        for (let i = 0; i < canvases.length; i++) {
          setDetail(`Preparing page ${i + 1} of ${canvases.length} in 4K…`);
          const png = await renderPageToPublishPng(canvases[i]);
          if (!alive()) return;
          pages.push(png);
          setDone(i + 1);
          // let the progress bar paint between pages
          await new Promise((r) => setTimeout(r, 16));
        }

        setStage("publishing");
        const res = await fetch(`/api/projects/${projectId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages, ...cover, regenerate: false }),
        });
        await consumePublishResponse(res, alive, setToken, setShareUrl, setStage, onPublished);
      } else {
        // Long book — chunked pipeline: render a few pages, send them, let go.
        const startRes = await fetch(`/api/projects/${projectId}/publish/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!alive()) return;
        if (!startRes.ok) throw new Error("start-failed");
        const { publishId } = (await startRes.json()) as { publishId: string };

        const buffer: string[] = [];
        for (let i = 0; i < canvases.length; i++) {
          setDetail(`Preparing page ${i + 1} of ${canvases.length} in 4K…`);
          const png = await renderPageToPublishPng(canvases[i]);
          if (!alive()) return;
          buffer.push(png);

          if (buffer.length === CHUNK_SIZE || i === canvases.length - 1) {
            const from = i + 1 - buffer.length + 1;
            setDetail(`Sending page ${from}${buffer.length > 1 ? `–${i + 1}` : ""} of ${canvases.length}…`);
            setStage("uploading");
            const chunkRes = await fetch(`/api/projects/${projectId}/publish/chunk`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ publishId, pages: buffer }),
            });
            if (!alive()) return;
            if (!chunkRes.ok) throw new Error("chunk-failed");
            const { received } = (await chunkRes.json()) as { received: number };
            buffer.length = 0; // release the memory
            setDone(received);
            setStage("rendering");
            // let the progress bar paint between chunks
            await new Promise((r) => setTimeout(r, 16));
          }
        }

        setDetail(null);
        setStage("publishing");
        const finishRes = await fetch(`/api/projects/${projectId}/publish/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publishId, ...cover, regenerate: false }),
        });
        await consumePublishResponse(finishRes, alive, setToken, setShareUrl, setStage, onPublished);
      }

      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (err) {
      if (!alive()) return;
      console.error("[share]", err);
      setError(
        err instanceof Error && err.message === "save-failed"
          ? "We could not save your book before sharing. Check your connection and try again."
          : "Something went wrong while preparing your book. Nothing was lost — try again."
      );
      setStage("error");
    }
  }, [performSaveProp, projectId, queryClient, onPublished]);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return;
    }
    // StrictMode double-invokes effects in dev — start the pipeline once per
    // dialog session (explicit retries call run() directly).
    if (startedRef.current) return;
    // Empty-book guard (live bug report: a link that opened on blank pages
    // with no warning). If no page carries visible content, stop BEFORE the
    // pipeline and say so — the recipient would see blank pages. Sharing is
    // still possible, but only as an explicit choice.
    const { canvases } = useEditorStore.getState();
    if (!canvases.some(pageHasContent)) {
      setStage("empty");
      return;
    }
    startedRef.current = true;
    void run();
  }, [open, run]);

  /** Abort the pipeline and close — nothing reaches the share link. */
  const cancel = useCallback(() => {
    runRef.current++; // invalidate the running pipeline
    onOpenChange(false);
    toast.info("Publishing stopped — your book was not shared.");
  }, [onOpenChange]);

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Share link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — long-press the link to copy it instead");
    }
  };

  const busy = stage === "saving" || stage === "rendering" || stage === "uploading" || stage === "publishing";

  const progressValue =
    stage === "saving"
      ? 8
      : stage === "publishing"
        ? 96
        : stage === "ready"
          ? 100
          : 8 + (total > 0 ? (done / total) * 84 : 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy && !o) return; // don't abandon a publish midway (use Cancel)
        onOpenChange(o);
      }}
    >
      <DialogContent className="border-editor-border-strong bg-editor-panel text-editor-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg text-editor-text">
            {stage === "ready" ? (
              <span className="inline-flex items-center gap-2">
                Your book is ready to share
                <Heart
                  className="h-4 w-4 shrink-0 text-[#155EEF]"
                  fill="currentColor"
                  strokeWidth={0}
                  aria-hidden="true"
                />
              </span>
            ) : stage === "empty" ? (
              "This book looks empty"
            ) : (
              "Sharing your book"
            )}
          </DialogTitle>
          <DialogDescription className="text-editor-dim">
            {stage === "ready"
              ? "Send this link to someone you love — it opens straight into the flipbook."
              : stage === "empty"
                ? "None of the pages have anything on them yet."
                : "We save your pages, prepare every canvas in 4K, then create the link."}
          </DialogDescription>
        </DialogHeader>

        {stage === "empty" && (
          <div className="flex flex-col gap-4 py-1">
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-[#e8a13a]/30 bg-[#e8a13a]/[0.07] px-3.5 py-3"
            >
              <TriangleAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-[#c07d1d]"
                aria-hidden="true"
              />
              <p className="text-xs leading-relaxed text-[#9a6a17]">
                Every page is blank right now — a shared link would open on
                empty pages with nothing on them. Add a sticker, a line or a
                photo first, then share.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border-editor-border-strong bg-transparent text-editor-text hover:bg-editor-raised hover:text-editor-text"
              >
                Keep editing
              </Button>
              <Button
                onClick={() => {
                  startedRef.current = true;
                  void run();
                }}
                className="rounded-xl bg-night text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.3)] hover:bg-onyx active:scale-[0.98]"
              >
                Share anyway
              </Button>
            </div>
          </div>
        )}

        {busy && (
          <div className="flex flex-col gap-4 py-2" aria-live="polite">
            <div className="flex items-center gap-3 text-sm text-editor-text">
              <Loader2 className="h-4 w-4 animate-spin text-editor-dim" />
              {stage === "saving" && "Saving your book…"}
              {stage === "rendering" && (
                <span>{detail ?? `Preparing page ${Math.min(done + 1, total)} of ${total} in 4K…`}</span>
              )}
              {stage === "uploading" && <span>{detail ?? "Sending your pages…"}</span>}
              {stage === "publishing" && "Publishing…"}
            </div>
            <Progress value={progressValue} className="h-1.5 bg-editor-raised" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-editor-dim">
                {total > LEGACY_MAX
                  ? "Long books are sent page by page — high quality is always on."
                  : "High quality is always on — this can take a moment for long books."}
              </p>
              <button
                type="button"
                onClick={cancel}
                className="shrink-0 rounded-md border border-editor-border-strong px-3 py-1 text-[11px] font-medium text-editor-dim transition hover:bg-editor-raised hover:text-editor-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {stage === "ready" && shareUrl && (
          <div className="flex flex-col gap-4 py-1">
            <div className="flex items-center gap-2">
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-editor-border-strong bg-editor px-3">
                <Link2 className="mr-2 h-4 w-4 shrink-0 text-editor-dim" />
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  aria-label="Shareable link"
                  className="w-full min-w-0 bg-transparent text-xs text-editor-text outline-none"
                />
              </div>
              <Button
                onClick={copy}
                className={cn(
                  "h-11 shrink-0 gap-1.5 rounded-xl px-4",
                  copied
                    ? "bg-[#5da661] text-white hover:bg-[#6cb571]"
                    : "bg-night text-white hover:bg-onyx"
                )}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs leading-relaxed text-editor-dim">
              Anyone with this link can view — no account needed. Future edits
              appear after you share again.
            </p>
            <Button
              variant="outline"
              onClick={() => token && psNavigate("viewer", { s: token })}
              className="justify-center rounded-xl border-editor-border-strong bg-transparent text-editor-text hover:bg-editor-raised hover:text-editor-text"
            >
              Open the book as they&apos;ll see it
            </Button>
          </div>
        )}

        {stage === "error" && (
          <div className="flex flex-col gap-3 py-1">
            <p
              role="alert"
              className="rounded-xl border border-[#155EEF]/30 bg-[#155EEF]/[0.06] px-3 py-2.5 text-xs leading-relaxed text-[#1047C7]"
            >
              {error}
            </p>
            <Button
              onClick={() => void run()}
              className="justify-center gap-2 rounded-xl bg-night text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.3)] hover:bg-onyx active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Shared tail of both pipelines: read the token, or surface the failure. */
async function consumePublishResponse(
  res: Response,
  alive: () => boolean,
  setToken: (t: string) => void,
  setShareUrl: (u: string) => void,
  setStage: (s: Stage) => void,
  onPublished?: (token: string) => void
): Promise<void> {
  if (!alive()) return;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "publish-failed");
  }
  const { shareToken: token } = (await res.json()) as { shareToken: string };
  setToken(token);
  setShareUrl(`${window.location.origin}/?view=viewer&s=${token}`);
  setStage("ready");
  onPublished?.(token);
}
