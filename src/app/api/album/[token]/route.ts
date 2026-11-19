import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public client side of the album designer. The token is the credential.
// GET returns the design plus the photos the client can place (from the
// linked order's gallery when there is one, else the studio's recent
// photos). PUT saves cover + pages while the design is editable; POST with
// { action: "submit" } hands it to the studio for review.

const EDITABLE = ["DRAFT", "CHANGES_REQUESTED"];

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function load(token: string) {
  return db.albumDesign.findUnique({ where: { token } });
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const design = await load(params.token);
  if (!design) return NextResponse.json({ error: "This album link is not valid" }, { status: 404 });

  let photos: { id: string; url: string; filename: string }[] = [];
  const order = design.orderId
    ? await db.order.findFirst({ where: { id: design.orderId, userId: design.userId } })
    : null;
  if (order?.collectionId) {
    photos = await db.photo.findMany({
      where: { collectionId: order.collectionId, isPrivate: false },
      orderBy: { order: "asc" },
      take: 200,
      select: { id: true, url: true, filename: true },
    });
  }
  if (photos.length === 0) {
    photos = await db.photo.findMany({
      where: { collection: { userId: design.userId }, isPrivate: false },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, url: true, filename: true },
    });
  }
  const studio = await db.user.findUnique({
    where: { id: design.userId },
    select: { businessName: true, name: true },
  });

  return NextResponse.json({
    design: {
      title: design.title,
      status: design.status,
      cover: parseJson(design.coverJson, {}),
      pages: parseJson(design.pagesJson, []),
      editable: EDITABLE.includes(design.status),
      updatedAt: design.updatedAt.toISOString(),
    },
    photos,
    studioName: studio?.businessName || studio?.name || "",
  });
}

export async function PUT(req: NextRequest, { params }: { params: { token: string } }) {
  const design = await load(params.token);
  if (!design) return NextResponse.json({ error: "This album link is not valid" }, { status: 404 });
  if (!EDITABLE.includes(design.status)) {
    return NextResponse.json(
      { error: "This design is with the studio for review and cannot be edited right now" },
      { status: 400 }
    );
  }
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.cover && typeof body.cover === "object") {
    data.coverJson = JSON.stringify(body.cover).slice(0, 20000);
  }
  if (Array.isArray(body.pages)) {
    if (body.pages.length > 60) return NextResponse.json({ error: "Too many spreads" }, { status: 400 });
    data.pagesJson = JSON.stringify(body.pages).slice(0, 200000);
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  const updated = await db.albumDesign.update({ where: { id: design.id }, data });
  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt.toISOString() });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const design = await load(params.token);
  if (!design) return NextResponse.json({ error: "This album link is not valid" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.action !== "submit") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!EDITABLE.includes(design.status)) {
    return NextResponse.json({ error: "This design has already been submitted" }, { status: 400 });
  }
  await db.albumDesign.update({ where: { id: design.id }, data: { status: "SUBMITTED" } });
  return NextResponse.json({ ok: true, status: "SUBMITTED" });
}
