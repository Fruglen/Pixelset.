import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { parseBlocks } from "@/lib/blocks";
import { WEBSITE_LIMITS, planFor, tierLabel } from "@/lib/plans";

async function ownPage(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return null;
  const page = await db.sitePage.findFirst({ where: { id, websiteId: website.id } });
  return page ? { page, website } : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const own = await ownPage(params.id);
  if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { page, website } = own;

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.visible === "boolean") data.visible = body.visible;
  if (typeof body.password === "string") data.password = body.password.trim().slice(0, 100);
  if (typeof body.seoTitle === "string") data.seoTitle = body.seoTitle.trim();
  if (typeof body.seoDescription === "string") data.seoDescription = body.seoDescription.trim();

  if (typeof body.slug === "string" && page.type !== "HOME" && page.type !== "BLOG") {
    const slug = slugify(body.slug);
    if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    if (slug !== page.slug) {
      const taken = await db.sitePage.findUnique({ where: { websiteId_slug: { websiteId: website.id, slug } } });
      if (taken) return NextResponse.json({ error: "A page with that slug already exists" }, { status: 400 });
      data.slug = slug;
    }
  }

  if (typeof body.blocks === "string" || Array.isArray(body.blocks)) {
    // validate it parses into a block array before storing
    const blocks = parseBlocks(typeof body.blocks === "string" ? body.blocks : JSON.stringify(body.blocks));
    // Night build (Pricing lane): custom embed code is a Website Pro unlock.
    if (blocks.some((b) => b.type === "embed")) {
      const plan = await planFor(website.userId);
      if (!WEBSITE_LIMITS[plan.website].customCode) {
        return NextResponse.json(
          { error: `Custom embed code needs the Website Pro plan (your plan is ${tierLabel("website", plan.website)}). Upgrade in Settings > Plan.` },
          { status: 403 },
        );
      }
    }
    data.blocks = JSON.stringify(blocks);
  }

  await db.sitePage.update({ where: { id: page.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const own = await ownPage(params.id);
  if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (own.page.type === "HOME") return NextResponse.json({ error: "The home page can't be deleted" }, { status: 400 });
  await db.sitePage.delete({ where: { id: own.page.id } });
  return NextResponse.json({ ok: true });
}
