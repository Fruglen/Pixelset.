import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignAllowance } from "@/lib/plans";
import { resendConnected } from "@/lib/mailer";
import CampaignsClient from "./campaigns-client";

export const dynamic = "force-dynamic";

// Fix batch 2026-11-20: email campaign builder.
export default async function CampaignsPage() {
  const user = (await getCurrentUser())!;
  const [campaigns, allowance, collections, optIns, contacts] = await Promise.all([
    db.campaign.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { sends: { orderBy: { createdAt: "asc" } } },
    }),
    campaignAllowance(user.id),
    db.collection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, _count: { select: { registrations: true } } },
    }),
    db.campaignOptIn.count({ where: { collection: { userId: user.id } } }),
    db.contact.count({ where: { userId: user.id, email: { not: "" } } }),
  ]);
  return (
    <div>
      <h1 className="font-display text-2xl mb-1">Email campaigns</h1>
      <p className="text-sm text-neutral-500 mb-5">
        Print sales, mini session announcements and review requests, sent to your gallery marketing opt ins, your
        studio contacts, or the people registered on one collection. Sends count against your plan&apos;s monthly
        campaign allowance. <Link href="/help#campaigns" className="underline">How campaigns work</Link>
      </p>
      <CampaignsClient
        connected={resendConnected()}
        allowance={{ limit: allowance.limit, used: allowance.used, remaining: allowance.remaining }}
        sources={{
          optIns,
          contacts,
          collections: collections.map((c) => ({ id: c.id, name: c.name, registrations: c._count.registrations })),
        }}
        campaigns={campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          subject: c.subject,
          body: c.body,
          audience: c.audience,
          status: c.status,
          sentAt: c.sentAt ? c.sentAt.toISOString() : null,
          sends: c.sends.map((s) => ({ id: s.id, email: s.email, status: s.status, detail: s.detail, createdAt: s.createdAt.toISOString() })),
        }))}
      />
    </div>
  );
}
