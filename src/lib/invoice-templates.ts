// Phase 5B: selectable invoice templates (layout and wording variants) used by
// the client facing /pay page and previewed in the invoice editor.

export interface InvoiceTemplate {
  id: "CLASSIC" | "MODERN" | "MINIMAL";
  name: string;
  description: string;
  words: {
    heading: string; // "Invoice"
    billedTo: string;
    issued: string;
    due: string;
    total: string;
    notes: string;
    item: string;
  };
}

export const INVOICE_TEMPLATES: InvoiceTemplate[] = [
  {
    id: "CLASSIC",
    name: "Classic",
    description: "Centered serif heading, itemised table, totals on the right.",
    words: { heading: "Invoice", billedTo: "Billed to", issued: "Issued", due: "Due", total: "Total", notes: "Notes", item: "Item" },
  },
  {
    id: "MODERN",
    name: "Modern",
    description: "Dark header band with the amount due up front and friendlier wording.",
    words: { heading: "Your invoice", billedTo: "Prepared for", issued: "Date", due: "Please pay by", total: "Amount due", notes: "A note from us", item: "Service" },
  },
  {
    id: "MINIMAL",
    name: "Minimal",
    description: "Compact, left aligned, no rules or shading, plain statement wording.",
    words: { heading: "Statement", billedTo: "Client", issued: "Date", due: "Payable by", total: "Balance", notes: "Terms", item: "Description" },
  },
];

export function invoiceTemplate(id: string): InvoiceTemplate {
  return INVOICE_TEMPLATES.find((t) => t.id === id) ?? INVOICE_TEMPLATES[0];
}
