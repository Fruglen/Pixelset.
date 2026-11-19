import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanGroup, codeTaken, ownedCollection } from "../shared";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; groupId: string } }) {
  const c = await ownedCollection(params.id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const existing = await db.accessGroup.findFirst({ where: { id: params.groupId, collectionId: c.id } });
  if (!existing) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  const { data, error } = cleanGroup(await req.json().catch(() => ({})), c.sets.map((s) => s.id));
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (data.code && (await codeTaken(c.id, data.code, existing.id))) {
    return NextResponse.json({ error: "That code is already used in this gallery" }, { status: 409 });
  }
  const group = await db.accessGroup.update({ where: { id: existing.id }, data });
  return NextResponse.json({ group });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; groupId: string } }) {
  const c = await ownedCollection(params.id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.accessGroup.deleteMany({ where: { id: params.groupId, collectionId: c.id } });
  return NextResponse.json({ ok: true });
}
