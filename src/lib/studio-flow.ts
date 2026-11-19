import { db } from "./db";
import { fmtMoney, invoiceEffectiveStatus, logStudioMessage } from "./studio";
import { renderTemplate } from "./emails";
import { absoluteUrl, deliveryNote, sendMail } from "./mailer";
import { formatDate } from "./utils";
import { whereLabel } from "./availability";

// Phase 5B: Studio Manager flows that send email (confirmations, reminders,
// questionnaire requests) and record payments. Every send goes through
// sendMail(), which delivers through Resend when RESEND_API_KEY is set and
// otherwise reports "logged only" honestly; every send is also logged to the
// Studio inbox with that delivery note.

export function sessionDateLabel(d: Date): string {
  return `${formatDate(d)} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

async function businessNameFor(userId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { businessName: true, name: true } });
  return u?.businessName || u?.name || "Your photographer";
}

/**
 * Night build: website form submissions become Studio contacts and, for
 * contact and booking forms, an Inquiry card on the Projects board. Runs as a
 * catch-up when the Contacts or Projects page loads (the same pattern as
 * syncGalleryContacts); each site message is bridged once, tracked by a
 * site-message marker in the project notes.
 */
export async function syncWebsiteLeads(userId: string): Promise<number> {
  const { upsertContact } = await import("./contact-sync");
  const sites = await db.website.findMany({ where: { userId }, select: { id: true } });
  if (!sites.length) return 0;
  const messages = await db.siteMessage.findMany({
    where: { websiteId: { in: sites.map((s) => s.id) } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  let bridged = 0;
  for (const m of messages) {
    if (!m.email.includes("@")) continue;
    const contact = await upsertContact(userId, m.email, m.name, "WEBSITE_FORM", { phone: m.phone, tag: "website" });
    if (!contact) continue;
    if (m.kind === "NEWSLETTER") continue;
    const marker = `site-message:${m.id}`;
    const existing = await db.project.findFirst({ where: { userId, contactId: contact.id, notes: { contains: marker } } });
    if (existing) continue;
    const max = await db.project.aggregate({ where: { userId, stage: "INQUIRY" }, _max: { order: true } });
    await db.project.create({
      data: {
        userId,
        name: `Website inquiry: ${m.name || m.email}`,
        contactId: contact.id,
        stage: "INQUIRY",
        order: (max._max.order ?? 0) + 1,
        notes: `${m.subject ? `${m.subject}\n` : ""}${m.body}${m.meta ? `\n${m.meta}` : ""}\n[${marker}]`.slice(0, 4000),
      },
    });
    await logStudioMessage(userId, {
      kind: "EMAIL",
      name: m.name,
      email: m.email,
      subject: `Website form: ${m.subject || m.kind.toLowerCase()}`,
      body: m.body || "(no message body)",
      meta: "From your website, added to Contacts and Projects",
    });
    bridged++;
  }
  return bridged;
}

/** Email + log one studio message; returns the delivery note. */
export async function sendStudioEmail(
  userId: string,
  to: { email: string; name?: string },
  subject: string,
  text: string,
  metaPrefix: string
): Promise<string> {
  const mail = await sendMail({ userId, to: to.email, subject, text });
  const note = deliveryNote(mail);
  await logStudioMessage(userId, {
    kind: "EMAIL",
    name: to.name ?? "",
    email: to.email,
    subject,
    body: text,
    meta: `${metaPrefix} · ${note}`,
  });
  return note;
}

/** Booking confirmation email with time, location / meeting link / call details. */
export async function sendBookingConfirmation(bookingId: string): Promise<string> {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { contact: true, sessionType: true } });
  if (!b || !b.contact?.email) return "No client email on file";
  const business = await businessNameFor(b.userId);
  const where = b.sessionType ? whereLabel(b.sessionType, b) : "";
  const waitlisted = b.status === "WAITLIST";
  const requested = b.approvalState === "REQUESTED"; // Phase 5B platform: manual approval
  const subject = waitlisted
    ? `You're on the waitlist: ${b.title}`
    : requested
      ? `Booking request received: ${b.title} on ${formatDate(b.startsAt)}`
      : `Booking confirmed: ${b.title} on ${formatDate(b.startsAt)}`;
  const text = requested
    ? `Hi ${b.contact.name},

Thanks for your request for ${b.title} on ${sessionDateLabel(b.startsAt)}. We review every booking personally and will email you as soon as it is approved, with the next steps.

${business}`
    : waitlisted
    ? `Hi ${b.contact.name},

You're on the waitlist for ${b.title} on ${sessionDateLabel(b.startsAt)}. We'll contact you as soon as a spot opens up.

${business}`
    : `Hi ${b.contact.name},

Your booking is confirmed.

Session: ${b.title}
When: ${sessionDateLabel(b.startsAt)}
${where ? `Where: ${where}\n` : ""}Total: ${fmtMoney(b.totalCents)}${b.retainerCents ? `\nPaid at booking: ${b.paymentStatus === "UNPAID" ? fmtMoney(0) : fmtMoney(b.retainerCents)}` : ""}
${b.sessionType?.cancellationPolicy ? `\n${b.sessionType.cancellationPolicy}\n` : ""}
Manage your booking: ${absoluteUrl(`/book/manage/${b.clientToken ?? ""}`)}

We're looking forward to seeing you.

${business}`;
  return sendStudioEmail(b.userId, { email: b.contact.email, name: b.contact.name }, subject, text, waitlisted ? "Waitlist confirmation" : requested ? "Booking request received" : "Booking confirmation");
}

/** Email the client a link to finish an Awaiting Client booking. */
export async function sendBookingCompletionRequest(bookingId: string): Promise<string> {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { contact: true } });
  if (!b || !b.contact?.email) return "No client email on file";
  const business = await businessNameFor(b.userId);
  const t = await renderTemplate(b.userId, "BOOKING_COMPLETE", {
    client_name: b.contact.name,
    session_type: b.title,
    session_date: sessionDateLabel(b.startsAt),
    booking_link: absoluteUrl(`/book/manage/${b.clientToken}`),
    business_name: business,
  });
  return sendStudioEmail(b.userId, { email: b.contact.email, name: b.contact.name }, t.subject, t.body, "Booking completion request");
}

/** Pre-session reminders, honoring each session type's reminders toggle and lead time. */
export async function runSessionReminders(userId: string): Promise<number> {
  const now = Date.now();
  const bookings = await db.booking.findMany({
    where: {
      userId,
      status: "CONFIRMED",
      reminderSentAt: null,
      startsAt: { gt: new Date(now), lt: new Date(now + 14 * 86_400_000) },
      sessionType: { remindersEnabled: true },
    },
    include: { contact: true, sessionType: true },
  });
  const business = await businessNameFor(userId);
  let sent = 0;
  for (const b of bookings) {
    const lead = (b.sessionType?.reminderHoursBefore ?? 24) * 3_600_000;
    if (b.startsAt.getTime() - now > lead) continue;
    if (!b.contact?.email) continue;
    const t = await renderTemplate(userId, "BOOKING_REMINDER", {
      client_name: b.contact.name,
      session_type: b.title,
      session_date: sessionDateLabel(b.startsAt),
      session_location: b.sessionType ? whereLabel(b.sessionType, b) || "To be confirmed" : "To be confirmed",
      business_name: business,
    });
    await db.booking.update({ where: { id: b.id }, data: { reminderSentAt: new Date() } });
    await sendStudioEmail(userId, { email: b.contact.email, name: b.contact.name }, t.subject, t.body, "Session reminder");
    sent++;
  }
  return sent;
}

export function parseSchedule(json: string): number[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return Array.from(new Set(arr.map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n >= -60 && n <= 120))).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function scheduleLabel(offset: number): string {
  if (offset === 0) return "On the due date";
  if (offset < 0) return `${-offset} day${offset === -1 ? "" : "s"} before`;
  return `${offset} day${offset === 1 ? "" : "s"} after`;
}

const DAY = 86_400_000;

/** Per invoice reminder schedule: before, on and after the due date. */
export async function runInvoiceReminders(userId: string): Promise<number> {
  const invoices = await db.invoice.findMany({
    where: { userId, status: "SENT", dueDate: { not: null } },
    include: { contact: true, installments: true },
  });
  const business = await businessNameFor(userId);
  const now = Date.now();
  let sent = 0;
  for (const inv of invoices) {
    if (invoiceEffectiveStatus(inv.status, inv.installments) === "PAID") continue;
    if (!inv.contact?.email || !inv.dueDate) continue;
    const done = parseSchedule(inv.remindersSent);
    const due = new Date(inv.dueDate);
    due.setHours(9, 0, 0, 0);
    const sentAt = (inv.sentAt ?? inv.createdAt).getTime();
    // Only the most recent reminder that has come due fires, older missed ones are skipped.
    const dueOffsets = parseSchedule(inv.reminderSchedule).filter((o) => due.getTime() + o * DAY <= now && due.getTime() + o * DAY >= sentAt - DAY);
    const pending = dueOffsets.filter((o) => !done.includes(o));
    if (pending.length === 0) continue;
    const offset = pending[pending.length - 1];
    const unpaid = inv.installments.length
      ? inv.installments.filter((i) => !i.paidAt).reduce((s, i) => s + i.amountCents, 0)
      : 0;
    const phrase =
      offset < 0
        ? ` (due in ${-offset} day${offset === -1 ? "" : "s"}, on ${formatDate(inv.dueDate)})`
        : offset === 0
          ? " (due today)"
          : ` (it was due on ${formatDate(inv.dueDate)}, ${offset} day${offset === 1 ? "" : "s"} ago)`;
    const t = await renderTemplate(userId, "INVOICE_REMINDER", {
      client_name: inv.contact.name,
      invoice_number: inv.number,
      invoice_amount: unpaid ? fmtMoney(unpaid) : "the balance",
      due_phrase: phrase,
      payment_link: absoluteUrl(`/pay/${inv.token}`),
      business_name: business,
    });
    await db.invoice.update({
      where: { id: inv.id },
      data: { remindersSent: JSON.stringify(Array.from(new Set([...done, ...pending]))) },
    });
    await sendStudioEmail(userId, { email: inv.contact.email, name: inv.contact.name }, t.subject, t.body, `Invoice reminder, ${scheduleLabel(offset).toLowerCase()}`);
    sent++;
  }
  return sent;
}

/** All time based Studio sends. Runs lazily on dashboard loads and from the cron route. */
export async function runStudioReminders(userId: string) {
  const sessions = await runSessionReminders(userId);
  const invoices = await runInvoiceReminders(userId);
  return { sessions, invoices };
}

// ---------------------------------------------------------------- questionnaires

export async function sendQuestionnaireRequest(opts: {
  userId: string;
  questionnaireId: string;
  email: string;
  name: string;
  contactId?: string | null;
  projectId?: string | null;
  reason?: "MANUAL" | "DELIVERY";
}) {
  const q = await db.questionnaire.findFirst({ where: { id: opts.questionnaireId, userId: opts.userId } });
  if (!q) return null;
  const req = await db.questionnaireRequest.create({
    data: {
      userId: opts.userId,
      questionnaireId: q.id,
      email: opts.email.toLowerCase(),
      name: opts.name,
      contactId: opts.contactId ?? null,
      projectId: opts.projectId ?? null,
      reason: opts.reason ?? "MANUAL",
    },
  });
  const business = await businessNameFor(opts.userId);
  const t = await renderTemplate(opts.userId, "QUESTIONNAIRE_REQUEST", {
    client_name: opts.name || "there",
    questionnaire_name: q.name,
    questionnaire_link: absoluteUrl(`/questionnaire/${req.token}`),
    business_name: business,
  });
  const note = await sendStudioEmail(
    opts.userId,
    { email: opts.email, name: opts.name },
    t.subject,
    t.body,
    opts.reason === "DELIVERY" ? "Feedback questionnaire, sent after delivery" : "Questionnaire request"
  );
  return { request: req, note };
}

/** When a project reaches Delivered, send the studio's feedback questionnaire once. */
export async function onProjectDelivered(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { contact: true } });
  if (!project || !project.contact?.email) return null;
  const profile = await db.studioProfile.findUnique({ where: { userId: project.userId } });
  if (!profile?.feedbackQuestionnaireId) return null;
  const already = await db.questionnaireRequest.findFirst({ where: { projectId, reason: "DELIVERY" } });
  if (already) return null;
  return sendQuestionnaireRequest({
    userId: project.userId,
    questionnaireId: profile.feedbackQuestionnaireId,
    email: project.contact.email,
    name: project.contact.name,
    contactId: project.contactId,
    projectId,
    reason: "DELIVERY",
  });
}

// ---------------------------------------------------------------- payments

/** Ledger entry for every mock payment, so payment reports cover every source. */
export async function recordPayment(data: {
  userId: string;
  source: "INVOICE" | "BOOKING" | "PAYMENT_LINK";
  sourceId: string;
  label: string;
  payerName?: string;
  payerEmail?: string;
  amountCents: number;
  tipCents?: number;
  method: string;
}) {
  try {
    await db.studioPayment.create({
      data: {
        userId: data.userId,
        source: data.source,
        sourceId: data.sourceId,
        label: data.label,
        payerName: data.payerName ?? "",
        payerEmail: data.payerEmail ?? "",
        amountCents: data.amountCents,
        tipCents: data.tipCents ?? 0,
        method: data.method,
      },
    });
  } catch {
    // reporting never blocks a payment
  }
}

// ---------------------------------------------------------------- gallery contact sync

/**
 * Catch up on gallery clients that registered or kept favorite lists before the
 * live sync existed (the gallery unlock and favorites routes upsert contacts as
 * it happens). Runs when the Contacts page loads.
 */
export async function syncGalleryContacts(userId: string): Promise<number> {
  const { upsertContact } = await import("./contact-sync");
  const [regs, lists, contacts] = await Promise.all([
    db.emailRegistration.findMany({ where: { collection: { userId } }, select: { email: true } }),
    db.favoriteList.findMany({ where: { collection: { userId } }, select: { clientEmail: true, clientName: true } }),
    db.contact.findMany({ where: { userId }, select: { email: true } }),
  ]);
  const known = new Set(contacts.map((c) => c.email.toLowerCase()));
  const people = new Map<string, string>();
  for (const r of regs) people.set(r.email.toLowerCase(), people.get(r.email.toLowerCase()) ?? "");
  for (const l of lists) people.set(l.clientEmail.toLowerCase(), l.clientName || people.get(l.clientEmail.toLowerCase()) || "");
  let added = 0;
  for (const [email, name] of Array.from(people.entries())) {
    if (!email.includes("@") || known.has(email)) continue;
    await upsertContact(userId, email, name, "GALLERY", { tag: "gallery client", makeClient: true });
    added++;
  }
  return added;
}
