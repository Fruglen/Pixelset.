import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import MobileAppsClient from "./mobile-apps-client";

export const dynamic = "force-dynamic";

export default async function MobileAppPage() {
  const user = (await getCurrentUser())!;
  const [apps, collections] = await Promise.all([
    db.mobileApp.findMany({
      where: { userId: user.id },
      include: { collection: { include: { photos: { take: 1, orderBy: { order: "asc" } } } } },
      orderBy: { createdAt: "desc" },
    }),
    db.collection.findMany({
      where: { userId: user.id, mobileApp: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <MobileAppsClient
      apps={apps.map((a) => ({
        id: a.id,
        slug: a.slug,
        appName: a.appName,
        accentColor: a.accentColor,
        contactEmail: a.contactEmail,
        contactPhone: a.contactPhone,
        enabled: a.enabled,
        collectionName: a.collection.name,
        coverUrl: a.collection.photos[0]?.url ?? "",
      }))}
      collections={collections}
      defaultEmail={user.email}
    />
  );
}
