import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Phase 5B platform: create (or rotate) and revoke the personal API token.
// The full token is shown once, right after it is created.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = `pxs_${randomBytes(24).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 32)}`;
  await db.user.update({ where: { id: user.id }, data: { apiToken: token } });
  return NextResponse.json({ token });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.user.update({ where: { id: user.id }, data: { apiToken: null } });
  return NextResponse.json({ ok: true });
}
