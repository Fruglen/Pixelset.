import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint: contact / booking / newsletter submissions from a site.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const website = await db.website.findUnique({ where: { slug: params.slug } });
  if (!website) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const kind = ["CONTACT", "BOOKING", "NEWSLETTER"].includes(body.kind) ? body.kind : "CONTACT";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (kind !== "NEWSLETTER" && !name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await db.siteMessage.create({
    data: {
      websiteId: website.id,
      kind,
      name,
      email: email.slice(0, 200),
      phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 60) : "",
      subject: typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "",
      body: typeof body.body === "string" ? body.body.trim().slice(0, 5000) : "",
      meta: typeof body.meta === "string" ? body.meta.trim().slice(0, 500) : "",
    },
  });
  return NextResponse.json({ ok: true });
}
