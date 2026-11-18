import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });
  await db.siteRedirect.deleteMany({ where: { id: params.id, websiteId: website.id } });
  return NextResponse.json({ ok: true });
}
