import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError, ROLES, setActiveRole, type Role } from "@/lib/team";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  // Role switcher: work as a different seat (enforced server-side on guarded
  // endpoints). Switching is always allowed, otherwise a non-Owner preview
  // could never switch back.
  if (typeof body.workAs === "string") {
    if (!ROLES.includes(body.workAs as Role)) {
      return NextResponse.json({ error: "Unknown role" }, { status: 400 });
    }
    setActiveRole(body.workAs as Role);
    return NextResponse.json({ ok: true });
  }

  const denied = permissionError("settings");
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
  return NextResponse.json({ id: member.id });
}
