import { db } from "./db";
import { fmtMoney, invoiceEffectiveStatus, logStudioMessage, renderSmartFields } from "./studio";
import { renderTemplate } from "./emails";
import { formatDate } from "./utils";
import { absoluteUrl, deliveryNote, sendMail } from "./mailer";
import { whereLabel } from "./availability";

// Workflow automations with conditions: trigger → conditions → actions, with a
// run log. Evaluation is lazy (run button + auto-run when the page loads), the
// same no-cron pattern as scheduled contract sends and gallery expiry.

export interface AutomationCondition {
  field: string;
  op: "gte" | "lte" | "eq";
  value: number;
}

export interface AutomationAction {
  type: "SEND_EMAIL" | "RESEND_CONTRACT" | "TAG_CONTACT" | "SEND_CUSTOM_EMAIL";
  templateKey?: string;
  value?: string;
  subject?: string; // SEND_CUSTOM_EMAIL
  body?: string; // SEND_CUSTOM_EMAIL
}

/** Phase 5B: a follow up step of a multi step sequence, fired delayDays after the previous step. */
export interface AutomationStep {
  delayDays: number;
  actions: AutomationAction[];
}

const ACTION_TYPES = ["SEND_EMAIL", "RESEND_CONTRACT", "TAG_CONTACT", "SEND_CUSTOM_EMAIL"];

export const TRIGGERS: {
  id: string;
  label: string;
  description: string;
  conditionFields: { id: string; label: string; unit: string }[];
  actions: { type: AutomationAction["type"]; label: string; templateKey?: string }[];
}[] = [
  {
    id: "INVOICE_UNPAID",
    label: "Invoice is unpaid",
    description: "Fires for sent invoices with an outstanding balance.",
    conditionFields: [
      { id: "days_since_sent", label: "Days since the invoice was sent", unit: "days" },
      { id: "days_overdue", label: "Days past the due date", unit: "days" },
      { id: "unpaid_cents", label: "Outstanding amount (cents)", unit: "cents" },
    ],
    actions: [
      { type: "SEND_EMAIL", label: "Send the invoice reminder email", templateKey: "INVOICE_REMINDER" },
      { type: "TAG_CONTACT", label: "Tag the contact" },
    ],
  },
  {
    id: "GALLERY_NO_FAVORITES",
    label: "Gallery viewed but no favorites",
    description: "Fires for published galleries that were opened but have no favorites yet.",
    conditionFields: [
      { id: "days_since_view", label: "Days since the first view", unit: "days" },
      { id: "view_count", label: "Total gallery views", unit: "views" },
    ],
    actions: [{ type: "SEND_EMAIL", label: "Send the favorites nudge email", templateKey: "GALLERY_NUDGE" }],
  },
  {
    id: "CONTRACT_UNSIGNED",
    label: "Contract not signed",
    description: "Fires for sent contracts still awaiting the client's signature.",
    conditionFields: [{ id: "hours_since_sent", label: "Hours since the contract was sent", unit: "hours" }],
    actions: [
      { type: "RESEND_CONTRACT", label: "Resend the contract (logs the email, refreshes sent time)" },
      { type: "SEND_EMAIL", label: "Send the signature reminder email", templateKey: "CONTRACT_RESEND" },
    ],
  },
  {
    id: "GALLERY_EXPIRING",
    label: "Gallery expiring soon",
    description: "Fires for galleries with an expiry date coming up (expiry-reminder flag honored).",
    conditionFields: [{ id: "days_until_expiry", label: "Days until the gallery expires", unit: "days" }],
    actions: [{ type: "SEND_EMAIL", label: "Send the expiry reminder email", templateKey: "GALLERY_EXPIRY" }],
  },
  // Phase 5B presets
  {
    id: "QUOTE_UNACCEPTED",
    label: "Quote not accepted",
    description: "Fires for sent quotes the client has not accepted or declined yet.",
    conditionFields: [
      { id: "days_since_sent", label: "Days since the quote was sent", unit: "days" },
      { id: "days_until_expiry", label: "Days until the quote expires", unit: "days" },
    ],
    actions: [
      { type: "SEND_EMAIL", label: "Send the quote reminder email", templateKey: "QUOTE_REMINDER" },
      { type: "TAG_CONTACT", label: "Tag the contact" },
    ],
  },
  {
    id: "QUESTIONNAIRE_INCOMPLETE",
    label: "Questionnaire not completed",
    description: "Fires for questionnaires you sent that the client has not completed yet.",
    conditionFields: [{ id: "days_since_sent", label: "Days since the questionnaire was sent", unit: "days" }],
    actions: [{ type: "SEND_EMAIL", label: "Send the questionnaire reminder email", templateKey: "QUESTIONNAIRE_REMINDER" }],
  },
  {
    id: "SESSION_UPCOMING",
    label: "Upcoming session",
    description: "Fires for confirmed bookings that have not had a reminder yet (skips ones already reminded by their session type).",
    conditionFields: [{ id: "hours_until_session", label: "Hours until the session starts", unit: "hours" }],
    actions: [{ type: "SEND_EMAIL", label: "Send the upcoming session reminder email", templateKey: "BOOKING_REMINDER" }],
  },
  // Phase 5B marketing and upsell sequence triggers
  {
    id: "GALLERY_DELIVERED",
    label: "Gallery delivered",
    description: "Fires for published galleries (post delivery follow up, review request, print and album upsell sequences).",
    conditionFields: [{ id: "days_since_published", label: "Days since the gallery was published", unit: "days" }],
    actions: [],
  },
  {
    id: "BOOKING_CONFIRMED",
    label: "Booking confirmed",
    description: "Fires for confirmed bookings (welcome, prep guide, and after the session thank you sequences).",
    conditionFields: [
      { id: "days_since_booked", label: "Days since the booking was made", unit: "days" },
      { id: "days_until_session", label: "Days until the session", unit: "days" },
    ],
    actions: [{ type: "TAG_CONTACT", label: "Tag the contact" }],
  },
];

// Every trigger can send a custom written email (subject and body with smart fields).
for (const t of TRIGGERS) t.actions.push({ type: "SEND_CUSTOM_EMAIL", label: "Send a custom email" });

/** Phase 5B: ready made multi step marketing sequences. */
export const SEQUENCE_TEMPLATES: {
  name: string;
  trigger: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  steps: AutomationStep[];
}[] = [
  {
    name: "After delivery: thank you, review request, print offer",
    trigger: "GALLERY_DELIVERED",
    conditions: [{ field: "days_since_published", op: "gte", value: 0 }],
    actions: [
      {
        type: "SEND_CUSTOM_EMAIL",
        subject: "Your gallery {{gallery_name}} is ready",
        body: "Hi {{client_name}},\n\nYour photos are ready to view, favorite, and download here: {{gallery_link}}\n\nThank you for choosing {{business_name}}.",
      },
    ],
    steps: [
      {
        delayDays: 3,
        actions: [
          {
            type: "SEND_CUSTOM_EMAIL",
            subject: "Would you leave {{business_name}} a review?",
            body: "Hi {{client_name}},\n\nI hope you are loving your photos from {{gallery_name}}. If you have a minute, a short review means the world to a small studio. Just reply to this email with a few words.\n\n{{business_name}}",
          },
        ],
      },
      {
        delayDays: 7,
        actions: [
          {
            type: "SEND_CUSTOM_EMAIL",
            subject: "Prints and albums from {{gallery_name}}",
            body: "Hi {{client_name}},\n\nYour favorite images deserve to be printed. You can order prints, canvases, and albums straight from your gallery: {{gallery_link}}\n\n{{business_name}}",
          },
        ],
      },
    ],
  },
  {
    name: "New client welcome and session prep",
    trigger: "BOOKING_CONFIRMED",
    conditions: [{ field: "days_since_booked", op: "gte", value: 0 }],
    actions: [
      {
        type: "SEND_CUSTOM_EMAIL",
        subject: "Welcome to {{business_name}}",
        body: "Hi {{client_name}},\n\nThank you for booking your {{session_type}} on {{session_date}}. I will be in touch with everything you need before the day.\n\n{{business_name}}",
      },
      { type: "TAG_CONTACT", value: "booked client" },
    ],
    steps: [
      {
        delayDays: 2,
        actions: [
          {
            type: "SEND_CUSTOM_EMAIL",
            subject: "How to prepare for your {{session_type}}",
            body: "Hi {{client_name}},\n\nA few tips for {{session_date}}: choose outfits in coordinating tones, plan to arrive ten minutes early, and bring anything that makes the day feel like you.\n\n{{business_name}}",
          },
        ],
      },
    ],
  },
];

/** Phase 5B: one click preset reminder automations (Pixieset's five presets). */
export const PRESET_AUTOMATIONS: { name: string; trigger: string; conditions: AutomationCondition[]; actions: AutomationAction[] }[] = [
  { name: "Unsigned contract reminder", trigger: "CONTRACT_UNSIGNED", conditions: [{ field: "hours_since_sent", op: "gte", value: 48 }], actions: [{ type: "SEND_EMAIL", templateKey: "CONTRACT_RESEND" }] },
  { name: "Unpaid invoice reminder", trigger: "INVOICE_UNPAID", conditions: [{ field: "days_overdue", op: "gte", value: 1 }], actions: [{ type: "SEND_EMAIL", templateKey: "INVOICE_REMINDER" }] },
  { name: "Unaccepted quote reminder", trigger: "QUOTE_UNACCEPTED", conditions: [{ field: "days_since_sent", op: "gte", value: 3 }], actions: [{ type: "SEND_EMAIL", templateKey: "QUOTE_REMINDER" }] },
  { name: "Incomplete questionnaire reminder", trigger: "QUESTIONNAIRE_INCOMPLETE", conditions: [{ field: "days_since_sent", op: "gte", value: 2 }], actions: [{ type: "SEND_EMAIL", templateKey: "QUESTIONNAIRE_REMINDER" }] },
  { name: "Upcoming session reminder", trigger: "SESSION_UPCOMING", conditions: [{ field: "hours_until_session", op: "lte", value: 48 }], actions: [{ type: "SEND_EMAIL", templateKey: "BOOKING_REMINDER" }] },
];

export function triggerById(id: string) {
  return TRIGGERS.find((t) => t.id === id);
}

export function parseConditions(json: string): AutomationCondition[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => c && typeof c.field === "string" && ["gte", "lte", "eq"].includes(c.op))
      .map((c) => ({ field: c.field, op: c.op, value: Number(c.value) || 0 }));
  } catch {
    return [];
  }
}

export function parseActions(json: string): AutomationAction[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((a) => a && ACTION_TYPES.includes(a.type))
      .filter((a) => a.type !== "SEND_CUSTOM_EMAIL" || (String(a.subject ?? "").trim() && String(a.body ?? "").trim()))
      .map((a) => ({
        type: a.type,
        templateKey: a.templateKey,
        value: a.value,
        ...(a.type === "SEND_CUSTOM_EMAIL" ? { subject: String(a.subject).slice(0, 300), body: String(a.body).slice(0, 10000) } : {}),
      }));
  } catch {
    return [];
  }
}

export function parseSteps(json: string): AutomationStep[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .slice(0, 10)
      .map((st) => ({
        delayDays: Math.min(365, Math.max(0, Math.round(Number(st?.delayDays) || 0))),
        actions: parseActions(JSON.stringify(st?.actions ?? [])),
      }))
      .filter((st) => st.actions.length > 0);
  } catch {
    return [];
  }
}

function passes(conditions: AutomationCondition[], facts: Record<string, number>): boolean {
  return conditions.every((c) => {
    const v = facts[c.field];
    if (v === undefined) return false;
    if (c.op === "gte") return v >= c.value;
    if (c.op === "lte") return v <= c.value;
    return v === c.value;
  });
}

interface Target {
  key: string; // dedup key
  label: string;
  facts: Record<string, number>;
  ctx: Record<string, string>; // smart-field context for email templates
  contactId: string | null;
  contractId: string | null; // for RESEND_CONTRACT
  email: string;
  name: string;
}

const DAY = 86_400_000;

async function targetsFor(userId: string, trigger: string, businessName: string): Promise<Target[]> {
  const now = Date.now();
  const targets: Target[] = [];

  if (trigger === "INVOICE_UNPAID") {
    const invoices = await db.invoice.findMany({
      where: { userId, status: { not: "DRAFT" } },
      include: { installments: true, contact: true },
    });
    for (const inv of invoices) {
      const eff = invoiceEffectiveStatus(inv.status, inv.installments);
      if (eff === "PAID") continue;
      const unpaid = inv.installments.filter((i) => !i.paidAt).reduce((s, i) => s + i.amountCents, 0);
      const sentAt = inv.sentAt ?? inv.createdAt;
      const daysOverdue = inv.dueDate ? Math.floor((now - inv.dueDate.getTime()) / DAY) : -9999;
      targets.push({
        key: `invoice:${inv.id}`,
        label: `${inv.number}, ${inv.contact?.name ?? "No contact"}`,
        facts: {
          days_since_sent: Math.floor((now - sentAt.getTime()) / DAY),
          days_overdue: daysOverdue,
          unpaid_cents: unpaid,
        },
        ctx: {
          client_name: inv.contact?.name ?? "there",
          invoice_number: inv.number,
          invoice_amount: fmtMoney(unpaid),
          due_phrase: inv.dueDate ? ` (due ${formatDate(inv.dueDate)})` : "",
          payment_link: absoluteUrl(`/pay/${inv.token}`),
          business_name: businessName,
        },
        contactId: inv.contactId,
        contractId: null,
        email: inv.contact?.email ?? "",
        name: inv.contact?.name ?? "",
      });
    }
  }

  if (trigger === "GALLERY_NO_FAVORITES") {
    const collections = await db.collection.findMany({
      where: { userId, status: "PUBLISHED" },
      include: {
        activities: { where: { type: "VIEW" }, orderBy: { createdAt: "asc" } },
        favoriteLists: { include: { favorites: true } },
        registrations: true,
      },
    });
    for (const col of collections) {
      if (col.activities.length === 0) continue; // never viewed
      const favCount = col.favoriteLists.reduce((s, l) => s + l.favorites.length, 0);
      if (favCount > 0) continue;
      const firstView = col.activities[0].createdAt.getTime();
      const email = col.registrations[0]?.email ?? col.activities.find((a) => a.clientEmail)?.clientEmail ?? "";
      targets.push({
        key: `collection:${col.id}`,
        label: col.name,
        facts: {
          days_since_view: Math.floor((now - firstView) / DAY),
          view_count: col.activities.length,
        },
        ctx: {
          gallery_name: col.name,
          gallery_link: absoluteUrl(`/g/${col.slug}`),
          business_name: businessName,
        },
        contactId: null,
        contractId: null,
        email,
        name: "",
      });
    }
  }

  if (trigger === "CONTRACT_UNSIGNED") {
    const contracts = await db.contract.findMany({
      where: { userId, status: "SENT", signedAt: null },
      include: { contact: true },
    });
    for (const c of contracts) {
      if (c.expiresAt && c.expiresAt.getTime() < now) continue;
      const sentAt = c.sentAt ?? c.createdAt;
      targets.push({
        key: `contract:${c.id}`,
        label: c.title,
        facts: { hours_since_sent: Math.floor((now - sentAt.getTime()) / 3_600_000) },
        ctx: {
          client_name: c.contact?.name ?? "there",
          contract_title: c.title,
          signing_link: absoluteUrl(`/sign/${c.token}`),
          business_name: businessName,
        },
        contactId: c.contactId,
        contractId: c.id,
        email: c.contact?.email ?? "",
        name: c.contact?.name ?? "",
      });
    }
  }

  if (trigger === "GALLERY_EXPIRING") {
    const collections = await db.collection.findMany({
      where: { userId, expiresAt: { gt: new Date() }, expiryReminder: true },
      include: { registrations: true },
    });
    for (const col of collections) {
      targets.push({
        key: `collection-expiry:${col.id}`,
        label: col.name,
        facts: { days_until_expiry: Math.ceil((col.expiresAt!.getTime() - now) / DAY) },
        ctx: {
          gallery_name: col.name,
          gallery_link: absoluteUrl(`/g/${col.slug}`),
          expiry_date: formatDate(col.expiresAt),
          business_name: businessName,
        },
        contactId: null,
        contractId: null,
        email: col.registrations[0]?.email ?? "",
        name: "",
      });
    }
  }

  if (trigger === "QUOTE_UNACCEPTED") {
    const quotes = await db.quote.findMany({ where: { userId, status: "SENT" }, include: { contact: true } });
    for (const q of quotes) {
      if (q.validUntil && q.validUntil.getTime() < now) continue;
      const sentAt = q.sentAt ?? q.createdAt;
      targets.push({
        key: `quote:${q.id}`,
        label: `${q.number}, ${q.contact?.name ?? "No contact"}`,
        facts: {
          days_since_sent: Math.floor((now - sentAt.getTime()) / DAY),
          days_until_expiry: q.validUntil ? Math.ceil((q.validUntil.getTime() - now) / DAY) : 9999,
        },
        ctx: {
          client_name: q.contact?.name ?? "there",
          quote_number: q.number,
          quote_amount: fmtMoney(quoteTotal(q)),
          quote_link: absoluteUrl(`/quote/${q.token}`),
          business_name: businessName,
        },
        contactId: q.contactId,
        contractId: null,
        email: q.contact?.email ?? "",
        name: q.contact?.name ?? "",
      });
    }
  }

  if (trigger === "QUESTIONNAIRE_INCOMPLETE") {
    const reqs = await db.questionnaireRequest.findMany({ where: { userId, completedAt: null } });
    const qs = await db.questionnaire.findMany({ where: { userId } });
    for (const r of reqs) {
      const q = qs.find((x) => x.id === r.questionnaireId);
      if (!q) continue;
      targets.push({
        key: `questionnaire-request:${r.id}`,
        label: `${q.name}, ${r.name || r.email}`,
        facts: { days_since_sent: Math.floor((now - r.sentAt.getTime()) / DAY) },
        ctx: {
          client_name: r.name || "there",
          questionnaire_name: q.name,
          questionnaire_link: absoluteUrl(`/questionnaire/${r.token}`),
          business_name: businessName,
        },
        contactId: r.contactId,
        contractId: null,
        email: r.email,
        name: r.name,
      });
    }
  }

  if (trigger === "SESSION_UPCOMING") {
    const bookings = await db.booking.findMany({
      where: { userId, status: "CONFIRMED", reminderSentAt: null, startsAt: { gt: new Date(now) } },
      include: { contact: true, sessionType: true },
    });
    for (const b of bookings) {
      targets.push({
        key: `booking:${b.id}`,
        label: `${b.title}, ${b.contact?.name ?? "No contact"}`,
        facts: { hours_until_session: Math.floor((b.startsAt.getTime() - now) / 3_600_000) },
        ctx: {
          client_name: b.contact?.name ?? "there",
          session_type: b.title,
          session_date: `${formatDate(b.startsAt)} at ${b.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
          session_location: (b.sessionType ? whereLabel(b.sessionType, b) : "") || "To be confirmed",
          business_name: businessName,
        },
        contactId: b.contactId,
        contractId: null,
        email: b.contact?.email ?? "",
        name: b.contact?.name ?? "",
      });
    }
  }

  if (trigger === "GALLERY_DELIVERED") {
    const collections = await db.collection.findMany({
      where: { userId, status: "PUBLISHED" },
      include: { invites: { orderBy: { createdAt: "asc" }, take: 1 }, registrations: { take: 1 } },
    });
    for (const col of collections) {
      const publishedAt = col.publishedAt ?? col.createdAt;
      const email = col.invites[0]?.email ?? col.registrations[0]?.email ?? "";
      const contact = email ? await db.contact.findFirst({ where: { userId, email } }) : null;
      targets.push({
        key: `delivered:${col.id}`,
        label: col.name,
        facts: { days_since_published: Math.floor((now - publishedAt.getTime()) / DAY) },
        ctx: {
          client_name: contact?.name ?? "there",
          gallery_name: col.name,
          gallery_link: absoluteUrl(`/g/${col.slug}`),
          business_name: businessName,
        },
        contactId: contact?.id ?? null,
        contractId: null,
        email,
        name: contact?.name ?? "",
      });
    }
  }

  if (trigger === "BOOKING_CONFIRMED") {
    const bookings = await db.booking.findMany({
      where: { userId, status: { in: ["CONFIRMED", "COMPLETED"] } },
      include: { contact: true },
    });
    for (const b of bookings) {
      targets.push({
        key: `booked:${b.id}`,
        label: `${b.title}, ${b.contact?.name ?? "No contact"}`,
        facts: {
          days_since_booked: Math.floor((now - b.createdAt.getTime()) / DAY),
          days_until_session: Math.ceil((b.startsAt.getTime() - now) / DAY),
        },
        ctx: {
          client_name: b.contact?.name ?? "there",
          session_type: b.title || "session",
          session_date: formatDate(b.startsAt),
          business_name: businessName,
        },
        contactId: b.contactId,
        contractId: null,
        email: b.contact?.email ?? "",
        name: b.contact?.name ?? "",
      });
    }
  }

  return targets;
}

function quoteTotal(q: { items: string; taxRate: number; discountType: string; discountValue: number; selection: string }) {
  // Lazy import avoided: inline total using the same math as calcTotals.
  let items: { qty: number; unitCents: number; optional?: boolean }[] = [];
  try {
    items = JSON.parse(q.items);
  } catch {
    items = [];
  }
  let chosen: number[] | null = null;
  try {
    chosen = q.selection ? JSON.parse(q.selection) : null;
  } catch {
    chosen = null;
  }
  const sub = items.reduce((n, it, i) => {
    if (chosen ? !chosen.includes(i) : it.optional) return n;
    return n + Math.round((Number(it.qty) || 0) * (Number(it.unitCents) || 0));
  }, 0);
  let discount = q.discountType === "PERCENT" ? Math.round((sub * q.discountValue) / 100) : q.discountType === "FIXED" ? q.discountValue : 0;
  discount = Math.min(discount, sub);
  return sub - discount + Math.round(((sub - discount) * q.taxRate) / 100);
}

export interface RunSummary {
  automationId: string;
  name: string;
  checked: number;
  fired: number;
  alreadyRan: number;
  stepsFired: number; // Phase 5B: follow up sequence steps fired this run
}

async function executeActions(
  userId: string,
  autoName: string,
  target: Target,
  actions: AutomationAction[]
): Promise<string[]> {
  const details: string[] = [];
  for (const action of actions) {
    if ((action.type === "SEND_EMAIL" && action.templateKey) || action.type === "SEND_CUSTOM_EMAIL") {
      const rendered =
        action.type === "SEND_CUSTOM_EMAIL"
          ? { subject: renderSmartFields(action.subject ?? "", target.ctx), body: renderSmartFields(action.body ?? "", target.ctx) }
          : await renderTemplate(userId, action.templateKey!, target.ctx);
      if (!target.email) {
        details.push(`Email "${rendered.subject}" skipped, no client email on file`);
        continue;
      }
      const mail = await sendMail({ userId, to: target.email, subject: rendered.subject, text: rendered.body });
      await logStudioMessage(userId, {
        kind: "EMAIL",
        name: target.name,
        email: target.email,
        subject: rendered.subject,
        body: rendered.body,
        meta: `Automation: ${autoName} · ${deliveryNote(mail)}`,
      });
      details.push(`Emailed "${rendered.subject}" to ${target.email} (${deliveryNote(mail)})`);
    }
    if (action.type === "SEND_EMAIL" && target.key.startsWith("booking:")) {
      await db.booking.update({ where: { id: target.key.slice(8) }, data: { reminderSentAt: new Date() } });
    }
    if (action.type === "RESEND_CONTRACT" && target.contractId) {
      await db.contract.update({ where: { id: target.contractId }, data: { sentAt: new Date() } });
      details.push("Contract resent (sent time refreshed)");
    }
    if (action.type === "TAG_CONTACT" && target.contactId && action.value) {
      const contact = await db.contact.findUnique({ where: { id: target.contactId } });
      if (contact) {
        const tags = contact.tags.split(",").map((t) => t.trim()).filter(Boolean);
        if (!tags.includes(action.value)) {
          tags.push(action.value);
          await db.contact.update({ where: { id: contact.id }, data: { tags: tags.join(", ") } });
          details.push(`Tagged contact "${action.value}"`);
        }
      }
    }
  }
  return details;
}

/**
 * Evaluate every active automation for a user. The first actions fire once per
 * target when the conditions match. Phase 5B sequences: each follow up step
 * fires once, in order, when its delay has passed since the previous step ran,
 * and only while the target still qualifies for the trigger (a paid invoice or
 * a signed contract drops out, which stops its sequence).
 */
export async function runAutomations(userId: string): Promise<RunSummary[]> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return [];
  const businessName = user.businessName || user.name;
  const automations = await db.automation.findMany({ where: { userId, active: true } });
  const summaries: RunSummary[] = [];

  for (const auto of automations) {
    const trigger = triggerById(auto.trigger);
    if (!trigger) continue;
    const conditions = parseConditions(auto.conditions);
    const actions = parseActions(auto.actions);
    const steps = parseSteps(auto.steps);
    const targets = await targetsFor(userId, auto.trigger, businessName);
    const summary: RunSummary = { automationId: auto.id, name: auto.name, checked: targets.length, fired: 0, alreadyRan: 0, stepsFired: 0 };

    for (const target of targets) {
      const last = await db.automationRun.findFirst({
        where: { automationId: auto.id, targetKey: target.key, status: "OK" },
        orderBy: [{ step: "desc" }, { createdAt: "desc" }],
      });

      if (!last) {
        if (!passes(conditions, target.facts)) continue;
        const details = await executeActions(userId, auto.name, target, actions);
        await db.automationRun.create({
          data: {
            automationId: auto.id,
            targetKey: target.key,
            targetLabel: target.label,
            step: 0,
            status: "OK",
            detail: `${steps.length ? `Step 1 of ${steps.length + 1}: ` : ""}${details.join(" · ") || "Conditions matched (no actions configured)"}`,
          },
        });
        summary.fired++;
        continue;
      }

      const next = last.step + 1; // step index in the sequence (1 = steps[0])
      if (next > steps.length) {
        summary.alreadyRan++;
        continue;
      }
      const step = steps[next - 1];
      if (Date.now() - last.createdAt.getTime() < step.delayDays * DAY) continue; // not due yet
      const details = await executeActions(userId, auto.name, target, step.actions);
      await db.automationRun.create({
        data: {
          automationId: auto.id,
          targetKey: target.key,
          targetLabel: target.label,
          step: next,
          status: "OK",
          detail: `Step ${next + 1} of ${steps.length + 1} (${step.delayDays} day${step.delayDays === 1 ? "" : "s"} after the previous step): ${details.join(" · ") || "no actions"}`,
        },
      });
      summary.stepsFired++;
    }
    summaries.push(summary);
  }
  return summaries;
}
