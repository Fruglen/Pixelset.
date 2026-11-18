import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

// Unified inbox: Studio Manager events (bookings, payments, contracts, quotes,
// logged emails) merged with the Phase 2 website's form submissions.
export default async function StudioInboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const website = await db.website.findUnique({ where: { userId: user.id } });
  const [studioMessages, siteMessages] = await Promise.all([
    db.studioMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    website
      ? db.siteMessage.findMany({ where: { websiteId: website.id }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
  ]);

  const merged = [
    ...studioMessages.map((m) => ({
      id: m.id,
      source: "studio" as const,
      kind: m.kind,
      name: m.name,
      email: m.email,
      subject: m.subject,
      body: m.body,
      meta: m.meta,
      read: m.read,
      createdAt: m.createdAt.toISOString(),
    })),
    ...siteMessages.map((m) => ({
      id: m.id,
      source: "website" as const,
      kind: m.kind === "CONTACT" ? "WEBSITE" : m.kind,
      name: m.name,
      email: m.email,
      subject: m.subject || (m.kind === "NEWSLETTER" ? "Newsletter signup" : "Website message"),
      body: m.body,
      meta: [m.phone, m.meta].filter(Boolean).join(" · "),
      read: m.read,
      createdAt: m.createdAt.toISOString(),
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return <InboxClient messages={merged} />;
}
