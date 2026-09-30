import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/paperstring/auth-server";
import { ensureDb } from "@/lib/db-init";

export async function GET() {
  await ensureDb();
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, image: user.image, createdAt: user.createdAt },
  });
}
