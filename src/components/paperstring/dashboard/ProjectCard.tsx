"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BookOpen,
  Copy,
  CopyPlus,
  Eye,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";

import type { ProjectSummary } from "@/lib/paperstring/types";
import { psNavigate } from "@/lib/paperstring/navigation";
import { LogoMark } from "@/components/paperstring/brand";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ProjectCard({
  project,
  index = 0,
}: {
  project: ProjectSummary;
  index?: number;
}) {
  const { id, title, coverImage, pageCount, shareToken, updatedAt } = project;
  const queryClient = useQueryClient();

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const openInEditor = () => psNavigate("editor", { project: id });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["projects"] });

  const copyShareLink = async () => {
    if (!shareToken) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/?view=viewer&s=${shareToken}`
      );
      toast.success("Link copied — send it to someone special");
    } catch {
      toast.error("Couldn't copy the link — your browser blocked access");
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = newTitle.trim();
    if (!next || renaming) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      let json: { project?: unknown; error?: string } | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!res.ok || !json?.project) {
        throw new Error(json?.error ?? "Couldn't rename the book");
      }
      setRenameOpen(false);
      await refresh();
      toast.success("Book renamed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename the book");
    } finally {
      setRenaming(false);
    }
  };

  const handleDuplicate = async () => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      let json: { project?: ProjectSummary; error?: string } | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!res.ok || !json?.project) {
        throw new Error(json?.error ?? "Couldn't duplicate the book");
      }
      await refresh();
      toast.success("Book duplicated — the original stays safe");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't duplicate the book");
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        let json: { error?: string } | null = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        throw new Error(json?.error ?? "Couldn't delete the book");
      }
      setDeleteOpen(false);
      await refresh();
      toast.success("Book deleted");
    } catch (err) {
      setDeleteOpen(false);
      toast.error(err instanceof Error ? err.message : "Couldn't delete the book");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
      role="button"
      tabIndex={0}
      aria-label={`Open ${title}`}
      onClick={(e) => {
        // Only navigate when the click physically lands inside this card in the
        // DOM. Portaled overlays (rename/delete dialogs, open menus) are
        // React-tree children but live outside this node in the DOM, so their
        // clicks never trigger navigation (React synthetic events bubble
        // through the React tree, not the DOM tree).
        if (!e.currentTarget.contains(e.target as Node)) return;
        openInEditor();
      }}
      onKeyDown={(e) => {
        // Only react when the card itself has focus — never steal Enter/Space
        // from inner controls (e.g. typing in the rename field).
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openInEditor();
        }
      }}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-silver/30 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {/* Cover */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={`Cover of ${title}`}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-smoke to-silver/30 dark:from-onyx/50 dark:to-night">
            <LogoMark
              className="h-12 w-auto text-dim/50 dark:text-silver/60"
              strokeWidth={3.8}
            />
            <span className="sr-only">No cover yet</span>
          </div>
        )}

        {/* Hover veil + Open pill */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-night/0 transition-colors duration-300 group-hover:bg-night/10"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <span className="rounded-full bg-night/85 px-4 py-2 text-sm font-medium text-smoke backdrop-blur">
            Open
          </span>
        </div>

        {/* Card menu */}
        <div
          className="absolute right-2 top-2 z-10"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`More options for ${title}`}
                className="size-8 rounded-full bg-paper/80 text-night opacity-100 shadow-sm backdrop-blur transition hover:bg-paper focus-visible:opacity-100 dark:bg-onyx/80 dark:text-smoke dark:hover:bg-onyx lg:opacity-0 lg:group-hover:opacity-100"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={openInEditor}>
                <BookOpen />
                Open
              </DropdownMenuItem>
              {shareToken && (
                <>
                  <DropdownMenuItem
                    onClick={() => psNavigate("viewer", { s: shareToken })}
                  >
                    <Eye />
                    View as recipient
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyShareLink}>
                    <Copy />
                    Copy share link
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setNewTitle(title);
                  setRenameOpen(true);
                }}
              >
                <Pencil />
                Rename…
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDuplicate}
                disabled={duplicating}
              >
                {duplicating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CopyPlus />
                )}
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 />
                Delete…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="truncate font-display text-lg font-semibold tracking-tight">
          {title}
        </h3>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="truncate text-xs text-dim dark:text-silver/80">
            {pageCount} {pageCount === 1 ? "page" : "pages"} · Updated{" "}
            {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
          </p>
          {shareToken ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-night px-2 py-0.5 text-[11px] font-medium text-smoke dark:bg-onyx dark:ring-1 dark:ring-silver/30">
              Shared
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full border border-silver/50 px-2 py-0.5 text-[11px] font-medium text-dim dark:text-silver/80">
              Private
            </span>
          )}
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) setNewTitle(title);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Rename book</DialogTitle>
            <DialogDescription>
              Give &ldquo;{title}&rdquo; a new name.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`rename-${id}`}>Title</Label>
              <Input
                id={`rename-${id}`}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                maxLength={80}
                autoFocus
                aria-label="Book title"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
                disabled={renaming}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={renaming || !newTitle.trim() || newTitle.trim() === title}
              >
                {renaming && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete &ldquo;{title}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the book and its share link. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className={cn(
                "bg-destructive text-white hover:bg-destructive/90",
                deleting && "opacity-70"
              )}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Delete book
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
