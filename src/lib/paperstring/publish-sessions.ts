import { db } from "@/lib/db";
import { deleteBlob, getBlob, putBlob } from "@/lib/paperstring/blob-store";

/**
 * Publish sessions — server-side staging for chunked publishing of long books.
 *
 * A 60-page book renders to ~240 MB of base64 PNG. Sending that as one JSON
 * body spikes browser and server memory and risks tripping proxy limits. The
 * chunked flow instead stages pages server-side:
 *
 *   POST /api/projects/[id]/publish/start    → { publishId }
 *   POST /api/projects/[id]/publish/chunk    → { received }   (1..CHUNK_MAX pages)
 *   POST /api/projects/[id]/publish/finish   → { shareToken, publishedAt }
 *
 * Nothing touches the project row until `finish`, so a cancelled or failed
 * publish never corrupts the live share link (SEP-3 invariant).
 *
 * Sessions are persisted in the database (PublishSession rows + one chunked
 * blob per staged page): on Cloudflare Workers consecutive requests may be
 * served by different isolates, so the previous in-memory Map would lose
 * staging mid-publish. Stale sessions are swept on every call and expire
 * TTL_MS after their last activity.
 */

const TTL_MS = 15 * 60 * 1000; // abandon sessions idle for 15 minutes
const MAX_SESSIONS_PER_USER = 2; // an accidental retry never piles up
export const CHUNK_MAX = 4; // pages accepted per chunk call
export const PAGES_MAX = 60; // mirrors the legacy publish schema cap

/** Deterministic blob id for a session's staged page. */
function pageBlobId(sessionId: string, index: number): string {
  return `pubpage:${sessionId}:${index}`;
}

function newSessionId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Delete a session row and all of its staged page blobs. */
async function destroySession(id: string): Promise<void> {
  const session = await db.publishSession.findUnique({ where: { id } });
  if (!session) return;
  await db.publishSession.delete({ where: { id } }).catch(() => {});
  await destroySessionBlobs(id, session.pageCount);
}

async function destroySessionBlobs(sessionId: string, pageCount: number): Promise<void> {
  await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      deleteBlob(pageBlobId(sessionId, i)).catch(() => {})
    )
  );
}

/** Drop sessions idle beyond the TTL. */
async function sweep(): Promise<void> {
  const cutoff = new Date(Date.now() - TTL_MS);
  const stale = await db.publishSession.findMany({
    where: { updatedAt: { lt: cutoff } },
    select: { id: true, pageCount: true },
  });
  for (const s of stale) {
    await db.publishSession.delete({ where: { id: s.id } }).catch(() => {});
    await destroySessionBlobs(s.id, s.pageCount);
  }
}

/** Begin a staging session for an owned project. Returns the session id. */
export async function startPublishSession(
  projectId: string,
  userId: string
): Promise<string> {
  await sweep();
  // Cap concurrent sessions per user — evict the oldest beyond the limit.
  const mine = await db.publishSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "asc" },
    select: { id: true },
  });
  for (const s of mine.slice(0, Math.max(0, mine.length - MAX_SESSIONS_PER_USER + 1))) {
    await destroySession(s.id);
  }

  const id = newSessionId();
  await db.publishSession.create({
    data: { id, projectId, userId, pageCount: 0 },
  });
  return id;
}

/** Append validated pages to a session. Returns the new count, or an error code. */
export async function appendPublishChunk(
  sessionId: string,
  projectId: string,
  userId: string,
  pages: string[]
): Promise<{ ok: true; received: number } | { ok: false; error: "not-found" | "overflow" }> {
  await sweep();
  const s = await db.publishSession.findUnique({ where: { id: sessionId } });
  if (!s || s.projectId !== projectId || s.userId !== userId) {
    return { ok: false, error: "not-found" };
  }
  if (s.pageCount + pages.length > PAGES_MAX) {
    return { ok: false, error: "overflow" };
  }

  // Stage each page as its own chunked blob (a 4K page data URL is often
  // larger than a single D1 parameter allows).
  await Promise.all(
    pages.map((page, i) =>
      putBlob(pageBlobId(sessionId, s.pageCount + i), page, {
        purpose: "pubpage",
        projectId,
      })
    )
  );
  const received = s.pageCount + pages.length;
  await db.publishSession.update({
    where: { id: sessionId },
    data: { pageCount: received, updatedAt: new Date() },
  });
  return { ok: true, received };
}

/** Take (and remove) the finished session's pages, or an error code. */
export async function takePublishSession(
  sessionId: string,
  projectId: string,
  userId: string
): Promise<{ ok: true; pages: string[] } | { ok: false; error: "not-found" | "empty" }> {
  await sweep();
  const s = await db.publishSession.findUnique({ where: { id: sessionId } });
  if (!s || s.projectId !== projectId || s.userId !== userId) {
    return { ok: false, error: "not-found" };
  }
  await db.publishSession.delete({ where: { id: sessionId } }).catch(() => {});
  if (s.pageCount < 1) return { ok: false, error: "empty" };

  const pages = await Promise.all(
    Array.from({ length: s.pageCount }, (_, i) => getBlob(pageBlobId(sessionId, i)))
  );
  await destroySessionBlobs(sessionId, s.pageCount);

  if (pages.some((p) => p == null)) {
    return { ok: false, error: "not-found" };
  }
  return { ok: true, pages: pages as string[] };
}
