import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, newShareToken } from "@/lib/paperstring/auth-server";
import { getOwnedProject } from "@/lib/paperstring/server-projects";

type Ctx = { params: Promise<{ id: string }> };

const publishSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  pages: z
    .array(z.string().startsWith("data:image/").max(14_000_000))
    .min(1, "A project needs at least one canvas")
    .max(60),
  coverImage: z.string().max(1_500_000).nullable().optional(),
  regenerate: z.boolean().optional(),
});

/**
 * POST /api/projects/[id]/publish — persist the rendered viewer representation
 * and (re)generate the share URL (FR-1.6, SEP-3: viewers get rendered pages
 * only — never layer data).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
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
    const parsed = publishSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid publish payload" },
        { status: 400 }
      );
    }
    const { title, pages, coverImage, regenerate } = parsed.data;

    const shareToken =
      !owned.project.shareToken || regenerate
        ? newShareToken()
        : owned.project.shareToken;

    const project = await db.project.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(coverImage !== undefined ? { coverImage } : {}),
        shareToken,
        publishedData: JSON.stringify({ title: title ?? owned.project.title, pages }),
        publishedAt: new Date(),
      },
    });

    return NextResponse.json({
      shareToken: project.shareToken,
      publishedAt: project.publishedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[projects:publish]", err);
    return NextResponse.json({ error: "Could not publish this project" }, { status: 500 });
  }
}
