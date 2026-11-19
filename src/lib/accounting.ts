import { db } from "./db";
import { calcTotals, invoiceEffectiveStatus, parseItems } from "./studio";
import { paymentRows } from "./studio-payments";
import { toCsv } from "./account-export";

// Phase 5B: accounting and CRM integrations.
// - Exports that work everywhere: QuickBooks Desktop IIF (customers, invoices,
//   payments), QuickBooks Online invoice import CSV, a payments CSV, and a
//   HubSpot style contacts CSV.
// - Live sync only when the account owner configures env tokens:
//   QUICKBOOKS_ACCESS_TOKEN + QUICKBOOKS_REALM_ID (optional QUICKBOOKS_ENV=sandbox,
//   QUICKBOOKS_ITEM_ID) and HUBSPOT_TOKEN. Without them the UI says Not connected.
// Payments themselves are mocked per the owner's payments exclusion, so the
// payment exports carry the recorded (mock) payments.

const money = (cents: number) => (cents / 100).toFixed(2);
const usDate = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
const iif = (v: string | number) => String(v ?? "").replace(/[\t\r\n]+/g, " ");
const line = (cells: (string | number)[]) => cells.map(iif).join("\t");

export function quickbooksConnected() {
  return !!(process.env.QUICKBOOKS_ACCESS_TOKEN && process.env.QUICKBOOKS_REALM_ID);
}
export function hubspotConnected() {
  return !!process.env.HUBSPOT_TOKEN;
}

async function invoicesFor(userId: string) {
  const invoices = await db.invoice.findMany({
    where: { userId, status: { not: "DRAFT" } },
    include: { contact: true, installments: true },
    orderBy: { issueDate: "asc" },
  });
  return invoices.map((inv) => {
    const items = parseItems(inv.items);
    const t = calcTotals(items, inv.taxRate, inv.discountType, inv.discountValue, inv.tipCents);
    return { inv, items, t, customer: inv.contact?.name || inv.contact?.email || "Walk-in client", status: invoiceEffectiveStatus(inv.status, inv.installments) };
  });
}

/** QuickBooks Desktop IIF: customer list plus one INVOICE transaction per invoice. */
export async function invoicesIif(userId: string): Promise<string> {
  const rows = await invoicesFor(userId);
  const out: string[] = [];
  out.push(line(["!CUST", "NAME", "EMAIL", "PHONE1", "BADDR1", "COMPANYNAME"]));
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.customer)) continue;
    seen.add(r.customer);
    out.push(line(["CUST", r.customer, r.inv.contact?.email ?? "", r.inv.contact?.phone ?? "", r.inv.contact?.address ?? "", r.inv.contact?.company ?? ""]));
  }
  out.push(line(["!TRNS", "TRNSID", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "DOCNUM", "MEMO", "DUEDATE"]));
  out.push(line(["!SPL", "SPLID", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "DOCNUM", "MEMO", "QNTY", "PRICE", "INVITEM"]));
  out.push("!ENDTRNS");
  for (const { inv, items, t, customer } of rows) {
    const d = usDate(inv.issueDate);
    out.push(line(["TRNS", "", "INVOICE", d, "Accounts Receivable", customer, money(t.total), inv.number, inv.title, inv.dueDate ? usDate(inv.dueDate) : ""]));
    for (const it of items) {
      const amt = Math.round(it.qty * it.unitCents);
      out.push(line(["SPL", "", "INVOICE", d, "Photography Income", customer, money(-amt), inv.number, it.description, -it.qty, money(it.unitCents), "Photography Services"]));
    }
    if (t.discount) out.push(line(["SPL", "", "INVOICE", d, "Photography Income", customer, money(t.discount), inv.number, "Discount", "", "", "Discount"]));
    if (t.tax) out.push(line(["SPL", "", "INVOICE", d, "Sales Tax Payable", customer, money(-t.tax), inv.number, `Sales tax ${inv.taxRate}%`, "", "", "Sales Tax"]));
    if (t.tip) out.push(line(["SPL", "", "INVOICE", d, "Tips Income", customer, money(-t.tip), inv.number, "Tip", "", "", "Tip"]));
    out.push("ENDTRNS");
  }
  return out.join("\r\n") + "\r\n";
}

/** QuickBooks Desktop IIF of recorded payments: invoice payments against A/R, other income as deposits. */
export async function paymentsIif(userId: string): Promise<string> {
  const rows = await paymentRows(userId);
  const out: string[] = [];
  out.push(line(["!TRNS", "TRNSID", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "DOCNUM", "MEMO", "PAYMETH"]));
  out.push(line(["!SPL", "SPLID", "TRNSTYPE", "DATE", "ACCNT", "NAME", "AMOUNT", "DOCNUM", "MEMO"]));
  out.push("!ENDTRNS");
  for (const p of rows) {
    const d = usDate(new Date(p.date));
    const amt = p.amountCents + p.tipCents;
    const name = p.payer || "Client";
    const doc = p.source === "Invoice" ? p.label.split(",")[0] : "";
    if (p.source === "Invoice") {
      out.push(line(["TRNS", "", "PAYMENT", d, "Undeposited Funds", name, money(amt), doc, p.label, p.method]));
      out.push(line(["SPL", "", "PAYMENT", d, "Accounts Receivable", name, money(-amt), doc, p.label]));
    } else {
      out.push(line(["TRNS", "", "DEPOSIT", d, "Undeposited Funds", name, money(amt), "", `${p.source}: ${p.label}`, p.method]));
      out.push(line(["SPL", "", "DEPOSIT", d, "Photography Income", name, money(-amt), "", `${p.source}: ${p.label}`]));
    }
    out.push("ENDTRNS");
  }
  return out.join("\r\n") + "\r\n";
}

/** QuickBooks Online invoice import CSV (one row per line item). */
export async function invoicesQboCsv(userId: string): Promise<string> {
  const rows = await invoicesFor(userId);
  const headers = ["InvoiceNo", "Customer", "InvoiceDate", "DueDate", "Memo", "Item(Product/Service)", "ItemDescription", "ItemQuantity", "ItemRate", "ItemAmount", "Status"];
  const out: Record<string, unknown>[] = [];
  for (const { inv, items, t, customer, status } of rows) {
    const base = { InvoiceNo: inv.number, Customer: customer, InvoiceDate: usDate(inv.issueDate), DueDate: inv.dueDate ? usDate(inv.dueDate) : "", Memo: inv.title, Status: status };
    for (const it of items)
      out.push({ ...base, "Item(Product/Service)": "Photography Services", ItemDescription: it.description, ItemQuantity: it.qty, ItemRate: money(it.unitCents), ItemAmount: money(Math.round(it.qty * it.unitCents)) });
    if (t.discount) out.push({ ...base, "Item(Product/Service)": "Discount", ItemDescription: "Discount", ItemQuantity: 1, ItemRate: money(-t.discount), ItemAmount: money(-t.discount) });
    if (t.tax) out.push({ ...base, "Item(Product/Service)": "Sales Tax", ItemDescription: `Sales tax ${inv.taxRate}%`, ItemQuantity: 1, ItemRate: money(t.tax), ItemAmount: money(t.tax) });
    if (t.tip) out.push({ ...base, "Item(Product/Service)": "Tip", ItemDescription: "Tip", ItemQuantity: 1, ItemRate: money(t.tip), ItemAmount: money(t.tip) });
  }
  return toCsv(headers, out);
}

export async function paymentsCsv(userId: string): Promise<string> {
  const rows = await paymentRows(userId);
  return toCsv(
    ["Date", "Source", "Reference", "Payer", "Method", "Amount", "Tip", "Total", "Note"],
    rows.map((p) => ({
      Date: p.date.slice(0, 10),
      Source: p.source,
      Reference: p.label,
      Payer: p.payer,
      Method: p.method,
      Amount: money(p.amountCents),
      Tip: money(p.tipCents),
      Total: money(p.amountCents + p.tipCents),
      Note: "Mock payment, recorded in Pixelset",
    }))
  );
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

/** HubSpot style contacts CSV (column names HubSpot's importer maps automatically). */
export async function crmContactsCsv(userId: string): Promise<string> {
  const contacts = await db.contact.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return toCsv(
    ["First Name", "Last Name", "Email", "Phone Number", "Company Name", "Street Address", "Lifecycle Stage", "Lead Source", "Tags", "Create Date"],
    contacts.map((c) => {
      const n = splitName(c.name);
      return {
        "First Name": n.first,
        "Last Name": n.last,
        Email: c.email,
        "Phone Number": c.phone,
        "Company Name": c.company,
        "Street Address": c.address,
        "Lifecycle Stage": c.state === "CLIENT" ? "customer" : "lead",
        "Lead Source": c.source,
        Tags: c.tags,
        "Create Date": c.createdAt.toISOString().slice(0, 10),
      };
    })
  );
}

// ---------------------------------------------------------------- live sync

async function record(userId: string, provider: string, entity: string, localId: string, remoteId: string, status: string, detail: string) {
  await db.accountingSync.upsert({
    where: { provider_entity_localId: { provider, entity, localId } },
    create: { userId, provider, entity, localId, remoteId, status, detail },
    update: { remoteId, status, detail },
  });
}

export interface SyncResult {
  connected: boolean;
  synced: number;
  skipped: number;
  failed: number;
  message: string;
}

/** Push invoices (and their customers) to QuickBooks Online. Only runs when tokens are configured. */
export async function syncQuickBooks(userId: string): Promise<SyncResult> {
  if (!quickbooksConnected()) return { connected: false, synced: 0, skipped: 0, failed: 0, message: "Not connected: set QUICKBOOKS_ACCESS_TOKEN and QUICKBOOKS_REALM_ID" };
  const base = `${process.env.QUICKBOOKS_ENV === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com"}/v3/company/${process.env.QUICKBOOKS_REALM_ID}`;
  const headers = { Authorization: `Bearer ${process.env.QUICKBOOKS_ACCESS_TOKEN}`, Accept: "application/json", "Content-Type": "application/json" };
  const itemId = process.env.QUICKBOOKS_ITEM_ID || "1";
  const done = new Set((await db.accountingSync.findMany({ where: { userId, provider: "QUICKBOOKS", entity: "INVOICE", status: "OK" } })).map((s) => s.localId));
  const customerIds = new Map<string, string>();
  let synced = 0, skipped = 0, failed = 0;
  let lastError = "";
  for (const { inv, items, t, customer } of await invoicesFor(userId)) {
    if (done.has(inv.id)) {
      skipped++;
      continue;
    }
    try {
      let custId = customerIds.get(customer);
      if (!custId) {
        const q = encodeURIComponent(`select Id from Customer where DisplayName = '${customer.replace(/'/g, "\\'")}'`);
        const found = await fetch(`${base}/query?query=${q}&minorversion=65`, { headers, signal: AbortSignal.timeout(20000) });
        if (!found.ok) throw new Error(`customer lookup HTTP ${found.status}`);
        const fj = await found.json();
        custId = fj?.QueryResponse?.Customer?.[0]?.Id;
        if (!custId) {
          const created = await fetch(`${base}/customer?minorversion=65`, {
            method: "POST",
            headers,
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ DisplayName: customer, PrimaryEmailAddr: inv.contact?.email ? { Address: inv.contact.email } : undefined }),
          });
          if (!created.ok) throw new Error(`customer create HTTP ${created.status}`);
          custId = (await created.json())?.Customer?.Id;
        }
        if (!custId) throw new Error("no customer id returned");
        customerIds.set(customer, custId);
        if (inv.contactId) await record(userId, "QUICKBOOKS", "CUSTOMER", inv.contactId, custId, "OK", customer);
      }
      const lines = items.map((it) => ({
        DetailType: "SalesItemLineDetail",
        Amount: Number(money(Math.round(it.qty * it.unitCents))),
        Description: it.description,
        SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: it.qty, UnitPrice: Number(money(it.unitCents)) },
      }));
      if (t.discount) lines.push({ DetailType: "SalesItemLineDetail", Amount: -Number(money(t.discount)), Description: "Discount", SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: -Number(money(t.discount)) } });
      if (t.tax + t.tip) lines.push({ DetailType: "SalesItemLineDetail", Amount: Number(money(t.tax + t.tip)), Description: "Tax and tip", SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: Number(money(t.tax + t.tip)) } });
      const res = await fetch(`${base}/invoice?minorversion=65`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ DocNumber: inv.number.slice(0, 21), CustomerRef: { value: custId }, TxnDate: inv.issueDate.toISOString().slice(0, 10), DueDate: inv.dueDate?.toISOString().slice(0, 10), Line: lines }),
      });
      if (!res.ok) throw new Error(`invoice create HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const remote = (await res.json())?.Invoice?.Id ?? "";
      await record(userId, "QUICKBOOKS", "INVOICE", inv.id, remote, "OK", inv.number);
      synced++;
    } catch (e) {
      failed++;
      lastError = (e as Error).message;
      await record(userId, "QUICKBOOKS", "INVOICE", inv.id, "", "FAILED", lastError.slice(0, 300));
    }
  }
  return { connected: true, synced, skipped, failed, message: failed ? `QuickBooks: ${synced} synced, ${failed} failed (${lastError})` : `QuickBooks: ${synced} invoice(s) synced, ${skipped} already synced` };
}

/** Upsert every contact with an email into HubSpot by email. Only runs when HUBSPOT_TOKEN is set. */
export async function syncHubSpot(userId: string): Promise<SyncResult> {
  if (!hubspotConnected()) return { connected: false, synced: 0, skipped: 0, failed: 0, message: "Not connected: set HUBSPOT_TOKEN" };
  const contacts = (await db.contact.findMany({ where: { userId } })).filter((c) => c.email);
  let synced = 0, failed = 0;
  let lastError = "";
  for (let i = 0; i < contacts.length; i += 100) {
    const batch = contacts.slice(i, i + 100);
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
        method: "POST",
        signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: batch.map((c) => {
            const n = splitName(c.name);
            return {
              idProperty: "email",
              id: c.email.toLowerCase(),
              properties: { email: c.email.toLowerCase(), firstname: n.first, lastname: n.last, phone: c.phone, company: c.company, address: c.address, lifecyclestage: c.state === "CLIENT" ? "customer" : "lead" },
            };
          }),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = await res.json();
      const byEmail = new Map<string, string>((json?.results ?? []).map((r: { id: string; properties?: { email?: string } }) => [String(r.properties?.email ?? "").toLowerCase(), r.id]));
      for (const c of batch) await record(userId, "HUBSPOT", "CONTACT", c.id, byEmail.get(c.email.toLowerCase()) ?? "", "OK", c.email);
      synced += batch.length;
    } catch (e) {
      failed += batch.length;
      lastError = (e as Error).message;
      for (const c of batch) await record(userId, "HUBSPOT", "CONTACT", c.id, "", "FAILED", lastError.slice(0, 300));
    }
  }
  return { connected: true, synced, skipped: 0, failed, message: failed ? `HubSpot: ${synced} synced, ${failed} failed (${lastError})` : `HubSpot: ${synced} contact(s) upserted` };
}

export async function syncStatus(userId: string) {
  const rows = await db.accountingSync.groupBy({ by: ["provider", "status"], where: { userId }, _count: true, _max: { updatedAt: true } });
  const pick = (provider: string) => {
    const ok = rows.find((r) => r.provider === provider && r.status === "OK");
    const bad = rows.find((r) => r.provider === provider && r.status === "FAILED");
    const last = [ok?._max.updatedAt, bad?._max.updatedAt].filter(Boolean).sort().pop() as Date | undefined;
    return { ok: ok?._count ?? 0, failed: bad?._count ?? 0, last: last ? last.toISOString() : null };
  };
  return { quickbooks: { connected: quickbooksConnected(), ...pick("QUICKBOOKS") }, hubspot: { connected: hubspotConnected(), ...pick("HUBSPOT") } };
}
