"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { parseView, psNavigate } from "@/lib/paperstring/navigation";
import type { PsUser } from "@/lib/paperstring/types";
import { WordMark } from "./brand";
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
      <div
        role="status"
        className="flex min-h-screen flex-col items-center justify-center bg-paper"
      >
        <WordMark className="text-night" />
        {/* indeterminate progress hairline — one quiet line while the
            session resolves */}
        <div aria-hidden="true" className="mt-6 h-px w-24 overflow-hidden bg-silver">
          <div className="h-full w-1/3 animate-pulse bg-night" />
        </div>
        <p className="mt-4 text-xs text-dim">Opening your studio…</p>
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
