import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const st = await db.sessionType.findFirst({ where: { id, userId: user.id } });
  return st ? { user, st } : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await own(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  for (const k of ["description", "coverUrl", "location", "cancellationPolicy"] as const) {
    if (typeof body[k] === "string") data[k] = body[k];
  }
  if (body.locationType === "IN_PERSON" || body.locationType === "ZOOM") data.locationType = body.locationType;
  for (const k of ["durationMin", "bufferMin"] as const) {
    if (body[k] !== undefined) data[k] = Math.max(k === "durationMin" ? 5 : 0, Math.round(Number(body[k]) || 0));
  }
  if (body.priceCents !== undefined) data.priceCents = Math.max(0, Math.round(Number(body.priceCents) || 0));
  if (body.taxRate !== undefined) {
    const r = Number(body.taxRate);
    if (!isNaN(r) && r >= 0 && r <= 100) data.taxRate = r;
  }
  if (["NONE", "PERCENT", "FIXED", "FULL"].includes(body.retainerType)) data.retainerType = body.retainerType;
  if (body.retainerValue !== undefined) data.retainerValue = Math.max(0, Math.round(Number(body.retainerValue) || 0));
  for (const k of ["active", "published", "showBookedSpots", "waitlistEnabled"] as const) {
    if (typeof body[k] === "boolean") data[k] = body[k];
  }
  if (body.contractTemplateId !== undefined) {
    if (body.contractTemplateId === null || body.contractTemplateId === "") data.contractTemplateId = null;
    else {
      const t = await db.contractTemplate.findFirst({ where: { id: body.contractTemplateId, userId: ctx.user.id } });
      if (t) data.contractTemplateId = t.id;
    }
  }
  if (body.questionnaireId !== undefined) {
    if (body.questionnaireId === null || body.questionnaireId === "") data.questionnaireId = null;
    else {
      const q = await db.questionnaire.findFirst({ where: { id: body.questionnaireId, userId: ctx.user.id } });
      if (q) data.questionnaireId = q.id;
    }
  }

  await db.sessionType.update({ where: { id: ctx.st.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await own(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.sessionType.delete({ where: { id: ctx.st.id } });
  return NextResponse.json({ ok: true });
}
