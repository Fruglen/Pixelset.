import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const note = await db.contactNote.findFirst({
    where: { id: params.id, contact: { userId: user.id } },
  });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.contactNote.delete({ where: { id: note.id } });
  return NextResponse.json({ ok: true });
}
