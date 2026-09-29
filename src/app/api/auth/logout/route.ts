import { NextResponse } from "next/server";
import { destroySession } from "@/lib/paperstring/auth-server";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
