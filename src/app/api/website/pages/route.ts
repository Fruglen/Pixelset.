import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { makeBlock } from "@/lib/blocks";

async function ownWebsite() {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.website.findUnique({ where: { userId: user.id } });
}

// Create a custom page.
export async function POST(req: NextRequest) {
  const website = await ownWebsite();
  if (!website) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  let slug = slugify(typeof body.slug === "string" && body.slug.trim() ? body.slug : title);
  if (!slug || slug === "blog") slug = `${slug || "page"}-2`;
  let candidate = slug;
  let i = 1;
  while (await db.sitePage.findUnique({ where: { websiteId_slug: { websiteId: website.id, slug: candidate } } })) {
    candidate = `${slug}-${++i}`;
  }

  const max = await db.sitePage.aggregate({ where: { websiteId: website.id }, _max: { order: true } });
  const page = await db.sitePage.create({
    data: {
      websiteId: website.id,
      type: "CUSTOM",
      title,
      slug: candidate,
      order: (max._max.order ?? 0) + 1,
      blocks: JSON.stringify([
        makeBlock("heading", { heading: title, align: "center" }),
        makeBlock("text", { body: "Write something here." }),
      ]),
    },
  });
  return NextResponse.json({ id: page.id });
}

// Reorder pages: { order: [pageId, ...] }
export async function PATCH(req: NextRequest) {
  const website = await ownWebsite();
  if (!website) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!Array.isArray(body.order)) return NextResponse.json({ error: "order required" }, { status: 400 });
  const ids = body.order.filter((x: unknown) => typeof x === "string") as string[];
  for (let i = 0; i < ids.length; i++) {
    await db.sitePage.updateMany({ where: { id: ids[i], websiteId: website.id }, data: { order: i } });
  }
  return NextResponse.json({ ok: true });
}
