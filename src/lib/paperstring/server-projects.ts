import { db } from "@/lib/db";
import type { Project } from "@prisma/client";
import type { ProjectSummary } from "./types";

/** Map a Project row to the client-facing summary shape. */
export function toSummary(p: Project): ProjectSummary {
  let pageCount = 0;
  try {
    const data = JSON.parse(p.data) as { canvases?: unknown[] };
    pageCount = Array.isArray(data.canvases) ? data.canvases.length : 0;
  } catch {
    pageCount = 0;
  }
  return {
    id: p.id,
    title: p.title,
    coverImage: p.coverImage,
    pageCount,
    shareToken: p.shareToken,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    updatedAt: p.updatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
  };
}

export async function getOwnedProject(id: string, userId: string) {
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return { error: "not-found" as const };
  if (project.userId !== userId) return { error: "forbidden" as const };
  return { project };
}
