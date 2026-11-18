import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MessagesClient } from "./messages-client";

export const dynamic = "force-dynamic";

export default async function WebsiteMessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) redirect("/website");

  const messages = await db.siteMessage.findMany({
    where: { websiteId: website.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <MessagesClient
      messages={messages.map((m) => ({
        id: m.id,
        kind: m.kind,
        name: m.name,
        email: m.email,
        phone: m.phone,
        subject: m.subject,
        body: m.body,
        meta: m.meta,
        read: m.read,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  );
}
