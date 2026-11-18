import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { triggerById, parseConditions, parseActions } from "@/lib/automations";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const trigger = triggerById(String(body.trigger ?? ""));
  if (!trigger) return NextResponse.json({ error: "Unknown trigger" }, { status: 400 });

  const conditions = parseConditions(JSON.stringify(body.conditions ?? []));
  const actions = parseActions(JSON.stringify(body.actions ?? []));
  if (actions.length === 0) return NextResponse.json({ error: "Add at least one action" }, { status: 400 });

  const automation = await db.automation.create({
    data: {
      userId: user.id,
      name,
      trigger: trigger.id,
      conditions: JSON.stringify(conditions),
      actions: JSON.stringify(actions),
      active: body.active !== false,
    },
  });
  return NextResponse.json({ id: automation.id });
}
