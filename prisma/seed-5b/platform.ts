import type { PrismaClient } from "@prisma/client";

// Phase 5B seed data for the platform section: a public gallery homepage
// (/gh/light-and-shadow) listing the demo's published galleries.
export async function seed(db: PrismaClient, userId: string) {
  const clash = await db.user.findFirst({ where: { galleryHomeSlug: "light-and-shadow", NOT: { id: userId } } });
  await db.user.update({
    where: { id: userId },
    data: {
      galleryHomeSlug: clash ? null : "light-and-shadow",
      galleryHomeTitle: "Client Galleries",
    },
  });
  await db.collection.updateMany({ where: { userId, status: "PUBLISHED" }, data: { showOnHomepage: true } });
}
