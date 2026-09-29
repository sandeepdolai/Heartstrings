"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { MotionConfig, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpDown,
  BookOpen,
  Check,
  ChevronDown,
  HeartCrack,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
  X,
} from "lucide-react";

import type { ProjectSummary, PsUser } from "@/lib/paperstring/types";
import { psNavigate } from "@/lib/paperstring/navigation";
import { LogoMark, WordMark } from "@/components/paperstring/brand";
import { ProjectCard } from "./ProjectCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load projects");
  const json = (await res.json()) as { projects?: ProjectSummary[] };
  return json.projects ?? [];
}

type SortMode = "edited" | "created" | "title" | "pages";

const SORT_OPTIONS: ReadonlyArray<{ id: SortMode; label: string }> = [
  { id: "edited", label: "Recently edited" },
  { id: "created", label: "Recently created" },
  { id: "title", label: "Title A–Z" },
  { id: "pages", label: "Most pages" },
];

const DEFAULT_SORT = SORT_OPTIONS[0];

function titleCaseInsensitive(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

/** Client-side comparator over the cached projects array (no refetching). */
function compareProjects(mode: SortMode) {
  return (a: ProjectSummary, b: ProjectSummary): number => {
    switch (mode) {
      case "created":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          titleCaseInsensitive(a.title, b.title)
        );
      case "title":
        return (
          titleCaseInsensitive(a.title, b.title) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      case "pages":
        return b.pageCount - a.pageCount || titleCaseInsensitive(a.title, b.title);
      case "edited":
      default:
        // Same as the API's default order: updatedAt, newest first.
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
          titleCaseInsensitive(a.title, b.title)
        );
    }
  };
}

export function DashboardView({ user }: { user: PsUser }) {
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();

  // Library-management state lives here only — resets on mount by design.
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("edited");

  const firstName = user.name.trim().split(/\s+/)[0] || "friend";
  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "P";

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const createBook = useMutation({
    mutationFn: async (): Promise<ProjectSummary> => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      let json: { project?: ProjectSummary; error?: string } | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!res.ok || !json?.project) {
        throw new Error(json?.error ?? "Couldn't create a new book");
      }
      return json.project;
    },
    onSuccess: (project) => {
      toast.success("A fresh book, ready for your heart");
      psNavigate("editor", { project: project.id });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't create a new book");
    },
  });

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the call fails, clear the session locally.
    }
    queryClient.removeQueries({ queryKey: ["projects"] });
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    toast("Signed out — see you soon");
    psNavigate("landing");
  };

  const newBookButton = (
    <Button
      onClick={() => createBook.mutate()}
      disabled={createBook.isPending}
      className="h-11 rounded-full px-5"
    >
      {createBook.isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="size-4" aria-hidden="true" />
      )}
      New book
    </Button>
  );

  const projects = projectsQuery.data ?? [];
  const libraryLoaded = !projectsQuery.isLoading && !projectsQuery.isError;

  const trimmedQuery = search.trim();
  const needle = trimmedQuery.toLowerCase();

  const visibleProjects = useMemo(() => {
    const filtered = needle
      ? projects.filter((p) => p.title.toLowerCase().includes(needle))
      : projects;
    return [...filtered].sort(compareProjects(sortMode));
  }, [projects, needle, sortMode]);

  const activeSort = SORT_OPTIONS.find((o) => o.id === sortMode) ?? DEFAULT_SORT;

  // Library stats microcopy — summarizes the whole shelf, not the search view.
  const totalPages = projects.reduce((sum, p) => sum + p.pageCount, 0);
  const sharedCount = projects.filter((p) => p.shareToken).length;
  const statsSegments = [
    `${projects.length} ${projects.length === 1 ? "book" : "books"}`,
    `${totalPages} ${totalPages === 1 ? "page" : "pages"}`,
  ];
  if (sharedCount > 0) statsSegments.push(`${sharedCount} shared`);
  const statsLine = statsSegments.join(" · ");

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col bg-smoke ps-grain dark:bg-night">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 border-b border-silver/30 bg-smoke/80 backdrop-blur dark:bg-night/80">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <button
              type="button"
              onClick={() => psNavigate("landing")}
              aria-label="PaperString home"
              className="rounded-md p-1 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <WordMark className="text-night dark:text-smoke" />
            </button>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Toggle dark mode"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="size-11 rounded-full text-dim hover:text-night dark:text-silver/80 dark:hover:text-smoke"
              >
                <Sun className="size-5 dark:hidden" aria-hidden="true" />
                <Moon className="hidden size-5 dark:block" aria-hidden="true" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-night text-xs font-semibold text-smoke dark:bg-smoke dark:text-night">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <div className="truncate font-medium">{user.name}</div>
                    <div className="truncate text-xs font-normal text-dim dark:text-silver/70">
                      {user.email}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="text-dim dark:text-silver/70">
                    <BookOpen />
                    Your projects
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* ── Main ────────────────────────────────────────────────────── */}
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex flex-wrap items-end justify-between gap-4"
            >
              <div>
                <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
                  Your studio
                </h1>
                <p className="mt-2 text-sm text-dim dark:text-silver/80">
                  Every book you make lives here, {firstName}.
                </p>
                {libraryLoaded && projects.length > 0 && (
                  <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-dim dark:text-silver/50">
                    {statsLine}
                  </p>
                )}
              </div>
              {newBookButton}
            </motion.div>

            {/* Search + sort toolbar (library affordances, all client-side) */}
            {libraryLoaded && projects.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut", delay: 0.08 }}
                className="mt-6 flex flex-wrap items-center gap-3"
              >
                <div role="search" className="relative w-full sm:w-64 md:w-72">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-dim dark:text-silver/60"
                    aria-hidden="true"
                  />
                  <Input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && search !== "") {
                        e.preventDefault();
                        setSearch("");
                      }
                    }}
                    placeholder="Search your books…"
                    aria-label="Search your books"
                    autoComplete="off"
                    enterKeyHint="search"
                    className="h-11 rounded-full border-silver/60 bg-paper pl-11 pr-10 placeholder:text-dim/70 focus-visible:border-ring dark:border-silver/25 dark:bg-onyx/60 dark:placeholder:text-silver/60"
                  />
                  {search !== "" && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-dim transition-colors hover:bg-smoke hover:text-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-silver/70 dark:hover:bg-onyx dark:hover:text-smoke"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 rounded-full border-silver/60 bg-paper px-4 hover:bg-smoke dark:border-silver/25 dark:bg-onyx/60 dark:hover:bg-onyx"
                    >
                      <ArrowUpDown
                        className="size-4 text-dim dark:text-silver/80"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Sort books by</span>
                      <span className="max-w-36 truncate sm:max-w-none">
                        {activeSort.label}
                      </span>
                      <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-dim dark:text-silver/60">
                      Sort by
                    </DropdownMenuLabel>
                    {SORT_OPTIONS.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onSelect={() => setSortMode(option.id)}
                      >
                        <Check
                          className={cn(
                            "text-night dark:text-smoke",
                            sortMode === option.id ? "opacity-100" : "opacity-0"
                          )}
                          aria-hidden="true"
                        />
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            )}

            <div className="mt-8 lg:mt-10">
              {projectsQuery.isLoading ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-2xl border border-silver/30 bg-card"
                    >
                      <Skeleton className="aspect-[3/4] w-full rounded-none" />
                      <div className="space-y-3 p-4">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : projectsQuery.isError ? (
                <Alert className="bg-card">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Couldn&apos;t load your books</AlertTitle>
                  <AlertDescription>
                    <p>Something went wrong on our end. Give it another go.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 rounded-full"
                      onClick={() => projectsQuery.refetch()}
                    >
                      Try again
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : projects.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-silver/50 p-8 text-center sm:p-12">
                  <LogoMark
                    className="mx-auto h-10 w-auto text-silver dark:text-silver/60"
                    strokeWidth={4}
                  />
                  <h2 className="mt-6 font-display text-2xl font-medium tracking-tight">
                    Your first book is one click away
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-dim dark:text-silver/80">
                    Love notes, friendship books, thank-you pages — start with a
                    blank page and see where the heart takes you.
                  </p>
                  <Button
                    onClick={() => createBook.mutate()}
                    disabled={createBook.isPending}
                    className="mt-8 h-11 rounded-full px-6"
                  >
                    {createBook.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="size-4" aria-hidden="true" />
                    )}
                    Create your first book
                  </Button>
                </div>
              ) : visibleProjects.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-silver/50 p-8 text-center sm:p-12">
                  <HeartCrack
                    className="mx-auto size-9 text-silver dark:text-silver/60"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <h2 className="mt-6 font-display text-2xl font-medium tracking-tight">
                    No books match &ldquo;{trimmedQuery}&rdquo;
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-dim dark:text-silver/80">
                    The words are there — just not in that order. Try another
                    word, or clear the search to see your whole shelf.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSearch("")}
                    className="mt-8 h-11 rounded-full px-6"
                  >
                    <X className="size-4" aria-hidden="true" />
                    Clear search
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleProjects.map((project, i) => (
                    <ProjectCard key={project.id} project={project} index={i} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="mt-auto border-t border-silver/30 py-6">
          <div className="flex items-center justify-center gap-2 text-xs text-dim dark:text-silver/80">
            <LogoMark className="h-4 w-auto text-current" strokeWidth={5} />
            <span>
              PaperString — made for love, friendship &amp; everything
              heartfelt. © 2026
            </span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
