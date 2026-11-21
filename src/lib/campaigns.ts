import { db } from "./db";
import { campaignAllowance } from "./plans";
import { deliveryNote, resendConnected, sendMail } from "./mailer";

// Fix batch 2026-11-20: built in email campaigns (print sales, mini session
// announcements, review requests). A campaign has a subject, a body and one
// recipient source. Sending goes through the shared mailer (Resend when
// connected, honest logged-only records otherwise), writes one CampaignSend
// row per recipient, and is metered against campaignAllowance() at send time:
// a send that would go over the month's allowance is refused before any
// email leaves, with the allowance named.

export const CAMPAIGN_KINDS = [
  { id: "PRINT_SALE", label: "Print sale" },
  { id: "MINI_SESSION", label: "Mini session announcement" },
  { id: "REVIEW_REQUEST", label: "Review request" },
  { id: "CUSTOM", label: "Custom" },
] as const;

export type AudienceSource = "OPT_INS" | "CONTACTS" | `COLLECTION:${string}`;

export function validAudience(a: unknown): a is AudienceSource {
  return a === "OPT_INS" || a === "CONTACTS" || (typeof a === "string" && /^COLLECTION:[\w-]+$/.test(a));
}

export interface Recipient {
  email: string;
  name: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dedupe(list: Recipient[]): Recipient[] {
  const seen = new Map<string, Recipient>();
  for (const r of list) {
    const email = r.email.trim().toLowerCase();
    if (!EMAIL.test(email)) continue;
    if (!seen.has(email)) seen.set(email, { email, name: r.name.trim() });
    else if (!seen.get(email)!.name && r.name.trim()) seen.get(email)!.name = r.name.trim();
  }
  return Array.from(seen.values());
}

/** Recipients for a source, deduplicated by address, invalid addresses dropped. */
export async function resolveAudience(userId: string, audience: string): Promise<Recipient[]> {
  if (audience === "OPT_INS") {
    const rows = await db.campaignOptIn.findMany({
      where: { collection: { userId } },
      select: { email: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    return dedupe(rows);
  }
  if (audience === "CONTACTS") {
    const rows = await db.contact.findMany({ where: { userId }, select: { email: true, name: true }, orderBy: { createdAt: "asc" } });
    return dedupe(rows);
  }
  const m = audience.match(/^COLLECTION:([\w-]+)$/);
  if (m) {
    const collection = await db.collection.findFirst({ where: { id: m[1], userId }, select: { id: true } });
    if (!collection) return [];
    const rows = await db.emailRegistration.findMany({
      where: { collectionId: collection.id },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    return dedupe(rows.map((r) => ({ email: r.email, name: "" })));
  }
  return [];
}

export async function audienceLabel(userId: string, audience: string): Promise<string> {
  if (audience === "OPT_INS") return "Gallery marketing opt ins";
  if (audience === "CONTACTS") return "Studio contacts";
  const m = audience.match(/^COLLECTION:([\w-]+)$/);
  if (m) {
    const c = await db.collection.findFirst({ where: { id: m[1], userId }, select: { name: true } });
    return c ? `Registrations on ${c.name}` : "Registrations on a deleted collection";
  }
  return "Unknown audience";
}

/** Personalise a body or subject: {name} becomes the first name, or "there" when unknown. */
export function personalise(text: string, r: Recipient, business: string): string {
  const first = r.name.split(/\s+/)[0] || "there";
  return text.replace(/\{name\}/g, first).replace(/\{business\}/g, business);
}

export type SendOutcome =
  | { ok: true; total: number; delivered: number; logged: number; failed: number; mode: "resend" | "logged" }
  | { ok: false; status: number; error: string; allowance?: { limit: number; used: number; remaining: number } };

export async function sendCampaign(userId: string, campaignId: string): Promise<SendOutcome> {
  const campaign = await db.campaign.findFirst({ where: { id: campaignId, userId } });
  if (!campaign) return { ok: false, status: 404, error: "Campaign not found" };
  if (campaign.status === "SENT") return { ok: false, status: 409, error: "This campaign was already sent. Duplicate it to send again." };
  if (!campaign.subject.trim() || !campaign.body.trim()) return { ok: false, status: 400, error: "Add a subject and a message before sending" };
  const recipients = await resolveAudience(userId, campaign.audience);
  if (recipients.length === 0) return { ok: false, status: 400, error: "That recipient source has no valid email addresses yet" };

  // Metering happens here, at send time, against the live allowance.
  const allowance = await campaignAllowance(userId);
  if (recipients.length > allowance.remaining) {
    return {
      ok: false,
      status: 402,
      error: `Over your campaign allowance: your plan includes ${allowance.limit.toLocaleString("en-US")} campaign sends a month, ${allowance.used.toLocaleString("en-US")} are used and ${allowance.remaining.toLocaleString("en-US")} remain, but this campaign needs ${recipients.length.toLocaleString("en-US")}. Nothing was sent. Add an extra campaign block in Settings, Plan, or narrow the recipients.`,
      allowance: { limit: allowance.limit, used: allowance.used, remaining: allowance.remaining },
    };
  }

  const owner = await db.user.findUnique({ where: { id: userId }, select: { businessName: true, name: true } });
  const business = owner?.businessName || owner?.name || "your photographer";
  let delivered = 0;
  let logged = 0;
  let failed = 0;
  for (const r of recipients) {
    const subject = personalise(campaign.subject, r, business);
    const text = `${personalise(campaign.body, r, business)}\n\nYou are receiving this email from ${business}. Reply to this email to stop receiving these messages.`;
    const result = await sendMail({ userId, to: r.email, subject, text });
    const status = result.sent ? "DELIVERED" : result.error ? "FAILED" : "LOGGED";
    if (status === "DELIVERED") delivered++;
    else if (status === "LOGGED") logged++;
    else failed++;
    await db.campaignSend.create({ data: { campaignId: campaign.id, email: r.email, status, detail: deliveryNote(result) } });
  }
  await db.campaign.update({ where: { id: campaign.id }, data: { status: "SENT", sentAt: new Date() } });
  return { ok: true, total: recipients.length, delivered, logged, failed, mode: resendConnected() ? "resend" : "logged" };
}
