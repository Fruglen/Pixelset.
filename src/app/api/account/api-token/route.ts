import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

// Phase 5B platform: create (or rotate) and revoke the personal API token.
// The full token is shown once, right after it is created.
// Build pack 2026-11-20: the token can upload into every collection, so only
// roles with the account settings permission (the Owner) can create, rotate or
// revoke it; GET reports whether one is active without ever returning it.

function newToken() {
  // 32 base62 characters (about 190 bits), always the same length
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(64);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < 32; i++) {
    if (bytes[i] < 248) out += alphabet[bytes[i] % 62]; // 248 = 4 * 62, keeps the choice unbiased
  }
  return `pxs_${out}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ active: !!user.apiToken });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  let token = newToken();
  while (token.length < 36) token = newToken();
  await db.user.update({ where: { id: user.id }, data: { apiToken: token } });
  return NextResponse.json({ token });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.user.update({ where: { id: user.id }, data: { apiToken: null } });
  return NextResponse.json({ ok: true });
}
