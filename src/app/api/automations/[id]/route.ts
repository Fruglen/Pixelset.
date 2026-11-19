import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseConditions, parseActions, parseSteps } from "@/lib/automations";

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.automation.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const automation = await owned(params.id);
  if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.active === "boolean") data.active = body.active;
  if ("conditions" in body) data.conditions = JSON.stringify(parseConditions(JSON.stringify(body.conditions ?? [])));
  if ("actions" in body) {
    const actions = parseActions(JSON.stringify(body.actions ?? []));
    if (actions.length === 0) return NextResponse.json({ error: "Add at least one action" }, { status: 400 });
    data.actions = JSON.stringify(actions);
  }
  if ("steps" in body) data.steps = JSON.stringify(parseSteps(JSON.stringify(body.steps ?? [])));
  await db.automation.update({ where: { id: automation.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const automation = await owned(params.id);
  if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.automation.delete({ where: { id: automation.id } });
  return NextResponse.json({ ok: true });
}
