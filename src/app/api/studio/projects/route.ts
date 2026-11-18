import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PROJECT_STAGES } from "@/lib/studio";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const stage = PROJECT_STAGES.includes(body.stage) ? body.stage : "INQUIRY";
  let contactId: string | null = null;
  if (typeof body.contactId === "string" && body.contactId) {
    const c = await db.contact.findFirst({ where: { id: body.contactId, userId: user.id } });
    if (c) contactId = c.id;
  }
  const max = await db.project.aggregate({ where: { userId: user.id, stage }, _max: { order: true } });
  const project = await db.project.create({
    data: { userId: user.id, name, stage, contactId, order: (max._max.order ?? 0) + 1 },
  });
  return NextResponse.json({ id: project.id });
}
