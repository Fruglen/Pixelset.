import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const contact = await db.contact.findFirst({ where: { id: params.id, userId: user.id } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Write a note first" }, { status: 400 });
  const note = await db.contactNote.create({ data: { contactId: contact.id, body: text } });
  return NextResponse.json({ id: note.id });
}
