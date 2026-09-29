import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/paperstring/auth-server";
import { getOwnedProject, toSummary } from "@/lib/paperstring/server-projects";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/projects/[id] — owner-only full project data (FR-1.9). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedProject(id, user.id);
  if ("error" in owned) {
    return NextResponse.json(
      { error: owned.error === "not-found" ? "Project not found" : "Not allowed" },
      { status: owned.error === "not-found" ? 404 : 403 }
    );
  }
  const p = owned.project;
  return NextResponse.json({
    project: { ...toSummary(p), data: JSON.parse(p.data) },
  });
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  data: z
    .object({
      version: z.literal(1),
      canvases: z.array(z.any()),
      // creator-imported fonts (FR-4.4) — embedded data URLs, persisted with the project
      fonts: z
        .array(
          z.object({
            id: z.string().max(64),
            label: z.string().max(80),
            family: z.string().max(120),
            src: z.string().max(9_000_000),
          })
        )
        .max(12)
        .optional(),
    })
    .optional(),
  coverImage: z.string().nullable().optional(),
});

/** PUT /api/projects/[id] — save project state (FR-1.5). */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedProject(id, user.id);
  if ("error" in owned) {
    return NextResponse.json(
      { error: owned.error === "not-found" ? "Project not found" : "Not allowed" },
      { status: owned.error === "not-found" ? 404 : 403 }
    );
  }

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid save payload" }, { status: 400 });
    }
    const { title, data, coverImage } = parsed.data;

    const project = await db.project.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(data !== undefined ? { data: JSON.stringify(data) } : {}),
        ...(coverImage !== undefined ? { coverImage } : {}),
      },
    });
    return NextResponse.json({ project: toSummary(project) });
  } catch (err) {
    console.error("[projects:update]", err);
    return NextResponse.json({ error: "Could not save the project" }, { status: 500 });
  }
}

/** DELETE /api/projects/[id] — owner-only delete, invalidates its share link. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedProject(id, user.id);
  if ("error" in owned) {
    return NextResponse.json(
      { error: owned.error === "not-found" ? "Project not found" : "Not allowed" },
      { status: owned.error === "not-found" ? 404 : 403 }
    );
  }
  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
