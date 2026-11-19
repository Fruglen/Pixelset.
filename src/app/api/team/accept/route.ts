import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

// Accept a team invite: the member sets their own password, which creates
// their login User (teamOwnerId -> the studio account) and signs them in
// with their TeamMember role bound to the session.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (!token) return NextResponse.json({ error: "Invite token missing" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "Choose a password of at least 8 characters" }, { status: 400 });
  }
  const member = await db.teamMember.findUnique({ where: { inviteToken: token }, include: { user: true } });
  if (!member || member.loginUserId) {
    return NextResponse.json({ error: "This invite link is no longer valid. Ask the studio owner to send a new one." }, { status: 400 });
  }
  if (!member.inviteExpiresAt || member.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: "This invite link has expired. Ask the studio owner to send a new one." }, { status: 400 });
  }
  const clash = await db.user.findUnique({ where: { email: member.email } });
  if (clash) {
    return NextResponse.json(
      { error: "An account with this email already exists. Sign in with that account, or ask the owner to invite a different email." },
      { status: 409 }
    );
  }
  const loginUser = await db.user.create({
    data: {
      email: member.email,
      name: member.name,
      passwordHash: hashPassword(password),
      teamOwnerId: member.userId,
      plan: member.user.plan,
      businessName: member.user.businessName,
      onboardedAt: new Date(),
    },
  });
  await db.teamMember.update({
    where: { id: member.id },
    data: { loginUserId: loginUser.id, inviteToken: null, inviteExpiresAt: null },
  });
  await createSession(loginUser.id, member.role);
  return NextResponse.json({ ok: true });
}
