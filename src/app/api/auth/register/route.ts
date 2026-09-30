import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/paperstring/auth-server";
import { ensureDb } from "@/lib/db-init";

const schema = z.object({
  name: z.string().trim().min(1, "Please tell us your name").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export async function POST(req: NextRequest) {
  await ensureDb();
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in." },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: { name, email, passwordHash: hashPassword(password) },
    });
    await createSession(user.id);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, image: user.image, createdAt: user.createdAt },
    });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Could not create your account" }, { status: 500 });
  }
}
