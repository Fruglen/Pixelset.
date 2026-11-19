import { db } from "./db";

// Phase 5B: one unified history across products. Studio messages (bookings,
// contracts, invoices, quotes, questionnaires, inbound and outbound email),
// Client Gallery invite and delivery emails, Download All delivery links, and
// marketing campaign sends, merged into a single time ordered list. Gallery
// records are read from their own tables, so nothing is duplicated.

export interface HistoryEntry {
  id: string;
  source: "STUDIO" | "GALLERY_INVITE" | "GALLERY_DOWNLOAD" | "CAMPAIGN";
  kind: string;
  direction: "IN" | "OUT" | "EVENT";
  name: string;
  email: string;
  subject: string;
  body: string;
  meta: string;
  read: boolean;
  createdAt: string;
  href: string;
}

export async function studioHistory(userId: string, opts: { email?: string; take?: number } = {}): Promise<HistoryEntry[]> {
  const email = opts.email?.toLowerCase();
  const take = opts.take ?? 300;
  const [messages, invites, downloads, sends] = await Promise.all([
    db.studioMessage.findMany({
      where: { userId, ...(email ? { email } : {}) },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.invite.findMany({
      where: { collection: { userId }, ...(email ? { email } : {}) },
      include: { collection: { select: { name: true, slug: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.downloadJob.findMany({
      where: { collection: { userId }, ...(email ? { email } : {}) },
      include: { collection: { select: { name: true, id: true } } },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.campaignSend.findMany({
      where: { campaign: { userId }, ...(email ? { email } : {}) },
      include: { campaign: { select: { name: true, subject: true, body: true } } },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  const out: HistoryEntry[] = [
    ...messages.map((m) => ({
      id: m.id,
      source: "STUDIO" as const,
      kind: m.kind,
      direction: (m.kind === "INBOUND" ? "IN" : m.kind === "EMAIL" ? "OUT" : "EVENT") as HistoryEntry["direction"],
      name: m.name,
      email: m.email,
      subject: m.subject,
      body: m.body,
      meta: m.meta,
      read: m.read,
      createdAt: m.createdAt.toISOString(),
      href: "",
    })),
    ...invites.map((i) => ({
      id: `invite:${i.id}`,
      source: "GALLERY_INVITE" as const,
      kind: "GALLERY",
      direction: "OUT" as const,
      name: i.recipientName,
      email: i.email,
      subject: i.subject || `Gallery invite: ${i.collection.name}`,
      body: i.message || `Invited to view the gallery ${i.collection.name}.`,
      meta: [i.status === "SCHEDULED" ? "Scheduled" : "", i.deliveryNote].filter(Boolean).join(" · "),
      read: true,
      createdAt: (i.sentAt ?? i.createdAt).toISOString(),
      href: `/collections/${i.collection.id}`,
    })),
    ...downloads.map((d) => ({
      id: `download:${d.id}`,
      source: "GALLERY_DOWNLOAD" as const,
      kind: "GALLERY",
      direction: "OUT" as const,
      name: "",
      email: d.email,
      subject: `Gallery download link: ${d.collection.name}`,
      body: `Download All link (${d.size}) for ${d.collection.name}, expires ${d.expiresAt.toLocaleDateString("en-US")}.`,
      meta: d.status === "FAILED" ? `Failed: ${d.error}` : d.status === "READY" ? "Ready" : "Preparing",
      read: true,
      createdAt: d.createdAt.toISOString(),
      href: `/collections/${d.collection.id}`,
    })),
    ...sends.map((s) => ({
      id: `campaign:${s.id}`,
      source: "CAMPAIGN" as const,
      kind: "CAMPAIGN",
      direction: "OUT" as const,
      name: "",
      email: s.email,
      subject: s.campaign.subject || s.campaign.name,
      body: s.campaign.body,
      meta: [s.status === "DELIVERED" ? "Delivered" : s.status === "FAILED" ? "Failed" : "Logged only", s.detail].filter(Boolean).join(" · "),
      read: true,
      createdAt: s.createdAt.toISOString(),
      href: "",
    })),
  ];
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, take);
}
