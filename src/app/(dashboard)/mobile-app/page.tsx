import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { planFor, GALLERY_LIMITS, tierLabel } from "@/lib/plans";
import MobileAppsClient from "./mobile-apps-client";

export const dynamic = "force-dynamic";

export default async function MobileAppPage() {
  const user = (await getCurrentUser())!;
  const plan = await planFor(user.id);
  const appLimit = GALLERY_LIMITS[plan.gallery].mobileApps;
  const [apps, collections, clients, contacts] = await Promise.all([
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
    db.mobileAppClient.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.contact.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
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
        clients: clients
          .filter((c) => c.appId === a.id)
          .map((c) => ({
            id: c.id,
            slug: c.slug,
            clientName: c.clientName,
            clientEmail: c.clientEmail,
            greeting: c.greeting,
            lastOpenedAt: c.lastOpenedAt ? c.lastOpenedAt.toISOString() : null,
          })),
      }))}
      contacts={contacts}
      collections={collections}
      defaultEmail={user.email}
      planInfo={{
        label: tierLabel("gallery", plan.gallery),
        limit: Number.isFinite(appLimit) ? appLimit : null,
        used: apps.length,
      }}
    />
  );
}
