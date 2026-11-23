import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { parseAvailability } from "@/lib/availability";
import { STUDIO_LIMITS, planFor, tierLabel } from "@/lib/plans";

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
  if (["IN_PERSON", "ZOOM", "VIDEO", "PHONE"].includes(body.locationType)) data.locationType = body.locationType;
  if (typeof body.meetingLink === "string") {
    const link = body.meetingLink.trim();
    if (link && !/^https?:\/\//.test(link)) return NextResponse.json({ error: "Meeting link must start with https://" }, { status: 400 });
    data.meetingLink = link;
  }
  // Phase 5B: availability rules, normalised through the parser so only valid rules are stored
  if (body.availability !== undefined) {
    data.availability = JSON.stringify(parseAvailability(typeof body.availability === "string" ? body.availability : JSON.stringify(body.availability)));
  }
  if (typeof body.remindersEnabled === "boolean") data.remindersEnabled = body.remindersEnabled;
  if (body.reminderHoursBefore !== undefined) data.reminderHoursBefore = Math.min(336, Math.max(1, Math.round(Number(body.reminderHoursBefore) || 24)));
  for (const k of ["durationMin", "bufferMin", "bufferBeforeMin"] as const) {
    if (body[k] !== undefined) data[k] = Math.max(k === "durationMin" ? 5 : 0, Math.round(Number(body[k]) || 0));
  }
  if (body.priceCents !== undefined) data.priceCents = Math.max(0, Math.round(Number(body.priceCents) || 0));
  if (body.taxRate !== undefined) {
    const r = Number(body.taxRate);
    if (!isNaN(r) && r >= 0 && r <= 100) data.taxRate = r;
  }
  // Phase 5B platform: retainers at booking and manual approval need Studio Manager Pro.
  const plan = await planFor(ctx.user.id);
  const limits = STUDIO_LIMITS[plan.studio];
  const locked = `needs Studio Manager Pro (your plan is ${tierLabel("studio", plan.studio)}). Upgrade in Settings > Plan.`;
  if (["PERCENT", "FIXED", "FULL"].includes(body.retainerType) && !limits.retainers) {
    return NextResponse.json({ error: `Payment at booking ${locked}` }, { status: 403 });
  }
  if (body.requiresApproval === true && !limits.manualApproval) {
    return NextResponse.json({ error: `Manual approval ${locked}` }, { status: 403 });
  }
  if (typeof body.requiresApproval === "boolean") data.requiresApproval = body.requiresApproval;
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
  const denied = await permissionError("delete");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.sessionType.delete({ where: { id: ctx.st.id } });
  return NextResponse.json({ ok: true });
}
