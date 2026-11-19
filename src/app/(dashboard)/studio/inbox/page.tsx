import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudioProfile } from "@/lib/studio";
import { studioHistory } from "@/lib/studio-history";
import { resendConnected } from "@/lib/mailer";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

// Unified inbox: Studio Manager events (bookings, payments, contracts, quotes,
// sent and received email), Client Gallery invite and delivery emails, campaign
// sends, and the website's form submissions, all in one list (Phase 5B).
export default async function StudioInboxPage({ searchParams }: { searchParams: { email?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let profile = await getStudioProfile(user.id);
  if (!profile.inboundToken) {
    profile = await db.studioProfile.update({ where: { id: profile.id }, data: { inboundToken: randomBytes(6).toString("hex") } });
  }

  const website = await db.website.findUnique({ where: { userId: user.id } });
  const [history, siteMessages] = await Promise.all([
    studioHistory(user.id),
    website ? db.siteMessage.findMany({ where: { websiteId: website.id }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);

  const merged = [
    ...history.map((m) => ({
      id: m.id,
      source: m.source === "STUDIO" ? ("studio" as const) : ("gallery" as const),
      kind: m.source === "GALLERY_INVITE" || m.source === "GALLERY_DOWNLOAD" ? "GALLERY" : m.kind,
      direction: m.direction,
      name: m.name,
      email: m.email,
      subject: m.subject,
      body: m.body,
      meta: m.meta,
      read: m.read,
      createdAt: m.createdAt,
      href: m.href,
    })),
    ...siteMessages.map((m) => ({
      id: m.id,
      source: "website" as const,
      kind: m.kind === "CONTACT" ? "WEBSITE" : m.kind,
      direction: "IN" as const,
      name: m.name,
      email: m.email,
      subject: m.subject || (m.kind === "NEWSLETTER" ? "Newsletter signup" : "Website message"),
      body: m.body,
      meta: [m.phone, m.meta].filter(Boolean).join(" · "),
      read: m.read,
      createdAt: m.createdAt.toISOString(),
      href: "",
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const domain = process.env.INBOUND_EMAIL_DOMAIN || "";
  return (
    <InboxClient
      messages={merged}
      initialSearch={searchParams.email ?? ""}
      sending={resendConnected()}
      receiving={Boolean(process.env.INBOUND_EMAIL_SECRET)}
      inboundAddress={domain ? `inbox+${profile.inboundToken}@${domain}` : ""}
      inboundToken={profile.inboundToken}
    />
  );
}
