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
 * Nothing touches the database until `finish`, so a cancelled or failed
 * publish never corrupts the live share link (SEP-3 invariant). Sessions are
 * in-memory (this deployment is a single long-lived Node process); stale ones
 * are swept on every call and expire TTL_MS after their last activity.
 */

interface PublishSession {
  id: string;
  projectId: string;
  userId: string;
  pages: string[];
  createdAt: number;
  updatedAt: number;
}

const TTL_MS = 15 * 60 * 1000; // abandon sessions idle for 15 minutes
const MAX_SESSIONS_PER_USER = 2; // an accidental retry never piles up
export const CHUNK_MAX = 4; // pages accepted per chunk call
export const PAGES_MAX = 60; // mirrors the legacy publish schema cap

const sessions = new Map<string, PublishSession>();

function sweep(now = Date.now()) {
  for (const [id, s] of sessions) {
    if (now - s.updatedAt > TTL_MS) sessions.delete(id);
  }
}

function newSessionId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Begin a staging session for an owned project. Returns the session. */
export function startPublishSession(projectId: string, userId: string): PublishSession {
  sweep();
  // Cap concurrent sessions per user — evict the oldest beyond the limit.
  const mine = [...sessions.values()].filter((s) => s.userId === userId);
  if (mine.length >= MAX_SESSIONS_PER_USER) {
    mine.sort((a, b) => a.updatedAt - b.updatedAt);
    for (const s of mine.slice(0, mine.length - MAX_SESSIONS_PER_USER + 1)) {
      sessions.delete(s.id);
    }
  }
  const session: PublishSession = {
    id: newSessionId(),
    projectId,
    userId,
    pages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

/** Append validated pages to a session. Returns the new count, or an error code. */
export function appendPublishChunk(
  sessionId: string,
  projectId: string,
  userId: string,
  pages: string[]
): { ok: true; received: number } | { ok: false; error: "not-found" | "overflow" } {
  sweep();
  const s = sessions.get(sessionId);
  if (!s || s.projectId !== projectId || s.userId !== userId) {
    return { ok: false, error: "not-found" };
  }
  if (s.pages.length + pages.length > PAGES_MAX) {
    return { ok: false, error: "overflow" };
  }
  s.pages.push(...pages);
  s.updatedAt = Date.now();
  return { ok: true, received: s.pages.length };
}

/** Take (and remove) the finished session's pages, or an error code. */
export function takePublishSession(
  sessionId: string,
  projectId: string,
  userId: string
): { ok: true; pages: string[] } | { ok: false; error: "not-found" | "empty" } {
  sweep();
  const s = sessions.get(sessionId);
  if (!s || s.projectId !== projectId || s.userId !== userId) {
    return { ok: false, error: "not-found" };
  }
  sessions.delete(s.id);
  if (s.pages.length < 1) return { ok: false, error: "empty" };
  return { ok: true, pages: s.pages };
}
