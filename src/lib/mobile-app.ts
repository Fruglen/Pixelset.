import { db } from "./db";

// Phase 5B: /app/<slug> serves either a collection's app (shared link) or a
// per client install of it (own slug, greeting, manifest).
export async function resolveMobileApp(slug: string) {
  const include = {
    collection: { include: { photos: { orderBy: { order: "asc" as const } } } },
    user: {
      select: {
        businessName: true,
        name: true,
        // Night build (Mobile App): the photographer's social links live on
        // their website settings and are shown inside the app too.
        website: { select: { socialInstagram: true, socialFacebook: true, socialPinterest: true } },
      },
    },
  };
  const app = await db.mobileApp.findUnique({ where: { slug }, include });
  if (app) return { app, client: null };
  const client = await db.mobileAppClient.findUnique({ where: { slug } });
  if (!client) return null;
  const parent = await db.mobileApp.findUnique({ where: { id: client.appId }, include });
  if (!parent) return null;
  return { app: parent, client };
}

export function greetingFor(client: { clientName: string; greeting: string } | null, collectionName: string): string {
  if (!client) return "";
  const first = client.clientName.split(" ")[0] || client.clientName;
  return client.greeting
    ? client.greeting.replace(/\{name\}/g, first)
    : `Welcome, ${first}. Your photos from ${collectionName} are ready.`;
}
