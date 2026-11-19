import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isMemberSession, permissionError, ROLES, setActiveRole, type Role } from "@/lib/team";
import { sendTeamInvite } from "@/lib/team-invite";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  // Role switcher: the owner previews a different seat (enforced server-side
  // on guarded endpoints). Team member logins can never switch: their role is
  // bound to their session at login.
  if (typeof body.workAs === "string") {
    if (await isMemberSession()) {
      return NextResponse.json({ error: "Team members can't switch roles. Your role is set by the studio Owner." }, { status: 403 });
    }
    if (!ROLES.includes(body.workAs as Role)) {
      return NextResponse.json({ error: "Unknown role" }, { status: 400 });
    }
    setActiveRole(body.workAs as Role);
    return NextResponse.json({ ok: true });
  }

  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role === "SECOND_SHOOTER" ? "SECOND_SHOOTER" : "ASSISTANT";
  if (!name || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "Name and a valid email are required" }, { status: 400 });
  }
  const clash = await db.teamMember.findUnique({ where: { userId_email: { userId: user.id, email } } });
  if (clash) return NextResponse.json({ error: "That email is already on the team" }, { status: 409 });

  const member = await db.teamMember.create({ data: { userId: user.id, name, email, role } });
  // Real login invite: sets a token and emails the set-password link through
  // the mailer (delivered via Resend when connected; the link is also returned
  // so the owner can share it by hand when email is logged only).
  const invite = await sendTeamInvite(member.id);
  return NextResponse.json({ id: member.id, invite });
}
