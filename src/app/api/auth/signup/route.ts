import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { name, businessName, email, password } = await req.json();
  if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  const normalized = email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  const user = await db.user.create({
    data: {
      email: normalized,
      name: name.trim(),
      businessName: typeof businessName === "string" ? businessName.trim() : "",
      watermarkText: typeof businessName === "string" && businessName.trim() ? businessName.trim() : name.trim(),
      passwordHash: hashPassword(password),
    },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
