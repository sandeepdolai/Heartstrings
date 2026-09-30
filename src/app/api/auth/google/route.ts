import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/paperstring/auth-server";
import { ensureDb } from "@/lib/db-init";

/**
 * Google Sign-In (GIS ID-token flow, AUTH-G).
 *
 * The browser-side Google Identity Services button hands us a signed JWT
 * ("credential"). We verify it against Google's tokeninfo endpoint — which
 * checks the signature, issuer and expiry for us — then enforce our own
 * audience + verified-email rules before trusting any claim. Only then do we
 * find-or-create the local user and open a normal PaperString session.
 */

const schema = z.object({
  credential: z.string().min(20, "Missing Google credential"),
});

interface GoogleTokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  exp?: string | number;
  iss?: string;
  error_description?: string;
}

async function verifyGoogleIdToken(
  credential: string
): Promise<
  | { ok: true; sub: string; email: string; name: string; picture: string | null }
  | { ok: false; status: number; error: string }
> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    return {
      ok: false,
      status: 503,
      error: "Google sign-in isn't configured on this server yet",
    };
  }

  let res: Response;
  try {
    res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) }
    );
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Couldn't reach Google to verify your sign-in — try again",
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: 401,
      error: "Google sign-in could not be verified — please try again",
    };
  }

  const info = (await res.json()) as GoogleTokenInfo;

  // Audience must be OUR client id (a token minted for a different app is
  // worthless here — classic token-substitution defence).
  if (info.aud !== clientId) {
    return { ok: false, status: 401, error: "Google sign-in could not be verified" };
  }

  // Issuer must be Google's accounts service.
  const iss = String(info.iss ?? "");
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
    return { ok: false, status: 401, error: "Google sign-in could not be verified" };
  }

  // Must not be expired.
  const exp = Number(info.exp ?? 0);
  if (!exp || exp * 1000 <= Date.now()) {
    return { ok: false, status: 401, error: "Google sign-in expired — please try again" };
  }

  // Email must exist and be verified by Google.
  const verified = info.email_verified === true || info.email_verified === "true";
  if (!info.email || !verified) {
    return {
      ok: false,
      status: 401,
      error:
        "Your Google account email isn't verified — verify it at myaccount.google.com first",
    };
  }

  return {
    ok: true,
    sub: String(info.sub ?? ""),
    email: info.email.toLowerCase(),
    name: info.name?.trim() || info.email.split("@")[0],
    picture: info.picture ?? null,
  };
}

export async function POST(req: NextRequest) {
  await ensureDb();
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const verified = await verifyGoogleIdToken(parsed.data.credential);
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: verified.status });
    }

    const { sub, email, name, picture } = verified;

    // Find-or-create, with account linking:
    //  1. Existing user already linked to this Google id → straight in.
    //  2. Existing email user (registered with a password) → link Google to
    //     it (Google has verified they own the email) and sign in.
    //  3. Nobody yet → create an OAuth-only account (no password hash).
    let user = await db.user.findUnique({ where: { googleId: sub } });

    if (!user) {
      const byEmail = await db.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await db.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: sub,
            ...(picture && !byEmail.image ? { image: picture } : {}),
          },
        });
      } else {
        user = await db.user.create({
          data: { email, name, passwordHash: null, googleId: sub, image: picture },
        });
      }
    } else if (picture && !user.image) {
      // Keep the avatar fresh if they add one later.
      user = await db.user
        .update({ where: { id: user.id }, data: { image: picture } })
        .catch(() => user);
    }

    await createSession(user.id);
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("[auth/google]", err);
    return NextResponse.json(
      { error: "Could not complete Google sign-in" },
      { status: 500 }
    );
  }
}
