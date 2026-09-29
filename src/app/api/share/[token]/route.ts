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
    return NextResponse.json({ title: published.title, pages: published.pages });
  } catch {
    return NextResponse.json({ error: "This link is unavailable." }, { status: 404 });
  }
}
