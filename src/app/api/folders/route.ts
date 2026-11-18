import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const folder = await db.folder.create({ data: { userId: user.id, name: name.trim() } });
  return NextResponse.json({ id: folder.id });
}
