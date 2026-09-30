import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, newShareToken } from "@/lib/paperstring/auth-server";
import { getOwnedProject } from "@/lib/paperstring/server-projects";
import { takePublishSession } from "@/lib/paperstring/publish-sessions";
import { deletePackedText, packText } from "@/lib/paperstring/blob-store";
import { ensureDb } from "@/lib/db-init";

type Ctx = { params: Promise<{ id: string }> };

const finishSchema = z.object({
  publishId: z.string().regex(/^[0-9a-f]{24}$/),
  coverImage: z.string().max(1_500_000).nullable().optional(),
  regenerate: z.boolean().optional(),
});

/**
 * POST /api/projects/[id]/publish/finish — seal a chunked publish: take the
 * staged pages and persist them exactly like the legacy single-shot publish
 * (FR-1.6, SEP-3 — viewers get rendered pages only).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  await ensureDb();
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
    const parsed = finishSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid finish payload" },
        { status: 400 }
      );
    }
    const { publishId, coverImage, regenerate } = parsed.data;

    const taken = await takePublishSession(publishId, id, user.id);
    if (!taken.ok) {
      return NextResponse.json(
        {
          error:
            taken.error === "empty"
              ? "No pages were uploaded — try again"
              : "Publish session expired — try again",
        },
        { status: 404 }
      );
    }
    const { pages } = taken;

    const shareToken =
      !owned.project.shareToken || regenerate ? newShareToken() : owned.project.shareToken;

    // Published books are multi-MB (4K page data URLs) — chunk them into
    // blobs on D1. Pack first, persist, then release the previous blob.
    const packedPublished = (await packText(
      JSON.stringify({ title: owned.project.title, pages }),
      { purpose: "published", projectId: id }
    )) as string;

    const project = await db.project.update({
      where: { id },
      data: {
        ...(coverImage !== undefined ? { coverImage } : {}),
        shareToken,
        publishedData: packedPublished,
        publishedAt: new Date(),
      },
    });
    await deletePackedText(owned.project.publishedData);

    return NextResponse.json({
      shareToken: project.shareToken,
      publishedAt: project.publishedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[projects:publish:finish]", err);
    return NextResponse.json({ error: "Could not publish this project" }, { status: 500 });
  }
}
