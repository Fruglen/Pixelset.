import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.businessName === "string") data.businessName = body.businessName.trim();
  if (typeof body.watermarkText === "string") data.watermarkText = body.watermarkText.trim();
  if (typeof body.mailFrom === "string") data.mailFrom = body.mailFrom.trim();

  if (typeof body.newPassword === "string" && body.newPassword) {
    if (typeof body.currentPassword !== "string" || !verifyPassword(body.currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    data.passwordHash = hashPassword(body.newPassword);
  }

  await db.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}
