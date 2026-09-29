"use client";

/**
 * View routing for the single-route PaperString SPA.
 * Views: landing (default) | auth | dashboard | editor | viewer
 */

export type ViewName = "landing" | "auth" | "dashboard" | "editor" | "viewer";

export interface ViewParams {
  project?: string;
  s?: string;
  mode?: string;
}

export function viewUrl(view: ViewName, params?: ViewParams): string {
  const sp = new URLSearchParams({ view });
  if (params?.project) sp.set("project", params.project);
  if (params?.s) sp.set("s", params.s);
  if (params?.mode) sp.set("mode", params.mode);
  return `/?${sp.toString()}`;
}

/** Navigate between PaperString views (client-side, keeps SPA state). */
export function psNavigate(view: ViewName, params?: ViewParams): void {
  const url = viewUrl(view, params);
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function parseView(searchParams: URLSearchParams): {
  view: ViewName;
  params: ViewParams;
} {
  const raw = searchParams.get("view");
  const view: ViewName =
    raw === "auth" ||
    raw === "dashboard" ||
    raw === "editor" ||
    raw === "viewer"
      ? raw
      : "landing";
  return {
    view,
    params: {
      project: searchParams.get("project") ?? undefined,
      s: searchParams.get("s") ?? undefined,
      mode: searchParams.get("mode") ?? undefined,
    },
  };
}
