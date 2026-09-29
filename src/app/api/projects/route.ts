import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/paperstring/auth-server";
import { toSummary } from "@/lib/paperstring/server-projects";

/** GET /api/projects — list the signed-in creator's projects. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ projects: projects.map(toSummary) });
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

/** POST /api/projects — create a new project with one blank portrait canvas. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const parsed = createSchema.safeParse(
      await req.json().catch(() => ({}))
    );
    const title =
      parsed.success && parsed.data.title
        ? parsed.data.title
        : "Untitled book";

    const data = JSON.stringify({
      version: 1,
      canvases: [
        {
          id: `cv_${Date.now().toString(36)}`,
          background: "#FFFFFF",
          layers: [
            {
              id: `l_${Date.now().toString(36)}`,
              name: "Paint layer",
              type: "raster",
              visible: true,
              opacity: 1,
              clipped: false,
              x: 540,
              y: 960,
              rotation: 0,
              scale: 1,
              strokes: [],
            },
          ],
        },
      ],
    });

    const project = await db.project.create({
      data: { userId: user.id, title, data },
    });
    return NextResponse.json({ project: toSummary(project) });
  } catch (err) {
    console.error("[projects:create]", err);
    return NextResponse.json({ error: "Could not create project" }, { status: 500 });
  }
}
