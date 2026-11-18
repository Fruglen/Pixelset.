import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import EditorClient from "./editor-client";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const user = (await getCurrentUser())!;
  const collections = await db.collection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      // The canvas editor works on images; videos and RAW originals are not editable here.
      photos: {
        where: { mediaType: "IMAGE" },
        orderBy: { order: "asc" },
        select: { id: true, url: true, filename: true },
      },
    },
  });

  return (
    <EditorClient
      collections={collections
        .filter((c) => c.photos.length > 0)
        .map((c) => ({ id: c.id, name: c.name, photos: c.photos }))}
    />
  );
}
