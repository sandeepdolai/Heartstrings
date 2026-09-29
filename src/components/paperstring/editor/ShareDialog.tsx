"use client";

/**
 * ShareDialog (FR-1.6, FR-1.10, §6 Save & Share flow) — the publishing pipeline:
 * save the project → render every canvas to a 4K PNG master → POST the publish
 * endpoint → present the shareable URL. Every stage shows clear progress /
 * success / failure states; a failure is never presented as published.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEditorStore } from "@/lib/paperstring/editor-store";
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

type Stage = "preparing" | "saving" | "rendering" | "publishing" | "ready" | "error";

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
      const pages: string[] = [];
      for (let i = 0; i < canvases.length; i++) {
        const png = await renderPageToPublishPng(canvases[i]);
        if (!alive()) return;
        pages.push(png);
        setDone(i + 1);
        // let the progress bar paint between pages
        await new Promise((r) => setTimeout(r, 16));
      }

      // 3 — publish (server stores only the rendered pages — SEP-3)
      setStage("publishing");
      const res = await fetch(`/api/projects/${projectId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages,
          // keep the existing cover when this session didn't render one
          ...(saved.coverImage ? { coverImage: saved.coverImage } : {}),
          // keep the link stable across republishes; the pages update in place
          regenerate: false,
        }),
      });
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
    startedRef.current = true;
    void run();
  }, [open, run]);

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

  const busy = stage === "saving" || stage === "rendering" || stage === "publishing";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy && !o) return; // don't abandon a publish midway
        onOpenChange(o);
      }}
    >
      <DialogContent className="border-editor-border-strong bg-editor-panel text-editor-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg text-editor-text">
            {stage === "ready" ? "Your book is ready to share" : "Sharing your book"}
          </DialogTitle>
          <DialogDescription className="text-editor-dim">
            {stage === "ready"
              ? "Send this link to someone you love — it opens straight into the flipbook."
              : "We save your pages, prepare every canvas in 4K, then create the link."}
          </DialogDescription>
        </DialogHeader>

        {busy && (
          <div className="flex flex-col gap-4 py-2" aria-live="polite">
            <div className="flex items-center gap-3 text-sm text-editor-text">
              <Loader2 className="h-4 w-4 animate-spin text-editor-dim" />
              {stage === "saving" && "Saving your book…"}
              {stage === "rendering" && (
                <span>
                  Preparing page {Math.min(done + 1, total)} of {total} in 4K…
                </span>
              )}
              {stage === "publishing" && "Publishing…"}
            </div>
            <Progress
              value={stage === "rendering" ? (done / total) * 100 : 8}
              className="h-1.5 bg-editor-raised"
            />
            <p className="text-xs text-editor-dim">
              High quality is always on — this can take a moment for long books.
            </p>
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
                    ? "bg-[#7cc47f] text-night hover:bg-[#8fd492]"
                    : "bg-smoke text-night hover:bg-white"
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
              className="rounded-xl border border-[#f08ca0]/40 bg-[#f08ca0]/10 px-3 py-2.5 text-xs leading-relaxed text-[#f5b8c8]"
            >
              {error}
            </p>
            <Button
              onClick={() => void run()}
              className="justify-center gap-2 rounded-xl bg-smoke text-night hover:bg-white"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
