import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ token: string }> };

/**
 * GET /api/share/[token] — public, unauthenticated viewer data (FR-1.7).
 * Returns only the title and pre-rendered pages: no editing UI, no layer
 * source data (SEP-1/SEP-3). Invalid links get a clean 404 (Flow 4.8).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const project = await db.project.findUnique({
    where: { shareToken: token },
    select: { title: true, publishedData: true },
  });

  if (!project?.publishedData) {
    return NextResponse.json(
      { error: "This link is unavailable. It may have been revoked or never shared." },
      { status: 404 }
    );
  }

  try {
    const published = JSON.parse(project.publishedData) as {
      title: string;
      pages: string[];
    };
    // Prefer the LIVE project title: renaming a book after publishing should
    // flow through to already-shared links (the title is viewer chrome, not
    // baked artwork — pages stay frozen). Fall back to the publish snapshot
    // only if the live title is somehow empty (found in Round 16 QA:
    // "Curve Test Book" links still said "Untitled book").
    const title = project.title?.trim() || published.title;
    return NextResponse.json({ title, pages: published.pages });
  } catch {
    return NextResponse.json({ error: "This link is unavailable." }, { status: 404 });
  }
}
