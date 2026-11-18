import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readGalleryAccess, writeGalleryAccess } from "@/lib/gallery-auth";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const collection = await db.collection.findUnique({
    where: { slug: params.slug },
    include: { sets: true },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const mode = body.mode as string;
  const access = readGalleryAccess(collection.id);

  if (mode === "password") {
    if (typeof body.password !== "string" || body.password !== collection.password) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
    writeGalleryAccess(collection.id, { ...access, pw: true });
    return NextResponse.json({ ok: true });
  }

  if (mode === "email" || mode === "identify" || mode === "prerelease") {
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const existing = await db.emailRegistration.findUnique({
      where: { collectionId_email: { collectionId: collection.id, email } },
    });
    if (!existing) {
      await db.emailRegistration.create({ data: { collectionId: collection.id, email } });
      await logActivity(
        collection.id,
        "EMAIL_REGISTRATION",
        mode === "prerelease" ? "Registered for pre-release notification" : "Registered to view gallery",
        email
      );
    }
    if (mode !== "prerelease") {
      writeGalleryAccess(collection.id, { ...access, email, name });
    }
    return NextResponse.json({ ok: true });
  }

  if (mode === "exclusive") {
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const matching = collection.sets.filter(
      (s) => s.clientExclusive && s.clientEmail === email && s.clientPassword === password
    );
    if (matching.length === 0) {
      return NextResponse.json({ error: "No exclusive sets match that email and password" }, { status: 401 });
    }
    const sets = Array.from(new Set([...access.sets, ...matching.map((s) => s.id)]));
    writeGalleryAccess(collection.id, { ...access, email: access.email || email, sets });
    return NextResponse.json({ ok: true, unlocked: matching.length });
  }

  return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
}
