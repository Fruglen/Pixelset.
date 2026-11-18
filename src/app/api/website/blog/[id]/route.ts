import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";

async function ownPost(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return null;
  const post = await db.blogPost.findFirst({ where: { id, websiteId: website.id } });
  return post ? { post, website } : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const own = await ownPost(params.id);
  if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { post, website } = own;

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  for (const key of ["excerpt", "coverUrl", "coverAlt", "body", "seoTitle", "seoDescription"] as const) {
    if (typeof body[key] === "string") data[key] = body[key];
  }

  if (typeof body.slug === "string" && body.slug.trim()) {
    const slug = slugify(body.slug);
    if (slug && slug !== post.slug) {
      const taken = await db.blogPost.findUnique({ where: { websiteId_slug: { websiteId: website.id, slug } } });
      if (taken) return NextResponse.json({ error: "A post with that slug already exists" }, { status: 400 });
      data.slug = slug;
    }
  }

  if (body.status === "PUBLISHED" && post.status !== "PUBLISHED") {
    data.status = "PUBLISHED";
    data.publishedAt = post.publishedAt ?? new Date();
  } else if (body.status === "DRAFT") {
    data.status = "DRAFT";
  }

  await db.blogPost.update({ where: { id: post.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const own = await ownPost(params.id);
  if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.blogPost.delete({ where: { id: own.post.id } });
  return NextResponse.json({ ok: true });
}
