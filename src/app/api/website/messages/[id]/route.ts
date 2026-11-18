import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function own() {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.website.findUnique({ where: { userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const website = await own();
  if (!website) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  await db.siteMessage.updateMany({
    where: { id: params.id, websiteId: website.id },
    data: { read: body.read !== false },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const website = await own();
  if (!website) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.siteMessage.deleteMany({ where: { id: params.id, websiteId: website.id } });
  return NextResponse.json({ ok: true });
}
