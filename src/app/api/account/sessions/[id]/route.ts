import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

// Night build (Pricing lane): revoke one of the account's login sessions
// from Settings > Security. Only the owner's own sessions can be revoked.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const session = await db.session.findFirst({ where: { id: params.id, userId: user.id } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  await db.session.delete({ where: { id: session.id } });
  return NextResponse.json({ ok: true });
}
