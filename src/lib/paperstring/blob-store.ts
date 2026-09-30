import { db } from "@/lib/db";

/**
 * Chunked large-text storage, shared by local SQLite and Cloudflare D1.
 *
 * Cloudflare D1 rejects bound parameters above ~8–10MB (SQLITE_TOOBIG) and
 * caps SQL statements at 100KB, so multi-megabyte payloads (project JSON
 * with imported photos/fonts, published 4K page books) cannot live in a
 * single column value there. This module transparently splits any large
 * string into ordered ≤CHUNK_MAX_BYTES pieces stored as BlobChunk rows;
 * the owning column keeps either the inline value (small strings) or a
 * compact marker string "psblob:<blobId>" pointing at the chunks.
 *
 * Locally the same code path runs against SQLite — identical behaviour,
 * one code path to test.
 *
 * BlobRef rows may carry a projectId so project deletion cascades away
 * the project's blobs (Prisma onDelete: Cascade / SQLite FK enforcement).
 */

export const BLOB_REF_PREFIX = "psblob:";

/** Max UTF-8 bytes per chunk — safely under D1's ~8–10MB SQLITE_TOOBIG bound. */
export const CHUNK_MAX_BYTES = 3_500_000;

/** Strings at or under this size stay inline in the owning column. */
export const INLINE_MAX_BYTES = 400_000;

/** Batches for chunk inserts — stays well clear of D1 parameter-count limits. */
const CHUNK_INSERT_BATCH = 40;

export function isBlobRef(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(BLOB_REF_PREFIX);
}

function blobIdOf(value: string): string {
  return value.slice(BLOB_REF_PREFIX.length);
}

const encoder = new TextEncoder();

/** UTF-8 byte length of a string (chars ≠ bytes for non-ASCII content). */
function byteLength(s: string): number {
  return encoder.encode(s).length;
}

/**
 * Split text into pieces of at most `maxBytes` UTF-8 bytes each, cutting
 * only at code-unit boundaries (pieces remain valid strings).
 */
function chunkText(text: string, maxBytes: number): string[] {
  if (byteLength(text) <= maxBytes) return [text];
  const pieces: string[] = [];
  let start = 0;
  while (start < text.length) {
    // Upper bound in chars, then halve until the piece's byte size fits
    // (base64-heavy content fits on the first try).
    let end = Math.min(text.length, start + maxBytes);
    while (end > start + 1 && byteLength(text.slice(start, end)) > maxBytes) {
      end = start + Math.floor((end - start) / 2);
    }
    if (end <= start) end = start + 1;
    pieces.push(text.slice(start, end));
    start = end;
  }
  return pieces;
}

export interface PackOptions {
  purpose: string;
  projectId?: string;
  /** Strings up to this many bytes stay inline. Default INLINE_MAX_BYTES. */
  inlineMaxBytes?: number;
}

/**
 * Prepare a value for its column: returns the inline string when small
 * enough, otherwise chunks it into BlobChunk rows and returns the marker.
 * Callers persist the returned value, then (after a successful update)
 * call `deletePackedText(previousValue)` to release the old blob, if any.
 */
export async function packText(
  text: string | null | undefined,
  opts: PackOptions
): Promise<string | null> {
  if (text == null) return null;
  const inlineMax = opts.inlineMaxBytes ?? INLINE_MAX_BYTES;
  if (byteLength(text) <= inlineMax) return text;

  const id = `${opts.purpose}:${crypto.randomUUID()}`;
  const pieces = chunkText(text, CHUNK_MAX_BYTES);

  await db.blobRef.create({
    data: {
      id,
      projectId: opts.projectId ?? null,
      purpose: opts.purpose,
    },
  });
  await insertChunks(id, pieces);
  return `${BLOB_REF_PREFIX}${id}`;
}

/**
 * Replace a packed column value: writes the new value (packing if large)
 * and — when `previousValue` referenced a blob — deletes that old blob.
 * The old blob is only removed after the caller persists the new value,
 * so pass `previousValue` AFTER the DB update succeeded… or use the safer
 * two-step `packText` + `deletePackedText` at the call site. This helper
 * is for call sites that prefer one expression and accept that a crash
 * between the two awaits leaves an orphaned (harmless) blob instead of
 * ever losing data.
 */
export async function replacePackedText(
  newText: string | null | undefined,
  previousValue: string | null | undefined,
  opts: PackOptions
): Promise<string | null> {
  const packed = await packText(newText, opts);
  if (isBlobRef(previousValue) && previousValue !== packed) {
    await deleteBlobId(blobIdOf(previousValue));
  }
  return packed;
}

/** Resolve a column value (inline or blob marker) back to the full text. */
export async function resolveText(
  value: string | null | undefined
): Promise<string | null> {
  if (value == null) return null;
  if (!isBlobRef(value)) return value;

  const id = blobIdOf(value);
  const chunks = await db.blobChunk.findMany({
    where: { blobId: id },
    orderBy: { idx: "asc" },
    select: { data: true },
  });
  if (chunks.length === 0) return null;
  return chunks.map((c) => c.data).join("");
}

/** Delete the blob a marker points at (no-op for inline values). */
export async function deletePackedText(
  value: string | null | undefined
): Promise<void> {
  if (isBlobRef(value)) await deleteBlobId(blobIdOf(value));
}

async function deleteBlobId(id: string): Promise<void> {
  await db.blobRef.deleteMany({ where: { id } });
}

/** Insert blob chunks in bounded batches (D1 parameter-count safety). */
async function insertChunks(blobId: string, pieces: string[]): Promise<void> {
  for (let i = 0; i < pieces.length; i += CHUNK_INSERT_BATCH) {
    const batch = pieces.slice(i, i + CHUNK_INSERT_BATCH);
    await db.blobChunk.createMany({
      data: batch.map((data, idx) => ({ blobId, idx: i + idx, data })),
    });
  }
}

/**
 * Write an always-chunked standalone blob (no owning column) and return
 * its marker. Used for staged publish pages where the "column" lives in
 * the session bookkeeping (deterministic ids), not in a table column.
 * Rewriting an existing id replaces its content.
 */
export async function putBlob(
  id: string,
  text: string,
  opts: { purpose: string; projectId?: string }
): Promise<string> {
  await db.blobRef.deleteMany({ where: { id } });
  await db.blobRef.create({
    data: {
      id,
      projectId: opts.projectId ?? null,
      purpose: opts.purpose,
    },
  });
  const pieces = chunkText(text, CHUNK_MAX_BYTES);
  await insertChunks(id, pieces);
  return `${BLOB_REF_PREFIX}${id}`;
}

/** Resolve a standalone blob by its marker (or bare id). */
export async function getBlob(idOrMarker: string): Promise<string | null> {
  const id = isBlobRef(idOrMarker) ? blobIdOf(idOrMarker) : idOrMarker;
  return resolveText(`${BLOB_REF_PREFIX}${id}`);
}

/** Delete a standalone blob by its marker (or bare id). */
export async function deleteBlob(idOrMarker: string): Promise<void> {
  const id = isBlobRef(idOrMarker) ? blobIdOf(idOrMarker) : idOrMarker;
  await deleteBlobId(id);
}
