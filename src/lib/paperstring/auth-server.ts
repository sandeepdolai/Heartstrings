import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";

/**
 * PaperString server auth — scrypt password hashing + opaque session tokens
 * in an httpOnly cookie (AUTH-2..6). Owner authorization is enforced on every
 * protected read/write (SEP-4).
 */

export const SESSION_COOKIE = "ps_session";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Is the incoming request served over HTTPS (directly or via the gateway
 * proxy)? The sandbox preview embeds the app in a cross-site iframe, where
 * browsers reject any Set-Cookie without `SameSite=None` — so we must detect
 * the proxied HTTPS leg (Caddy sets x-forwarded-proto) and relax the cookie
 * attributes accordingly. Plain local dev stays on the strict `Lax` default.
 */
async function isHttpsRequest(): Promise<boolean> {
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (proto) return proto === "https";
    // Fallback: infer the scheme from the calling page (e.g. the https
    // preview panel hosting this app in an iframe).
    const referer = h.get("referer");
    if (referer) return referer.startsWith("https://");
    return false;
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  const https = await isHttpsRequest();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // HTTPS (gateway/preview, incl. cross-site iframe): None+Secure+Partitioned
    // so the session survives iframe embedding (CHIPS) and top-level tabs.
    // Local dev over plain http: Lax, no Secure — matches browser defaults.
    sameSite: https ? "none" : "lax",
    secure: https,
    ...(https ? { partitioned: true } : {}),
    expires: expiresAt,
    path: "/",
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  jar.delete(SESSION_COOKIE);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

/** Resolve the signed-in creator from the session cookie, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

/** Cryptographically strong share token (NFR-6: hard to guess). */
export function newShareToken(): string {
  return randomBytes(12).toString("base64url");
}
