import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const collection = await db.collection.findFirst({
    where: { id: String(body.collectionId ?? ""), userId: user.id },
    include: { mobileApp: true },
  });
  if (!collection) return NextResponse.json({ error: "Unknown collection" }, { status: 400 });
  if (collection.mobileApp) {
    return NextResponse.json({ error: "This collection already has an app" }, { status: 409 });
  }

  const appName =
    typeof body.appName === "string" && body.appName.trim() ? body.appName.trim() : collection.name;
  const base = slugify(appName) || "gallery-app";
  let slug = base;
  let i = 1;
  while (await db.mobileApp.findUnique({ where: { slug } })) slug = `${base}-${++i}`;

  const app = await db.mobileApp.create({
    data: {
      userId: user.id,
      collectionId: collection.id,
      slug,
      appName,
      accentColor: typeof body.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.accentColor) ? body.accentColor : "#1c1c1c",
      contactEmail: typeof body.contactEmail === "string" ? body.contactEmail.trim() : user.email,
      contactPhone: typeof body.contactPhone === "string" ? body.contactPhone.trim() : "",
    },
  });
  return NextResponse.json({ id: app.id, slug: app.slug });
}
