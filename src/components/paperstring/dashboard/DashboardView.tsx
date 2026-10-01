"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MotionConfig, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  HeartCrack,
  LayoutGrid,
  List,
  Loader2,
  LogOut,
  Plus,
  Search,
  X,
} from "lucide-react";

import type { ProjectSummary, PsUser } from "@/lib/paperstring/types";
import { psNavigate } from "@/lib/paperstring/navigation";
import { WordMark } from "@/components/paperstring/brand";
import { ProjectCard } from "./ProjectCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load projects");
  const json = (await res.json()) as { projects?: ProjectSummary[] };
  return json.projects ?? [];
}

type SortMode = "edited" | "created" | "title" | "pages";
type LibraryView = "grid" | "list";

/** Library layout preference — purely local, survives reloads. */
const LIBRARY_VIEW_KEY = "ps-library-view";

function readLibraryView(): LibraryView {
  try {
    return window.localStorage.getItem(LIBRARY_VIEW_KEY) === "list"
      ? "list"
      : "grid";
  } catch {
    return "grid";
  }
}

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

/** Time-aware greeting — the studio says hello like a person, not a router. */
function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardView({ user }: { user: PsUser }) {
  const queryClient = useQueryClient();

  // Library-management state lives here only — resets on mount by design.
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("edited");
  const [viewMode, setViewMode] = useState<LibraryView>(readLibraryView);

  useEffect(() => {
    try {
      window.localStorage.setItem(LIBRARY_VIEW_KEY, viewMode);
    } catch {
      /* private mode — the toggle still works, it just won't persist */
    }
  }, [viewMode]);

  const firstName = user.name.trim().split(/\s+/)[0] || "friend";
  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "P";
  const greeting = greetingForHour(new Date().getHours());

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
      className="group h-10 rounded-md px-4 sm:h-11 sm:px-5"
    >
      {createBook.isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Plus
          className="size-4 transition-transform duration-300 group-hover:rotate-90 motion-reduce:transition-none motion-reduce:group-hover:rotate-0"
          aria-hidden="true"
        />
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
      <div className="hs-studio flex min-h-screen flex-col bg-paper">
        {/* ── App header — the studio's one persistent bar ──────────── */}
        <header className="sticky top-0 z-20 border-b border-silver bg-paper">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
            <button
              type="button"
              onClick={() => psNavigate("landing")}
              aria-label="PaperString home"
              className="min-w-0 shrink rounded-lg text-night transition-opacity duration-150 hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              <WordMark markClassName="h-6 w-7 sm:h-7 sm:w-8" />
            </button>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
              {newBookButton}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Avatar className="size-9">
                      {user.image ? (
                        <AvatarImage
                          src={user.image}
                          alt={`${user.name}'s profile picture`}
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <AvatarFallback className="bg-night text-xs font-semibold text-smoke">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <div className="truncate font-medium">{user.name}</div>
                    <div className="truncate text-xs font-normal text-dim">
                      {user.email}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled className="text-dim">
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

        {/* ── Greeting ────────────────────────────────────────────────── */}
        <div className="mx-auto w-full max-w-7xl px-4 pt-12 sm:px-8 lg:pt-16">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <h1 className="font-display text-3xl font-medium tracking-tight text-night sm:text-4xl">
              Your studio
            </h1>
            <p className="mt-2 text-sm text-onyx">
              {greeting}, {firstName} — your books are exactly as you left them.
            </p>
            {libraryLoaded && projects.length > 0 && (
              <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-dim">
                {statsLine}
              </p>
            )}
          </motion.div>
        </div>

        {/* ── Library toolbar — full-width hairlines, search / sort / view.
            Appears once there is a library to manage. ─────────────────── */}
        {libraryLoaded && projects.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.08 }}
            className="mt-8 border-y border-silver"
          >
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
              {/* search — a borderless field set into the bar */}
              <div role="search" className="relative w-full max-w-xs flex-1">
                <Search
                  className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-dim"
                  aria-hidden="true"
                />
                <input
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
                  className="h-9 w-full bg-transparent pl-7 pr-7 text-sm text-night outline-none placeholder:text-dim focus-visible:outline-none"
                />
                {search !== "" && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                    className="absolute right-0 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-dim transition-colors hover:bg-smoke hover:text-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div
                aria-hidden="true"
                className="hidden h-5 w-px shrink-0 bg-silver sm:block"
              />

              {/* sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 gap-1.5 rounded-lg px-2.5 text-sm text-onyx hover:bg-smoke hover:text-night"
                  >
                    <span className="sr-only">Sort books by</span>
                    <span className="max-w-32 truncate sm:max-w-none">
                      {activeSort.label}
                    </span>
                    <ChevronDown className="size-3.5 text-dim" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-dim">
                    Sort by
                  </DropdownMenuLabel>
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.id}
                      onSelect={() => setSortMode(option.id)}
                    >
                      <Check
                        className={cn(
                          "text-night",
                          sortMode === option.id ? "opacity-100" : "opacity-0"
                        )}
                        aria-hidden="true"
                      />
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* layout toggle — covers at a glance, or a scannable list */}
              <div
                role="group"
                aria-label="Library layout"
                className="ml-auto flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-silver bg-paper p-0.5"
              >
                <button
                  type="button"
                  aria-label="Grid layout"
                  aria-pressed={viewMode === "grid"}
                  title="Grid layout"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "grid size-8 place-items-center rounded-md transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    viewMode === "grid"
                      ? "bg-smoke text-night"
                      : "text-dim hover:text-night"
                  )}
                >
                  <LayoutGrid className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="List layout"
                  aria-pressed={viewMode === "list"}
                  title="List layout"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "grid size-8 place-items-center rounded-md transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    viewMode === "list"
                      ? "bg-smoke text-night"
                      : "text-dim hover:text-night"
                  )}
                >
                  <List className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Library ─────────────────────────────────────────────────── */}
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
            {projectsQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-lg border border-silver bg-paper"
                  >
                    <Skeleton className="aspect-[9/16] w-full rounded-none" />
                    <div className="space-y-2.5 px-4 py-3">
                      <Skeleton className="h-3.5 w-3/4" />
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
                    className="mt-2 rounded-lg"
                    onClick={() => projectsQuery.refetch()}
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            ) : projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-silver py-16 text-center">
                <div
                  aria-hidden="true"
                  className="mx-auto grid size-11 place-items-center rounded-lg border border-silver bg-smoke"
                >
                  <BookOpen className="size-5 text-night" />
                </div>
                <h2 className="mt-6 font-display text-xl font-medium tracking-tight text-night">
                  Nothing here yet
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-dim">
                  Your first book takes about fifteen minutes. Photos, a few
                  words, one link.
                </p>
                <div className="mt-8 flex justify-center">{newBookButton}</div>
              </div>
            ) : visibleProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-silver py-16 text-center">
                <div
                  aria-hidden="true"
                  className="mx-auto grid size-11 place-items-center rounded-lg border border-silver bg-smoke"
                >
                  <HeartCrack className="size-5 text-night" />
                </div>
                <h2 className="mt-6 font-display text-xl font-medium tracking-tight text-night">
                  No books match &ldquo;{trimmedQuery}&rdquo;
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-dim">
                  The words are there — just not in that order. Try another
                  word, or clear the search to see your whole shelf.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setSearch("")}
                  className="mt-8 h-11 rounded-lg px-6"
                >
                  <X className="size-4" aria-hidden="true" />
                  Clear search
                </Button>
              </div>
            ) : viewMode === "list" ? (
              <ul className="border-t border-silver">
                {visibleProjects.map((project, i) => (
                  <li key={project.id}>
                    <ProjectCard project={project} index={i} variant="list" />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProjects.map((project, i) => (
                  <ProjectCard key={project.id} project={project} index={i} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}
