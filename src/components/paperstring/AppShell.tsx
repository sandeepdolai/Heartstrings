"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { parseView, psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { Providers } from "./Providers";
import { LandingView } from "./landing/LandingView";
import { AuthView } from "./auth/AuthView";
import { DashboardView } from "./dashboard/DashboardView";
import { EditorView } from "./editor/EditorView";
import { ViewerView } from "./viewer/ViewerView";

function AppShellInner() {
  const searchParams = useSearchParams();
  const { view, params } = parseView(searchParams);

  const { data, isLoading } = useQuery<{ user: PsUser | null }>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.status === 401) return { user: null };
      if (!res.ok) throw new Error("Failed to check session");
      return res.json();
    },
  });
  const user = data?.user ?? null;

  // Guard authenticated views (AUTH-1). Viewers never authenticate (AUTH-8).
  useEffect(() => {
    if (isLoading) return;
    if (!user && (view === "dashboard" || view === "editor")) {
      psNavigate("auth", { mode: view === "editor" ? "return-editor" : undefined });
    }
    if (user && view === "auth") {
      psNavigate("dashboard");
    }
  }, [user, view, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-smoke">
        <div className="flex flex-col items-center gap-3">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-silver/40">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-night" />
          </div>
          <p className="text-xs tracking-widest uppercase text-dim">
            PaperString
          </p>
        </div>
      </div>
    );
  }

  switch (view) {
    case "auth":
      return <AuthView returnHint={params.mode === "return-editor"} />;
    case "dashboard":
      return user ? (
        <DashboardView user={user} />
      ) : null;
    case "editor":
      return user && params.project ? (
        <EditorView projectId={params.project} user={user} />
      ) : null;
    case "viewer":
      return params.s ? <ViewerView shareToken={params.s} /> : null;
    default:
      return <LandingView user={user} />;
  }
}

export function AppShell() {
  return (
    <Providers>
      <AppShellInner />
    </Providers>
  );
}
