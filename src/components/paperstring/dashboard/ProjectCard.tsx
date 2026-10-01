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
  variant = "grid",
}: {
  project: ProjectSummary;
  index?: number;
  /** "grid" — cover card in the shelf grid; "list" — hairline table row. */
  variant?: "grid" | "list";
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

  /* Shared pieces — the actions menu and both dialogs are identical in
     every layout; only the chrome around them changes. */
  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`More options for ${title}`}
          className="size-8 rounded-md text-dim transition-colors duration-150 hover:bg-smoke hover:text-night focus-visible:opacity-100"
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
  );

  const stopProp = {
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
  };

  /** Meta line shared by both layouts — "Edited 3 days ago · 4 pages". */
  const metaLine = (
    <>
      <span className="truncate">
        Edited {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
      </span>
      <span aria-hidden="true" className="text-silver">
        ·
      </span>
      <span className="shrink-0 tabular-nums">
        {pageCount} {pageCount === 1 ? "page" : "pages"}
      </span>
    </>
  );

  const sharedChip = shareToken ? (
    <span className="inline-flex shrink-0 items-center rounded-md bg-heart/10 px-2 py-0.5 text-[11px] font-medium text-heart-deep ring-1 ring-inset ring-heart/25">
      Shared
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-md border border-silver px-2 py-0.5 text-[11px] font-medium text-dim">
      Private
    </span>
  );

  const sharedDialogs = (
    <>
      {/* Rename dialog */}
      <RenameDialog
        id={id}
        title={title}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        renameOpen={renameOpen}
        setRenameOpen={setRenameOpen}
        renaming={renaming}
        onSubmit={handleRename}
      />

      {/* Delete confirmation */}
      <DeleteDialog
        title={title}
        deleteOpen={deleteOpen}
        setDeleteOpen={setDeleteOpen}
        deleting={deleting}
        onDelete={handleDelete}
      />
    </>
  );

  if (variant === "list") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.24) }}
        role="button"
        tabIndex={0}
        aria-label={`Open ${title}`}
        onClick={(e) => {
          if (!e.currentTarget.contains(e.target as Node)) return;
          openInEditor();
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openInEditor();
          }
        }}
        className="group flex cursor-pointer items-center gap-4 border-b border-silver px-2 py-3 transition-colors duration-150 hover:bg-smoke/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {/* thumb */}
        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-[4px] border border-silver bg-smoke">
          {coverImage ? (
            <img
              src={coverImage}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <LogoMark
                className="h-4 w-auto text-dim/50"
                strokeWidth={4}
              />
              <span className="sr-only">No cover yet</span>
            </div>
          )}
        </div>

        {/* title + meta */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-night">{title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dim">
            {metaLine}
          </p>
        </div>

        {/* shared / private chip */}
        <span className="hidden shrink-0 sm:inline-flex">{sharedChip}</span>

        {/* menu — always visible in the row */}
        <div className="shrink-0" {...stopProp}>
          {actionsMenu}
        </div>

        {sharedDialogs}
      </motion.div>
    );
  }

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
      className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-silver bg-paper transition-colors duration-150 hover:border-night/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {/* Cover — a portrait page, kept at the book's own 9:16 ratio */}
      <div className="relative aspect-[9/16] overflow-hidden border-b border-silver bg-smoke">
        {coverImage ? (
          <img
            src={coverImage}
            alt={`Cover of ${title}`}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <LogoMark
              className="h-10 w-auto text-dim/50"
              strokeWidth={3.8}
            />
            {/* a dashed frame reads as a blank page awaiting art — not a
                finished heart cover */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-3 rounded-md border border-dashed border-silver"
            />
            <span className="sr-only">No cover yet</span>
          </div>
        )}
      </div>

      {/* Meta footer */}
      <div className="flex flex-1 flex-col px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-night">
            {title}
          </h3>
          <div className="relative -mr-2 shrink-0" {...stopProp}>
            {actionsMenu}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-dim">
          {metaLine}
          <span className="ml-auto">{sharedChip}</span>
        </div>
      </div>

      {sharedDialogs}
    </motion.div>
  );
}

/* ── shared dialogs (identical in grid + list layouts) ─────────────────── */

function RenameDialog({
  id,
  title,
  newTitle,
  setNewTitle,
  renameOpen,
  setRenameOpen,
  renaming,
  onSubmit,
}: {
  id: string;
  title: string;
  newTitle: string;
  setNewTitle: (v: string) => void;
  renameOpen: boolean;
  setRenameOpen: (open: boolean) => void;
  renaming: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
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
        <form onSubmit={onSubmit} className="space-y-5">
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
  );
}

function DeleteDialog({
  title,
  deleteOpen,
  setDeleteOpen,
  deleting,
  onDelete,
}: {
  title: string;
  deleteOpen: boolean;
  setDeleteOpen: (open: boolean) => void;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
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
              onDelete();
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
  );
}
