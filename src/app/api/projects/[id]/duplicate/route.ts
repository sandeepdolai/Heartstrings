import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/paperstring/auth-server";
import { getOwnedProject, toSummary } from "@/lib/paperstring/server-projects";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/duplicate — copy a book with all its pages,
 * layers and cover (never the share link — a duplicate starts private).
 * Lets creators keep an original safe while trying a variation.
 */
export async function POST(_req: Request, { params }: Ctx) {
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
    const src = owned.project;
    const title =
      src.title.length > 106 ? `${src.title.slice(0, 106)}… (copy)` : `${src.title} (copy)`;

    const project = await db.project.create({
      data: {
        userId: user.id,
        title,
        data: src.data,
        coverImage: src.coverImage,
      },
    });
    return NextResponse.json({ project: toSummary(project) }, { status: 201 });
  } catch (err) {
    console.error("[projects:duplicate]", err);
    return NextResponse.json({ error: "Could not duplicate this project" }, { status: 500 });
  }
}
