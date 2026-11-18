import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.contact.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const contact = await own(params.id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  for (const k of ["phone", "address", "company", "tags"] as const) {
    if (typeof body[k] === "string") data[k] = body[k];
  }
  if (typeof body.email === "string") data.email = body.email.trim().toLowerCase();
  await db.contact.update({ where: { id: contact.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const contact = await own(params.id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.contact.delete({ where: { id: contact.id } });
  return NextResponse.json({ ok: true });
}
