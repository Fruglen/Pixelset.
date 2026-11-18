import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { photoIds } = await req.json();
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return NextResponse.json({ error: "Select at least one photo" }, { status: 400 });
  }
  const photos = await db.photo.findMany({
    where: { id: { in: photoIds.filter((p: unknown) => typeof p === "string") }, collectionId: collection.id },
    select: { id: true },
  });
  if (photos.length === 0) return NextResponse.json({ error: "No valid photos" }, { status: 400 });

  const token = randomBytes(10).toString("hex");
  const qs = await db.quickShare.create({
    data: {
      collectionId: collection.id,
      token,
      photoIds: photos.map((p) => p.id).join(","),
    },
  });
  await logActivity(collection.id, "QUICK_SHARE_CREATED", `${photos.length} photos shared via quick link`);
  return NextResponse.json({ token: qs.token });
}
