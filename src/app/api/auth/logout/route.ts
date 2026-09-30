import { NextResponse } from "next/server";
import { destroySession } from "@/lib/paperstring/auth-server";
import { ensureDb } from "@/lib/db-init";

export async function POST() {
  await ensureDb();
  await destroySession();
  return NextResponse.json({ ok: true });
}
