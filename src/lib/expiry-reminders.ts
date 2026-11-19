import { db } from "./db";
import { renderTemplate } from "./emails";
import { absoluteUrl, deliveryNote, sendMail } from "./mailer";
import { logActivity } from "./activity";
import { logStudioMessage } from "./studio";

// Phase 5B: automated gallery expiry reminders.
//
// For every collection with the expiry reminder switched on, the reminder email
// (Settings, Email Templates, "Gallery expiry reminder") goes to everyone who
// has the gallery: registered emails, invited clients and favorite list owners,
// once per expiry date, when the gallery is within its reminder window. It runs
// lazily whenever the photographer's dashboard collection pages load, the same
// no-cron pattern the app uses for automations, and can be sent on demand from
// Collection Settings. Delivery goes through the mailer: real when
// RESEND_API_KEY is set, honestly logged otherwise.

const DAY = 24 * 3600 * 1000;

export interface ReminderResult {
  collectionId: string;
  name: string;
  recipients: { email: string; delivered: boolean; error: string | null }[];
}

export async function reminderRecipients(collectionId: string): Promise<string[]> {
  const [regs, invites, lists] = await Promise.all([
    db.emailRegistration.findMany({ where: { collectionId }, select: { email: true } }),
    db.invite.findMany({ where: { collectionId }, select: { email: true } }),
    db.favoriteList.findMany({ where: { collectionId }, select: { clientEmail: true } }),
  ]);
  const all = [...regs.map((r) => r.email), ...invites.map((i) => i.email), ...lists.map((l) => l.clientEmail)];
  return Array.from(new Set(all.map((e) => e.toLowerCase().trim()).filter((e) => e.includes("@"))));
}

export async function sendExpiryReminder(collectionId: string): Promise<ReminderResult | null> {
  const c = await db.collection.findUnique({ where: { id: collectionId }, include: { user: true } });
  if (!c || !c.expiresAt) return null;
  const tz = c.user.timezone || "America/Chicago";
  const expiryDate = c.expiresAt.toLocaleDateString("en-US", { timeZone: tz, year: "numeric", month: "long", day: "numeric" });
  const businessName = c.user.businessName || c.user.name;
  const rendered = await renderTemplate(c.userId, "GALLERY_EXPIRY", {
    gallery_name: c.name,
    gallery_link: absoluteUrl(`/g/${c.slug}`),
    expiry_date: `${expiryDate} at 11:59 pm`,
    business_name: businessName,
  });
  const recipients = await reminderRecipients(c.id);
  const results: ReminderResult["recipients"] = [];
  for (const email of recipients) {
    const mail = await sendMail({ userId: c.userId, to: email, subject: rendered.subject, text: rendered.body });
    results.push({ email, delivered: mail.sent, error: mail.error ?? null });
    await logActivity(c.id, "EXPIRY_REMINDER", `Expiry reminder to ${email} (${deliveryNote(mail)})`, email);
    await logStudioMessage(c.userId, {
      kind: "EMAIL",
      email,
      subject: rendered.subject,
      body: rendered.body,
      meta: `Gallery expiry reminder · ${deliveryNote(mail)}`,
    });
  }
  if (results.length > 0) await db.collection.update({ where: { id: c.id }, data: { expiryReminderSentAt: new Date() } });
  return { collectionId: c.id, name: c.name, recipients: results };
}

/** Send every reminder that is due for this photographer (lazy, idempotent per expiry date). */
export async function processExpiryReminders(userId: string): Promise<ReminderResult[]> {
  const now = Date.now();
  const due = await db.collection.findMany({
    where: { userId, expiryReminder: true, expiryReminderSentAt: null, expiresAt: { gt: new Date(now) } },
    select: { id: true, expiresAt: true, expiryReminderDays: true },
  });
  const out: ReminderResult[] = [];
  for (const c of due) {
    if (c.expiresAt!.getTime() - now > Math.max(0, c.expiryReminderDays) * DAY) continue;
    const r = await sendExpiryReminder(c.id);
    if (r) out.push(r);
  }
  return out;
}
