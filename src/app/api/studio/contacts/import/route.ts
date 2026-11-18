import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Minimal CSV parser that understands quoted fields and escaped quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

// Import contacts from CSV text. Columns are matched from the header row
// (name / first name + last name, email, phone, address, company, tags);
// without a header the columns are assumed to be name,email,phone.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!csv.trim()) return NextResponse.json({ error: "Paste or upload a CSV first" }, { status: 400 });

  const rows = parseCsv(csv);
  if (!rows.length) return NextResponse.json({ error: "No rows found" }, { status: 400 });

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const find = (...names: string[]) => header.findIndex((h) => names.includes(h));
  let idx = {
    name: find("name", "full name", "client", "client name"),
    first: find("first name", "firstname", "first"),
    last: find("last name", "lastname", "last"),
    email: find("email", "e-mail", "email address"),
    phone: find("phone", "phone number", "mobile", "tel"),
    address: find("address", "mailing address"),
    company: find("company", "business", "organization"),
    tags: find("tags", "tag", "labels"),
  };
  const hasHeader = idx.name >= 0 || idx.email >= 0 || idx.first >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (!hasHeader) idx = { name: 0, first: -1, last: -1, email: 1, phone: 2, address: -1, company: -1, tags: -1 };

  const existing = await db.contact.findMany({ where: { userId: user.id }, select: { email: true } });
  const seen = new Set(existing.map((c) => c.email).filter(Boolean));

  let imported = 0;
  let skipped = 0;
  for (const row of dataRows) {
    const get = (i: number) => (i >= 0 && i < row.length ? row[i].trim() : "");
    let name = get(idx.name);
    if (!name) name = [get(idx.first), get(idx.last)].filter(Boolean).join(" ");
    const email = get(idx.email).toLowerCase();
    if (!name && !email) {
      skipped++;
      continue;
    }
    if (email && seen.has(email)) {
      skipped++;
      continue;
    }
    await db.contact.create({
      data: {
        userId: user.id,
        name: name || email,
        email,
        phone: get(idx.phone),
        address: get(idx.address),
        company: get(idx.company),
        tags: get(idx.tags),
      },
    });
    if (email) seen.add(email);
    imported++;
  }
  return NextResponse.json({ imported, skipped });
}
