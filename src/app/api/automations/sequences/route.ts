import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { SEQUENCE_TEMPLATES } from "@/lib/automations";

// Phase 5B: add the ready made multi step marketing sequences (skips ones already added by name).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await db.automation.findMany({ where: { userId: user.id }, select: { name: true } });
  const names = new Set(existing.map((a) => a.name));
  let added = 0;
  for (const t of SEQUENCE_TEMPLATES) {
    if (names.has(t.name)) continue;
    await db.automation.create({
      data: {
        userId: user.id,
        name: t.name,
        trigger: t.trigger,
        conditions: JSON.stringify(t.conditions),
        actions: JSON.stringify(t.actions),
        steps: JSON.stringify(t.steps),
        active: true,
      },
    });
    added++;
  }
  return NextResponse.json({ added });
}
