import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "CHANGES_REQUESTED"];

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.albumDesign.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const design = await owned(params.id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.status === "string" && STATUSES.includes(body.status)) {
    // The studio drives the review flow: approve a submitted design, or send
    // it back for changes (which reopens it for the client to edit).
    if (body.status === "APPROVED" && design.status !== "SUBMITTED") {
      return NextResponse.json({ error: "Only a submitted design can be approved" }, { status: 400 });
    }
    if (body.status === "CHANGES_REQUESTED" && design.status !== "SUBMITTED") {
      return NextResponse.json({ error: "Only a submitted design can be sent back for changes" }, { status: 400 });
    }
    data.status = body.status;
  }
  await db.albumDesign.update({ where: { id: design.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const design = await owned(params.id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = permissionError("manage_store");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.albumDesign.delete({ where: { id: design.id } });
  return NextResponse.json({ ok: true });
}
