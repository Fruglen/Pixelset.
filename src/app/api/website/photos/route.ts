import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Photo picker source for the website editor: the photographer's own gallery photos.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const photos = await db.photo.findMany({
    where: { collection: { userId: user.id } },
    include: { collection: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return NextResponse.json({
    photos: photos.map((p) => ({
      id: p.id,
      url: p.url,
      filename: p.filename,
      collection: p.collection.name,
    })),
  });
}
