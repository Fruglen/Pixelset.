import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { slugify } from "@/lib/utils";
import { parsePresetSettings, presetSettingsData } from "@/lib/preset-apply";

// Volume photography workflow: a CSV upload creates one collection per row.
// Header row (case-insensitive, any order): name, eventDate, folder,
// password, pin, preset, status. Folders are found or created by name;
// presets are matched by name. Each row reports its own result, so one bad
// row never blocks the rest.
//
// Build pack 2026-11-20: optional client columns. "clientEmail" (also accepted
// as "email" or "client") assigns the new gallery to a studio contact: the
// contact is matched by email (case-insensitive) or created as a CLIENT with
// source IMPORT. "clientName" names a newly created contact. CSVs without
// these columns import exactly as before.

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("upload");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!csv.trim()) return NextResponse.json({ error: "Paste or upload a CSV first" }, { status: 400 });

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return NextResponse.json({ error: "The CSV needs a header row and at least one collection row" }, { status: 400 });
  }
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
  const col = (name: string) => header.indexOf(name);
  const idx = {
    name: col("name"),
    eventDate: col("eventdate"),
    folder: col("folder"),
    password: col("password"),
    pin: col("pin"),
    preset: col("preset"),
    status: col("status"),
    clientEmail: [col("clientemail"), col("email"), col("client")].find((i) => i >= 0) ?? -1,
    clientName: col("clientname"),
  };
  if (idx.name === -1) {
    return NextResponse.json({ error: "The CSV header must include a name column" }, { status: 400 });
  }
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  const [folders, presets, contacts] = await Promise.all([
    db.folder.findMany({ where: { userId: user.id } }),
    db.preset.findMany({ where: { userId: user.id } }),
    idx.clientEmail >= 0 ? db.contact.findMany({ where: { userId: user.id }, select: { id: true, email: true, state: true } }) : Promise.resolve([]),
  ]);
  const contactByEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email.trim().toLowerCase(), c]));
  let contactsCreated = 0;
  const folderByName = new Map(folders.map((f) => [f.name.toLowerCase(), f.id]));
  const presetByName = new Map(presets.map((p) => [p.name.toLowerCase(), p]));

  const created: { row: number; name: string; slug: string; client?: { email: string; created: boolean } }[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let r = 1; r < rows.length; r++) {
    const rowNum = r + 1;
    const row = rows[r];
    const name = get(row, idx.name);
    if (!name) {
      errors.push({ row: rowNum, message: "Name is empty" });
      continue;
    }
    try {
      let data: Record<string, unknown> = {};
      const presetName = get(row, idx.preset);
      if (presetName) {
        const preset = presetByName.get(presetName.toLowerCase());
        if (!preset) {
          errors.push({ row: rowNum, message: `Preset "${presetName}" not found` });
          continue;
        }
        data = { ...presetSettingsData(parsePresetSettings(preset.settings)).data };
      }
      const folderName = get(row, idx.folder);
      let folderId: string | null = null;
      if (folderName) {
        folderId = folderByName.get(folderName.toLowerCase()) ?? null;
        if (!folderId) {
          const folder = await db.folder.create({ data: { userId: user.id, name: folderName } });
          folderId = folder.id;
          folderByName.set(folderName.toLowerCase(), folderId);
        }
      }
      const password = get(row, idx.password);
      if (password) data.password = password;
      const pin = get(row, idx.pin);
      if (pin) {
        data.downloadPin = pin;
        data.pinEnabled = true;
      }
      const statusRaw = get(row, idx.status).toUpperCase();
      if (statusRaw) {
        if (!["DRAFT", "PRERELEASE", "PUBLISHED"].includes(statusRaw)) {
          errors.push({ row: rowNum, message: `Status "${statusRaw}" is not DRAFT, PRERELEASE or PUBLISHED` });
          continue;
        }
        data.status = statusRaw;
      }
      const clientEmail = get(row, idx.clientEmail).toLowerCase();
      if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        errors.push({ row: rowNum, message: `Client email "${clientEmail}" is not a valid email address` });
        continue;
      }
      const eventDateRaw = get(row, idx.eventDate);
      let slug = slugify(name) || "collection";
      let candidate = slug;
      let i = 1;
      while (await db.collection.findUnique({ where: { slug: candidate } })) {
        candidate = `${slug}-${++i}`;
      }
      slug = candidate;
      let client: { id: string; email: string; created: boolean } | null = null;
      if (clientEmail) {
        const known = contactByEmail.get(clientEmail);
        if (known) {
          if (known.state !== "CLIENT") {
            await db.contact.update({ where: { id: known.id }, data: { state: "CLIENT" } });
            known.state = "CLIENT";
          }
          client = { id: known.id, email: clientEmail, created: false };
        } else {
          const contact = await db.contact.create({
            data: { userId: user.id, name: get(row, idx.clientName) || clientEmail.split("@")[0], email: clientEmail, state: "CLIENT", source: "IMPORT" },
          });
          contactByEmail.set(clientEmail, { id: contact.id, email: contact.email, state: contact.state });
          contactsCreated++;
          client = { id: contact.id, email: clientEmail, created: true };
        }
      }
      const collection = await db.collection.create({
        data: {
          userId: user.id,
          name,
          slug,
          eventDate: eventDateRaw ? new Date(`${eventDateRaw}T12:00:00`) : null,
          folderId,
          contactId: client?.id ?? null,
          ...data,
          sets: { create: [{ name: "Highlights", order: 0 }] },
        },
      });
      created.push({ row: rowNum, name: collection.name, slug: collection.slug, ...(client ? { client: { email: client.email, created: client.created } } : {}) });
    } catch (e) {
      errors.push({ row: rowNum, message: e instanceof Error ? e.message : "Could not create this collection" });
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    errors,
    createdCount: created.length,
    errorCount: errors.length,
    assignedCount: created.filter((c) => c.client).length,
    contactsCreated,
  });
}
