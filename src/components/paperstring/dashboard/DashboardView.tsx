"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { MotionConfig, motion } from "framer-motion";
import { toast } from "sonner";
import { AlertCircle, BookOpen, Loader2, LogOut, Moon, Plus, Sun } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";

async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch("/api/projects", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load projects");
  const json = (await res.json()) as { projects?: ProjectSummary[] };
  return json.projects ?? [];
}

export function DashboardView({ user }: { user: PsUser }) {
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();

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
              </div>
              {newBookButton}
            </motion.div>

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
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project, i) => (
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
