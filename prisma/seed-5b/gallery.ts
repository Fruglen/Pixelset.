import type { PrismaClient } from "@prisma/client";

// Phase 5B seed data for the gallery section.
export async function seed(db: PrismaClient, userId: string) {
  const wedding = await db.collection.findFirst({ where: { slug: "emma-james-wedding", userId } });
  if (wedding) {
    // Marketing opt in capture is on for the wedding gallery, with one opt in.
    await db.collection.update({
      where: { id: wedding.id },
      data: { campaignOptIn: true, expiryReminder: true, expiryReminderDays: 3 },
    });
    await db.campaignOptIn.upsert({
      where: { collectionId_email: { collectionId: wedding.id, email: "emma@example.com" } },
      update: {},
      create: { collectionId: wedding.id, email: "emma@example.com", name: "Emma" },
    });
    // Two starred photos for the photo manager.
    const photos = await db.photo.findMany({ where: { collectionId: wedding.id, mediaType: "IMAGE" }, orderBy: { order: "asc" }, take: 4 });
    if (photos.length >= 2) {
      await db.photo.updateMany({ where: { id: { in: [photos[0].id, photos[1].id] } }, data: { starred: true } });
    }
    // A finished (submitted) favorite list, as if the client pressed "I'm done".
    if (photos.length >= 4) {
      const existing = await db.favoriteList.findFirst({ where: { collectionId: wedding.id, name: "Retouch Requests" } });
      if (!existing) {
        const list = await db.favoriteList.create({
          data: {
            collectionId: wedding.id,
            clientEmail: "emma@example.com",
            clientName: "Emma",
            name: "Retouch Requests",
            selectionLimit: 5,
            submittedAt: new Date(),
          },
        });
        await db.favorite.create({ data: { listId: list.id, photoId: photos[2].id, note: "Soften the background please" } });
        await db.favorite.create({ data: { listId: list.id, photoId: photos[3].id } });
        await db.activity.create({
          data: {
            collectionId: wedding.id,
            type: "LIST_SUBMITTED",
            detail: "“Retouch Requests” sent to the photographer (2 photos)",
            clientEmail: "emma@example.com",
          },
        });
      }
    }
  }

  const rivera = await db.collection.findFirst({ where: { slug: "rivera-family-fall", userId } });
  if (rivera) {
    await db.collection.update({ where: { id: rivera.id }, data: { campaignOptIn: true } });
  }
}
