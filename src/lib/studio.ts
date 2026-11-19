import { db } from "./db";
import { slugify } from "./utils";

// ---------------------------------------------------------------- money

export function fmtMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface LineItem {
  description: string;
  qty: number;
  unitCents: number;
}

export function parseItems(json: string): LineItem[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((it) => ({
      description: String(it.description ?? ""),
      qty: Math.max(0, Number(it.qty) || 0),
      unitCents: Math.round(Number(it.unitCents) || 0),
    }));
  } catch {
    return [];
  }
}

// Phase 5B: quote items can be fixed, optional extras, or packages (pick one per group).
export interface QuoteItem extends LineItem {
  kind: "fixed" | "optional" | "package";
  group: string;
  preselected: boolean;
}

export function parseQuoteItems(json: string): QuoteItem[] {
  let arr: unknown[] = [];
  try {
    const v = JSON.parse(json);
    arr = Array.isArray(v) ? v : [];
  } catch {
    arr = [];
  }
  return arr.map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    const kind = it.kind === "optional" || it.kind === "package" ? it.kind : "fixed";
    return {
      description: String(it.description ?? ""),
      qty: Math.max(0, Number(it.qty) || 0),
      unitCents: Math.round(Number(it.unitCents) || 0),
      kind,
      group: kind === "package" ? String(it.group ?? "").trim() || "Package" : "",
      preselected: it.preselected === true,
    };
  });
}

/** Default selection: fixed items, preselected optionals, and the first (or preselected) package per group. */
export function defaultQuoteSelection(items: QuoteItem[]): number[] {
  const sel: number[] = [];
  const groups = new Set<string>();
  items.forEach((it, i) => {
    if (it.kind === "fixed" || (it.kind === "optional" && it.preselected)) sel.push(i);
  });
  items.forEach((it, i) => {
    if (it.kind === "package" && it.preselected && !groups.has(it.group)) {
      groups.add(it.group);
      sel.push(i);
    }
  });
  items.forEach((it, i) => {
    if (it.kind === "package" && !groups.has(it.group)) {
      groups.add(it.group);
      sel.push(i);
    }
  });
  return sel.sort((a, b) => a - b);
}

/** Validate a client's selection; returns an error message or the cleaned list. */
export function validateQuoteSelection(items: QuoteItem[], selection: unknown): { error: string } | { selection: number[] } {
  const raw = Array.isArray(selection) ? selection.map((n) => Math.round(Number(n))) : [];
  const sel = Array.from(new Set(raw.filter((n) => Number.isInteger(n) && n >= 0 && n < items.length)));
  const groups = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "fixed" && !sel.includes(i)) sel.push(i);
    if (it.kind === "package") groups.set(it.group, (groups.get(it.group) ?? 0) + (sel.includes(i) ? 1 : 0));
  }
  for (const [g, n] of Array.from(groups.entries())) {
    if (n !== 1) return { error: `Choose one option for ${g}.` };
  }
  return { selection: sel.sort((a, b) => a - b) };
}

export function selectedQuoteItems(items: QuoteItem[], selection: number[] | null): LineItem[] {
  const sel = selection ?? defaultQuoteSelection(items);
  return items.filter((_, i) => sel.includes(i)).map(({ description, qty, unitCents }) => ({ description, qty, unitCents }));
}

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  tip: number;
  total: number;
}

export function calcTotals(
  items: LineItem[],
  taxRate: number,
  discountType: string,
  discountValue: number,
  tipCents = 0
): Totals {
  const subtotal = items.reduce((s, it) => s + Math.round(it.qty * it.unitCents), 0);
  let discount = 0;
  if (discountType === "PERCENT") discount = Math.round((subtotal * discountValue) / 100);
  else if (discountType === "FIXED") discount = discountValue;
  discount = Math.min(discount, subtotal);
  const taxable = subtotal - discount;
  const tax = Math.round((taxable * taxRate) / 100);
  const tip = tipCents;
  return { subtotal, discount, tax, tip, total: taxable + tax + tip };
}

// ---------------------------------------------------------------- invoice status

export interface InstallmentLike {
  dueDate: Date;
  amountCents: number;
  paidAt: Date | null;
}

/** DRAFT | SENT | PARTIAL | OVERDUE | PAID */
export function invoiceEffectiveStatus(status: string, installments: InstallmentLike[]): string {
  if (status === "DRAFT") return "DRAFT";
  if (status === "PAID") return "PAID";
  const all = installments.length;
  const paid = installments.filter((i) => i.paidAt).length;
  if (all > 0 && paid === all) return "PAID";
  const now = Date.now();
  if (installments.some((i) => !i.paidAt && i.dueDate.getTime() < now)) return "OVERDUE";
  if (paid > 0) return "PARTIAL";
  return "SENT";
}

// ---------------------------------------------------------------- retainer

export function retainerAmount(type: string, value: number, totalCents: number): number {
  if (type === "PERCENT") return Math.min(totalCents, Math.round((totalCents * value) / 100));
  if (type === "FIXED") return Math.min(totalCents, value);
  if (type === "FULL") return totalCents;
  return 0;
}

export function retainerLabel(type: string, value: number): string {
  if (type === "PERCENT") return `${value}% retainer at booking`;
  if (type === "FIXED") return `${fmtMoney(value)} retainer at booking`;
  if (type === "FULL") return "Full payment at booking";
  return "No payment at booking";
}

// ---------------------------------------------------------------- smart fields

export const SMART_FIELDS = [
  { token: "{{client_name}}", label: "Client name" },
  { token: "{{client_email}}", label: "Client email" },
  { token: "{{client_phone}}", label: "Client phone" },
  { token: "{{session_type}}", label: "Session type" },
  { token: "{{session_date}}", label: "Session date" },
  { token: "{{session_location}}", label: "Session location" },
  { token: "{{session_price}}", label: "Session price" },
  { token: "{{retainer}}", label: "Retainer amount" },
  { token: "{{business_name}}", label: "Business name" },
  { token: "{{photographer_name}}", label: "Photographer name" },
  { token: "{{today}}", label: "Today's date" },
];

export type SmartFieldContext = Partial<Record<string, string>>;

export function renderSmartFields(body: string, ctx: SmartFieldContext): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => {
    const v = ctx[key];
    return v !== undefined && v !== "" ? v : match;
  });
}

// ---------------------------------------------------------------- slot generation

export interface SlotSpec {
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  order: number;
}

export function generateSlots(opts: {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  slotLengthMin: number;
  slotCount: number;
  spotsPerSlot: number;
  breakEvery: number; // after every N slots (0 = none)
  breakMin: number;
}): SlotSpec[] {
  const slots: SlotSpec[] = [];
  let cursor = new Date(`${opts.date}T${opts.startTime}:00`);
  if (isNaN(cursor.getTime())) return slots;
  for (let i = 0; i < opts.slotCount; i++) {
    const startsAt = new Date(cursor);
    const endsAt = new Date(cursor.getTime() + opts.slotLengthMin * 60_000);
    slots.push({ startsAt, endsAt, capacity: Math.max(1, opts.spotsPerSlot), order: i });
    cursor = endsAt;
    if (opts.breakEvery > 0 && opts.breakMin > 0 && (i + 1) % opts.breakEvery === 0 && i + 1 < opts.slotCount) {
      cursor = new Date(cursor.getTime() + opts.breakMin * 60_000);
    }
  }
  return slots;
}

// ---------------------------------------------------------------- profile

export async function getStudioProfile(userId: string) {
  const existing = await db.studioProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  const user = await db.user.findUnique({ where: { id: userId } });
  const base = slugify(user?.businessName || user?.name || "studio") || "studio";
  let candidate = base;
  let i = 1;
  while (await db.studioProfile.findUnique({ where: { bookingSlug: candidate } })) {
    candidate = `${base}-${++i}`;
  }
  return db.studioProfile.create({
    data: { userId, bookingSlug: candidate, businessEmail: user?.email ?? "" },
  });
}

// ---------------------------------------------------------------- numbering

export async function nextInvoiceNumber(userId: string): Promise<string> {
  const count = await db.invoice.count({ where: { userId } });
  return `INV-${String(count + 1).padStart(4, "0")}`;
}

export async function nextQuoteNumber(userId: string): Promise<string> {
  const count = await db.quote.count({ where: { userId } });
  return `QT-${String(count + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------- contacts

/** Find or create a contact for this user by email (fallback: by exact name when no email). */
export async function upsertContact(
  userId: string,
  data: { name: string; email?: string; phone?: string }
) {
  const email = (data.email ?? "").trim().toLowerCase();
  if (email) {
    const existing = await db.contact.findFirst({ where: { userId, email } });
    if (existing) {
      // Fill in anything we newly learned.
      const patch: Record<string, string> = {};
      if (!existing.phone && data.phone) patch.phone = data.phone;
      if (existing.name === existing.email && data.name) patch.name = data.name;
      if (Object.keys(patch).length) {
        return db.contact.update({ where: { id: existing.id }, data: patch });
      }
      return existing;
    }
  }
  return db.contact.create({
    data: { userId, name: data.name || email || "Unknown", email, phone: data.phone ?? "" },
  });
}

// ---------------------------------------------------------------- misc

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "127.0.0.1";
}

/** Lazily flip scheduled contracts to SENT once their send time passes (no cron in this stack). */
export async function applyScheduledSends(userId?: string, token?: string) {
  await db.contract.updateMany({
    where: {
      status: "DRAFT",
      scheduledSendAt: { lte: new Date() },
      ...(userId ? { userId } : {}),
      ...(token ? { token } : {}),
    },
    data: { status: "SENT", sentAt: new Date() },
  });
}

export function contractDerivedStatus(c: {
  status: string;
  expiresAt: Date | null;
  scheduledSendAt: Date | null;
  secondSignerEmail: string;
  signedAt: Date | null;
  secondSignedAt: Date | null;
}): string {
  if (c.status === "SIGNED") return "SIGNED";
  if (c.status !== "DRAFT" && c.expiresAt && c.expiresAt.getTime() < Date.now()) return "EXPIRED";
  if (c.status === "SENT" && c.signedAt && c.secondSignerEmail && !c.secondSignedAt) return "AWAITING_SECOND";
  if (c.status === "DRAFT" && c.scheduledSendAt && c.scheduledSendAt.getTime() > Date.now()) return "SCHEDULED";
  return c.status;
}

export const PROJECT_STAGES = ["INQUIRY", "BOOKED", "IN_PROGRESS", "DELIVERED", "COMPLETE"] as const;

export const STAGE_LABELS: Record<string, string> = {
  INQUIRY: "Inquiry",
  BOOKED: "Booked",
  IN_PROGRESS: "In Progress",
  DELIVERED: "Delivered",
  COMPLETE: "Complete",
};

/** Convert a quote into a draft invoice (items, tax, discount and contact carry over). */
export async function convertQuoteToInvoice(quote: {
  id: string;
  userId: string;
  contactId: string | null;
  title: string;
  number: string;
  items: string;
  taxRate: number;
  discountType: string;
  discountValue: number;
  notes: string;
  selection?: string;
}) {
  const existing = await db.invoice.findUnique({ where: { quoteId: quote.id } });
  // Phase 5B: only the client's chosen packages and extras go onto the invoice.
  let chosen: number[] | null = null;
  try {
    chosen = quote.selection ? (JSON.parse(quote.selection) as number[]) : null;
  } catch {
    chosen = null;
  }
  const invoiceItems = JSON.stringify(selectedQuoteItems(parseQuoteItems(quote.items), chosen));
  if (existing) return existing;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  return db.invoice.create({
    data: {
      userId: quote.userId,
      contactId: quote.contactId,
      quoteId: quote.id,
      number: await nextInvoiceNumber(quote.userId),
      title: quote.title || `From quote ${quote.number}`,
      status: "DRAFT",
      dueDate,
      items: invoiceItems,
      taxRate: quote.taxRate,
      discountType: quote.discountType,
      discountValue: quote.discountValue,
      notes: quote.notes,
    },
  });
}

export async function logStudioMessage(
  userId: string,
  data: { kind: string; name?: string; email?: string; subject: string; body?: string; meta?: string; read?: boolean }
) {
  await db.studioMessage.create({
    data: {
      userId,
      kind: data.kind,
      name: data.name ?? "",
      email: data.email ?? "",
      subject: data.subject,
      body: data.body ?? "",
      meta: data.meta ?? "",
      // outbound email log entries don't count as unread inbox items
      read: data.read ?? data.kind === "EMAIL",
    },
  });
}
