import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/paperstring/auth-server";
import { getOwnedProject } from "@/lib/paperstring/server-projects";
import { startPublishSession } from "@/lib/paperstring/publish-sessions";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/publish/start — open a staging session for a
 * chunked publish (long books). The database is only written by `finish`.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
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

  const session = startPublishSession(id, user.id);
  return NextResponse.json(
    { publishId: session.id },
    { headers: { "Cache-Control": "no-store" } }
  );
}
