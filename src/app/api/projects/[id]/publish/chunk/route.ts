import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/paperstring/auth-server";
import { getOwnedProject } from "@/lib/paperstring/server-projects";
import { appendPublishChunk, CHUNK_MAX } from "@/lib/paperstring/publish-sessions";

type Ctx = { params: Promise<{ id: string }> };

const chunkSchema = z.object({
  publishId: z.string().regex(/^[0-9a-f]{24}$/),
  pages: z
    .array(z.string().startsWith("data:image/").max(14_000_000))
    .min(1, "A chunk needs at least one page")
    .max(CHUNK_MAX),
});

/**
 * POST /api/projects/[id]/publish/chunk — append rendered pages to a staging
 * session. Pages are validated exactly like the legacy single-shot publish.
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
    const parsed = chunkSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid chunk payload" },
        { status: 400 }
      );
    }
    const { publishId, pages } = parsed.data;
    const res = appendPublishChunk(publishId, id, user.id, pages);
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error === "overflow" ? "Too many pages for one book" : "Publish session expired — try again" },
        { status: res.error === "overflow" ? 413 : 404 }
      );
    }
    return NextResponse.json(
      { received: res.received },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[projects:publish:chunk]", err);
    return NextResponse.json({ error: "Could not receive this chunk" }, { status: 500 });
  }
}
