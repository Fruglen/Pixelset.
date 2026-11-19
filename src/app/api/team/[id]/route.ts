import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { sendTeamInvite } from "@/lib/team-invite";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.teamMember.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const member = await owned(params.id);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json();
  // Resend the login invite (fresh token + set-password email).
  if (body.action === "resendInvite") {
    if (member.loginUserId) return NextResponse.json({ error: "This member already has a login" }, { status: 400 });
    const invite = await sendTeamInvite(member.id);
    return NextResponse.json({ ok: true, invite });
  }
  const data: Record<string, unknown> = {};
  if (body.role === "ASSISTANT" || body.role === "SECOND_SHOOTER") data.role = body.role;
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  await db.teamMember.update({ where: { id: member.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const member = await owned(params.id);
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  // Removing a member also retires their login: sessions end and the login
  // account is deleted, so the seat can't sign in any more.
  if (member.loginUserId) {
    await db.session.deleteMany({ where: { userId: member.loginUserId } });
    await db.teamMember.update({ where: { id: member.id }, data: { loginUserId: null, inviteToken: null, inviteExpiresAt: null } });
    await db.user.delete({ where: { id: member.loginUserId } }).catch(() => {});
  }
  await db.teamMember.delete({ where: { id: member.id } });
  return NextResponse.json({ ok: true });
}
