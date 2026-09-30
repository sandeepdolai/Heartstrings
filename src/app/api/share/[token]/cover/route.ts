import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveText } from "@/lib/paperstring/blob-store";
import { ensureDb } from "@/lib/db-init";

type Ctx = { params: Promise<{ token: string }> };

/** Matches a base64 image data URL and captures the mime type. */
const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,/;

/** PNG file signature (first 8 bytes). */
const PNG_SIGNATURE = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
] as const;

/**
 * IEND chunk trailer (last 12 bytes) — every well-formed PNG ends with it.
 * Catching truncated payloads here means unfurlers get a clean 404 (and
 * drop the image from the card) instead of a cached, undecodable 200.
 */
const PNG_IEND_TRAILER = [
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
] as const;

function isCompletePng(bytes: Uint8Array): boolean {
  const minLength = PNG_SIGNATURE.length + PNG_IEND_TRAILER.length;
  return (
    bytes.length >= minLength &&
    PNG_SIGNATURE.every((byte, i) => bytes[i] === byte) &&
    PNG_IEND_TRAILER.every(
      (byte, i) => bytes[bytes.length - PNG_IEND_TRAILER.length + i] === byte
    )
  );
}

/**
 * GET /api/share/[token]/cover — public social/OG preview image (Task 7-a).
 *
 * Serves the book's first published page as raw image bytes so link
 * unfurlers (WhatsApp / iMessage / Slack / Twitter) can build a preview
 * card. Pages are rendered by the publish pipeline as 4K PNG data URLs;
 * the mime type is taken from the data URL (and normalised) so the bytes
 * and the Content-Type header always agree. Unknown, unpublished, revoked
 * or malformed links get a clean 404 JSON error — no data leakage.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  await ensureDb();
  const { token } = await params;

  const project = await db.project.findUnique({
    where: { shareToken: token },
    select: { publishedData: true },
  });

  let firstPage: unknown;
  if (project?.publishedData) {
    try {
      // publishedData may be a chunked blob (multi-MB books on D1).
      const publishedText = await resolveText(project.publishedData);
      const published = publishedText
        ? (JSON.parse(publishedText) as { pages?: unknown[] })
        : null;
      firstPage = published?.pages?.[0];
    } catch {
      firstPage = undefined;
    }
  }

  if (typeof firstPage !== "string") {
    return unavailable();
  }

  const match = DATA_URL_RE.exec(firstPage);
  if (!match) {
    return unavailable();
  }

  const contentType =
    match[1] === "image/jpg" ? "image/jpeg" : (match[1] as string);
  const base64 = firstPage.slice(match[0].length);
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));

  // The publish pipeline emits PNGs; validate them end-to-end so a corrupt
  // row degrades to 404 rather than a broken image. Other image mimes are
  // passed through with a non-empty check.
  const validImage =
    contentType === "image/png"
      ? isCompletePng(bytes)
      : bytes.byteLength > 0;
  if (!validImage) {
    return unavailable();
  }

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      // Explicit size keeps HEAD/crawler probes (curl -I) meaningful —
      // otherwise the body streams chunked with no content-length.
      "Content-Length": String(bytes.byteLength),
    },
  });
}

function unavailable() {
  return NextResponse.json(
    {
      error:
        "Cover unavailable — this link may have been revoked or never shared.",
    },
    { status: 404 }
  );
}
