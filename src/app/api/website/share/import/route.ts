import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { parseShareCode } from "@/lib/site-share";
import { newBlockId } from "@/lib/blocks";

export const runtime = "nodejs";

// Night build (Website): import a shared page (creates a new draft page)
// or hand a shared block back to the editor for insertion.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "Create your website first" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const payload = parseShareCode(String(body.code ?? ""));
  if (!payload) return NextResponse.json({ error: "That share code is not valid" }, { status: 400 });

  if (payload.kind === "block" && payload.block) {
    // Fresh id so importing the same block twice never collides.
    return NextResponse.json({ block: { ...payload.block, id: newBlockId() } });
  }

  const blocks = (payload.blocks ?? []).map((b) => ({ ...b, id: newBlockId() }));
  const title = payload.title || "Shared page";
  const count = await db.sitePage.count({ where: { websiteId: website.id } });
  let slug = slugify(title) || "shared-page";
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await db.sitePage.findFirst({ where: { websiteId: website.id, slug } })) {
    slug = `${slugify(title) || "shared-page"}-${suffix++}`;
  }
  const page = await db.sitePage.create({
    data: {
      websiteId: website.id,
      type: "CUSTOM",
      title,
      slug,
      order: count,
      visible: true,
      blocks: JSON.stringify(blocks),
    },
  });
  return NextResponse.json({ page: { id: page.id, title: page.title, slug: page.slug } });
}
