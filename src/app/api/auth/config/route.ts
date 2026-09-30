import { NextResponse } from "next/server";

/**
 * Public auth capability flags. The auth screen asks this on load so it can
 * decide between rendering the real Google Identity Services button (when
 * GOOGLE_CLIENT_ID is set) or the friendly "how to enable it" dialog.
 *
 * The Google OAuth client id is public by design — it identifies the app to
 * Google's frontend SDK, it is not a secret.
 */
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || null;
  return NextResponse.json({
    googleEnabled: !!clientId,
    googleClientId: clientId,
  });
}
