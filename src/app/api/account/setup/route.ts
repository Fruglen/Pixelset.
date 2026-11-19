import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Phase 5B platform: hide or show a setup checklist, and confirm the starter template.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const list = new Set(user.setupDismissed.split(",").filter(Boolean));
  if (["studio", "website"].includes(body.dismiss)) list.add(body.dismiss);
  if (["studio", "website"].includes(body.show)) list.delete(body.show);
  await db.user.update({ where: { id: user.id }, data: { setupDismissed: Array.from(list).join(",") } });
  if (body.keepTemplate === true) {
    await db.website.updateMany({ where: { userId: user.id }, data: { templateChosen: true } });
  }
  return NextResponse.json({ ok: true });
}
