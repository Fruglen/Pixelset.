import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({
    where: { id: params.id, userId: user.id },
    include: { sets: { orderBy: { order: "desc" }, take: 1 } },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name } = await req.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const order = (collection.sets[0]?.order ?? -1) + 1;
  const set = await db.photoSet.create({
    data: { collectionId: collection.id, name: name.trim(), order },
  });
  return NextResponse.json({ id: set.id });
}
