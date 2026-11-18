import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import CollectionsClient from "./collections-client";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const user = (await getCurrentUser())!;
  const [collections, folders, presets] = await Promise.all([
    db.collection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { photos: true } },
        photos: { take: 1, orderBy: { order: "asc" } },
      },
    }),
    db.folder.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    db.preset.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
  ]);

  const items = collections.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    status: c.status,
    folderId: c.folderId,
    eventDate: c.eventDate ? c.eventDate.toISOString() : null,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    photoCount: c._count.photos,
    cover: c.photos[0]?.url ?? "",
  }));

  return (
    <CollectionsClient
      collections={items}
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      presets={presets.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
