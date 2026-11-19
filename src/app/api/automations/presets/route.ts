import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PRESET_AUTOMATIONS } from "@/lib/automations";

// Phase 5B: add the five preset reminder automations (skips any already present).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await db.automation.findMany({ where: { userId: user.id }, select: { trigger: true, name: true } });
  let added = 0;
  for (const p of PRESET_AUTOMATIONS) {
    if (existing.some((e) => e.name === p.name || (e.trigger === p.trigger && p.trigger !== "INVOICE_UNPAID"))) continue;
    await db.automation.create({
      data: { userId: user.id, name: p.name, trigger: p.trigger, conditions: JSON.stringify(p.conditions), actions: JSON.stringify(p.actions), active: true },
    });
    added++;
  }
  return NextResponse.json({ added });
}
