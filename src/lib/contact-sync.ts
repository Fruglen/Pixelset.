import { db } from "./db";

// Phase 5B: keep Studio Manager contacts in sync with people who show up
// through other products (gallery registrations, favorite lists, website and
// lead forms, bookings). Upserts by email per photographer.

export async function upsertContact(
  userId: string,
  email: string,
  name: string,
  source: "GALLERY" | "WEBSITE_FORM" | "LEAD_FORM" | "BOOKING" | "STORE",
  opts: { phone?: string; tag?: string; makeClient?: boolean } = {}
) {
  const e = (email || "").toLowerCase().trim();
  if (!e.includes("@")) return null;
  const existing = await db.contact.findFirst({ where: { userId, email: e } });
  const tags = (t: string) =>
    Array.from(new Set([...t.split(",").map((x) => x.trim()).filter(Boolean), ...(opts.tag ? [opts.tag] : [])])).join(",");
  if (existing) {
    const data: Record<string, unknown> = {};
    if (!existing.name && name) data.name = name;
    if (!existing.phone && opts.phone) data.phone = opts.phone;
    if (opts.tag) data.tags = tags(existing.tags);
    if (opts.makeClient && existing.state !== "CLIENT") data.state = "CLIENT";
    if (Object.keys(data).length) await db.contact.update({ where: { id: existing.id }, data });
    return existing;
  }
  return db.contact.create({
    data: {
      userId,
      email: e,
      name: name || e.split("@")[0],
      phone: opts.phone ?? "",
      tags: tags(""),
      source,
      state: opts.makeClient ? "CLIENT" : "LEAD",
    },
  });
}
