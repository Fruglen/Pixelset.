import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PROJECT_STAGES } from "@/lib/studio";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.project.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await own(params.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.notes === "string") data.notes = body.notes;
  if (PROJECT_STAGES.includes(body.stage)) {
    data.stage = body.stage;
    if (body.order === undefined) {
      const max = await db.project.aggregate({
        where: { userId: project.userId, stage: body.stage },
        _max: { order: true },
      });
      data.order = (max._max.order ?? 0) + 1;
    }
  }
  if (body.order !== undefined) data.order = Math.max(0, Math.round(Number(body.order) || 0));
  await db.project.update({ where: { id: project.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await own(params.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.project.delete({ where: { id: project.id } });
  return NextResponse.json({ ok: true });
}
