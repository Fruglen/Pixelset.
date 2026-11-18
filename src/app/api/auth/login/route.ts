import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
