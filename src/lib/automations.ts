import { db } from "./db";
import { fmtMoney, invoiceEffectiveStatus, logStudioMessage } from "./studio";
import { renderTemplate } from "./emails";
import { formatDate } from "./utils";
import { deliveryNote, sendMail } from "./mailer";

// Workflow automations with conditions: trigger → conditions → actions, with a
// run log. Evaluation is lazy (run button + auto-run when the page loads), the
// same no-cron pattern as scheduled contract sends and gallery expiry.

export interface AutomationCondition {
  field: string;
  op: "gte" | "lte" | "eq";
  value: number;
}

export interface AutomationAction {
  type: "SEND_EMAIL" | "RESEND_CONTRACT" | "TAG_CONTACT";
  templateKey?: string;
  value?: string;
}

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
      .filter((a) => a && ["SEND_EMAIL", "RESEND_CONTRACT", "TAG_CONTACT"].includes(a.type))
      .map((a) => ({ type: a.type, templateKey: a.templateKey, value: a.value }));
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
          payment_link: `/pay/${inv.token}`,
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
          gallery_link: `/g/${col.slug}`,
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
          signing_link: `/sign/${c.token}`,
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
          gallery_link: `/g/${col.slug}`,
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

  return targets;
}

export interface RunSummary {
  automationId: string;
  name: string;
  checked: number;
  fired: number;
  alreadyRan: number;
}

/** Evaluate every active automation for a user. Each automation fires at most once per target. */
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
    const targets = await targetsFor(userId, auto.trigger, businessName);
    const summary: RunSummary = { automationId: auto.id, name: auto.name, checked: targets.length, fired: 0, alreadyRan: 0 };

    for (const target of targets) {
      if (!passes(conditions, target.facts)) continue;
      const prior = await db.automationRun.findFirst({
        where: { automationId: auto.id, targetKey: target.key, status: "OK" },
      });
      if (prior) {
        summary.alreadyRan++;
        continue;
      }

      const details: string[] = [];
      for (const action of actions) {
        if (action.type === "SEND_EMAIL" && action.templateKey) {
          const rendered = await renderTemplate(userId, action.templateKey, target.ctx);
          const mail = await sendMail({
            userId,
            to: target.email,
            subject: rendered.subject,
            text: rendered.body,
          });
          await logStudioMessage(userId, {
            kind: "EMAIL",
            name: target.name,
            email: target.email,
            subject: rendered.subject,
            body: rendered.body,
            meta: `Automation: ${auto.name} · ${deliveryNote(mail)}`,
          });
          details.push(
            `Emailed “${rendered.subject}”${target.email ? ` to ${target.email}` : ""} (${deliveryNote(mail)})`
          );
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
              details.push(`Tagged contact “${action.value}”`);
            }
          }
        }
      }

      await db.automationRun.create({
        data: {
          automationId: auto.id,
          targetKey: target.key,
          targetLabel: target.label,
          status: "OK",
          detail: details.join(" · ") || "Conditions matched (no actions configured)",
        },
      });
      summary.fired++;
    }
    summaries.push(summary);
  }
  return summaries;
}
